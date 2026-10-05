import { and, asc, desc, eq, inArray, isNotNull, isNull, like, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import {
  assessmentLinks,
  assessments,
  attempts,
  candidates,
  consents,
  hiringActivities,
  hiringAssessments,
  hiringAssignments,
  hiringOpenings,
  hiringResponses,
  hiringStageRuns,
  hiringStages,
  hiringSurveyResponses,
  hiringVersions,
  mediaAssets,
  organizations,
  positions,
  type HiringResponsePayload,
  type HiringRunClosedBy,
} from "@/db/schema";
import { currentAttempt, hasConsented, type CandidateContext } from "@/lib/candidate-context";
import { failMedia, normaliseFileMime, normaliseMime, resolveOwnedMedia } from "@/lib/candidate-media";
import { enqueueTranscription } from "@/lib/queue";
import { decideSalvage, SALVAGE_MIN_AGE_MS } from "@/lib/stage-timeout";
import { getStorage, mediaKey } from "@/lib/storage";
import { submitDecision, SUBMIT_SLACK_MS } from "@/lib/timer";
import { isTranscribableMime } from "@/lib/transcription";
import type { MediaAssetRow } from "@/solutions/types";
import {
  autoScore,
  cleanFileName,
  closedByOf,
  DEFAULT_MAX_FILE_BYTES,
  extraTimeRefusal,
  isExtraTimePct,
  isOverdue,
  missingRequired,
  responseAnswered,
  runCompletion,
  sanitizeResponse,
  stageDeadline,
  writeRefusal,
  type ExtraTimePct,
  type WriteRefusal,
} from "../rules/candidate-flow";
import { buildCandidateState, type HiringCandidateState } from "../rules/candidate-state";
import { toCandidateVersion } from "../rules/candidate-view";
import { isChoice, isRecorded, orderedActivities, orderedStages, type ContentActivity, type ContentStage, type VersionContent } from "../rules/content";
import { devicesNeeded } from "../rules/disclosure";
import { loadVersionContent } from "./content";

/**
 * The hiring candidate flow on the server (hiring solution design 2.4, 7).
 *
 * The rules this file keeps:
 *  - The token's invitation is the only credential; every id is derived from
 *    it, and every read is scoped to that invitation and its organisation.
 *    Stage and question ids are taken only from the invitation's own frozen
 *    version; an upload reference only through resolveOwnedMedia.
 *  - The server owns the clock: a stage's deadline is written once, at start,
 *    under the attempt's row lock; a reload reads it back. One overdue rule
 *    (rules/candidate-flow isOverdue, deadline plus SUBMIT_SLACK_MS) decides
 *    both when a write is refused and when the clock closes a run.
 *  - The server owns the order: a write names its stage and question and is
 *    refused rather than guessed (rules/candidate-flow writeRefusal). Runs are
 *    read under the attempt's lock, so a write never lands in a stage that a
 *    submit closed meanwhile; a submitted run is never a write's target.
 *  - Nothing the candidate receives is built from anything but
 *    toCandidateVersion and the candidate's own rows (rules/candidate-state).
 *  - Answers are never lost: the clock closes a stage with what was written,
 *    a late recording still attaches, an abandoned upload is salvaged.
 *  - Every closed run records who closed it (closed_by), and the last closed
 *    stage writes the invitation's completion.
 *  - A transaction reads and writes only through its own `tx`: a read on the
 *    global `db` inside one waits for a second pool connection, and enough
 *    simultaneous requests then hang every query in the app (Task 8 review).
 *    transaction-executor.test.ts checks this file for it.
 */

export type HiringContext = CandidateContext & {
  hiring: { openingId: string; versionId: string; extraTimePct: ExtraTimePct; consentTextId: string };
};

type RunRow = typeof hiringStageRuns.$inferSelect;
type ResponseRow = typeof hiringResponses.$inferSelect;
type Flow = { content: VersionContent; stages: ContentStage[]; attempt: typeof attempts.$inferSelect; runs: RunRow[] };

/** The invitation's own hiring terms, or null (not a hiring invitation, or none of its own). */
export async function loadHiringContext(ctx: CandidateContext): Promise<HiringContext | null> {
  if (ctx.assessment.solution !== "HIRING") return null;
  const [row] = await db
    .select({
      openingId: hiringAssessments.openingId,
      versionId: hiringAssessments.versionId,
      extraTimePct: hiringAssessments.extraTimePct,
      consentTextId: hiringAssessments.consentTextId,
    })
    .from(hiringAssessments)
    .where(and(eq(hiringAssessments.assessmentId, ctx.assessment.id), eq(hiringAssessments.orgId, ctx.assessment.orgId)))
    .limit(1);
  if (!row) return null;
  return {
    ...ctx,
    hiring: {
      openingId: row.openingId,
      versionId: row.versionId,
      extraTimePct: isExtraTimePct(row.extraTimePct) ? row.extraTimePct : 0,
      consentTextId: row.consentTextId,
    },
  };
}

/** The contract's `serves`: a HIRING invitation without its own row is answered like an unknown token. */
export async function hiringServes(ctx: CandidateContext): Promise<boolean> {
  return (await loadHiringContext(ctx)) !== null;
}

/** Outside any transaction: the invitation's version, its current attempt (created on first need) and that attempt's runs. */
async function loadFlow(h: HiringContext): Promise<Flow> {
  const content = await loadVersionContent(h.assessment.orgId, h.hiring.versionId);
  if (!content) throw new Error(`hiring version ${h.hiring.versionId} of invitation ${h.assessment.id} is missing`);
  const { attempt } = await currentAttempt(h.assessment);
  const runs = await db.select().from(hiringStageRuns).where(eq(hiringStageRuns.attemptId, attempt.id));
  return { content, stages: orderedStages(content), attempt, runs };
}

/** Attempt 1 is created before the transaction that then locks it (lockFlow never reaches the global db). */
async function ensureAttempt(h: HiringContext): Promise<void> {
  await currentAttempt(h.assessment);
}

/**
 * Inside a transaction, on its connection only: the version, the invitation's
 * newest attempt read and locked FOR NO KEY UPDATE, then that attempt's runs,
 * so nothing closes or starts a run under the caller. The caller ran
 * ensureAttempt before the transaction.
 */
async function lockFlow(h: HiringContext, tx: Executor): Promise<Flow> {
  const content = await loadVersionContent(h.assessment.orgId, h.hiring.versionId, tx);
  if (!content) throw new Error(`hiring version ${h.hiring.versionId} of invitation ${h.assessment.id} is missing`);
  const [attempt] = await tx
    .select()
    .from(attempts)
    .where(eq(attempts.assessmentId, h.assessment.id))
    .orderBy(desc(attempts.attemptNumber))
    .limit(1)
    .for("no key update");
  if (!attempt) throw new Error(`invitation ${h.assessment.id} has no attempt`);
  const runs = await tx.select().from(hiringStageRuns).where(eq(hiringStageRuns.attemptId, attempt.id));
  return { content, stages: orderedStages(content), attempt, runs };
}

/** The first stage this attempt has not submitted, with its run if it has one. Never a submitted run. */
function currentOf(flow: Pick<Flow, "stages" | "runs">): { index: number; stage: ContentStage; run: RunRow | null } | null {
  for (let index = 0; index < flow.stages.length; index += 1) {
    const stage = flow.stages[index];
    const run = flow.runs.find((r) => r.stageId === stage.id) ?? null;
    if (!run?.submittedAt) return { index, stage, run };
  }
  return null;
}

/** NO KEY UPDATE: serialises the attempt's writers without blocking inserts that reference the attempt (media assets). */
async function lockAttempt(x: Executor, attemptId: string) {
  await x.select({ id: attempts.id }).from(attempts).where(eq(attempts.id, attemptId)).for("no key update");
}

/** Consent read on the caller's executor (the core hasConsented reads the global db). */
async function consentedOn(x: Executor, assessmentId: string): Promise<boolean> {
  const [row] = await x.select({ id: consents.id }).from(consents).where(eq(consents.assessmentId, assessmentId)).limit(1);
  return !!row;
}

/**
 * Whether the question carries an answer right now: rules/candidate-flow
 * responseAnswered, plus a file still uploading, which counts like a take still
 * uploading (the stage may close before the upload ends; the file attaches afterwards).
 */
function answeredNow(activity: ContentActivity, payload: HiringResponsePayload, usableTakes: number): boolean {
  return responseAnswered(activity, payload, usableTakes > 0) || (activity.type === "FILE_UPLOAD" && !!payload.pendingFile);
}

/** Takes per response: how many count (not FAILED: an upload in progress counts) and the newest that counts. */
async function takeInfo(x: Executor, rows: ResponseRow[]) {
  const ids = rows.flatMap((r) => r.takeAssetIds);
  const media = ids.length
    ? await x.select({ id: mediaAssets.id, status: mediaAssets.status, durationMs: mediaAssets.durationMs }).from(mediaAssets).where(inArray(mediaAssets.id, ids))
    : [];
  const byId = new Map(media.map((m) => [m.id, m]));
  return (row: ResponseRow) => {
    const usable = row.takeAssetIds.map((id) => byId.get(id)).filter((m) => m && m.status !== "FAILED");
    const newest = [...row.takeAssetIds].reverse().map((id) => byId.get(id)).find((m) => m && m.status !== "FAILED") ?? null;
    return { usable: usable.length, newest };
  };
}

/** The server's own check that consent, details and (when something is recorded) the device check happened. */
async function ready(h: HiringContext, flow: Flow, x: Executor): Promise<boolean> {
  if (!(await consentedOn(x, h.assessment.id))) return false;
  if (!h.candidate.fullName || !h.candidate.email) return false;
  if (devicesNeeded(toCandidateVersion(flow.content)).microphone && !flow.attempt.deviceCheckedAt) return false;
  return true;
}

/**
 * Closes one run, idempotently (the first claim wins): the claim records who
 * closed it, every question with content counts as closed now, choice
 * questions get their score (0 when unanswered), and the completion follows
 * rules/candidate-flow runCompletion.
 */
async function closeRun(
  x: Executor,
  run: RunRow,
  stage: ContentStage,
  close: { reason: "SUBMIT" | "CLOCK"; late: boolean; closedBy: HiringRunClosedBy },
  now: Date,
): Promise<boolean> {
  const claimed = await x
    .update(hiringStageRuns)
    .set({ submittedAt: now, closedBy: close.closedBy })
    .where(and(eq(hiringStageRuns.id, run.id), isNull(hiringStageRuns.submittedAt)))
    .returning({ id: hiringStageRuns.id });
  if (claimed.length === 0) return false;
  // Locked, so an attachment finishing meanwhile waits and is not overwritten.
  const rows = await x.select().from(hiringResponses).where(eq(hiringResponses.stageRunId, run.id)).for("update");
  const takes = await takeInfo(x, rows);
  let requiredCount = 0;
  let answeredRequired = 0;
  let answeredAny = 0;
  for (const activity of orderedActivities(stage)) {
    const row = rows.find((r) => r.activityId === activity.id);
    const answered = row ? answeredNow(activity, row.payload, takes(row).usable) : false;
    if (activity.required) {
      requiredCount += 1;
      if (answered) answeredRequired += 1;
    }
    if (answered) answeredAny += 1;
    if (!row) continue;
    await x
      .update(hiringResponses)
      .set({
        answeredAt: row.answeredAt ?? (answered ? now : null),
        autoScore: isChoice(activity.type) ? autoScore(activity, answered ? row.payload : {}) : null,
        usedTextAlternative: !!row.payload.usedTextAlternative,
        updatedAt: now,
      })
      .where(eq(hiringResponses.id, row.id));
  }
  const ended = runCompletion({ reason: close.reason, late: close.late, behaviour: stage.onTimeout, requiredCount, answeredRequired, answeredAny });
  await x.update(hiringStageRuns).set({ completion: ended.completion, wasLate: ended.late }).where(eq(hiringStageRuns.id, run.id));
  return true;
}

/**
 * The last stage closes the attempt: the attempt's completion (what the finish
 * screen and its feedback date read), the link COMPLETED, the person's last contact now.
 */
async function finishIfDone(x: Executor, attemptId: string, assessmentId: string, candidateId: string, stageIds: string[], now: Date): Promise<boolean> {
  const runs = await x.select({ stageId: hiringStageRuns.stageId, submittedAt: hiringStageRuns.submittedAt }).from(hiringStageRuns).where(eq(hiringStageRuns.attemptId, attemptId));
  if (stageIds.length === 0 || !stageIds.every((id) => runs.some((r) => r.stageId === id && r.submittedAt))) return false;
  await x.update(attempts).set({ completedAt: now }).where(and(eq(attempts.id, attemptId), isNull(attempts.completedAt)));
  await x
    .update(assessmentLinks)
    .set({ status: "COMPLETED" })
    .where(and(eq(assessmentLinks.assessmentId, assessmentId), inArray(assessmentLinks.status, ["NOT_STARTED", "IN_PROGRESS"])));
  // The candidate clock of retention counts from the last contact.
  await x.update(candidates).set({ lastContactAt: now }).where(eq(candidates.id, candidateId));
  return true;
}

/** Closes the attempt's runs the clock ended (the one overdue rule) and finishes a complete attempt, under the attempt's lock. */
async function settleClock(h: HiringContext, flow: Flow, now: Date): Promise<boolean> {
  const overdue = flow.stages.filter((stage) => {
    const run = flow.runs.find((r) => r.stageId === stage.id);
    return !!run && isOverdue(run, stage.onTimeout, now);
  });
  const allSubmitted = flow.stages.length > 0 && flow.stages.every((s) => flow.runs.some((r) => r.stageId === s.id && r.submittedAt));
  if (overdue.length === 0 && (flow.attempt.completedAt || !allSubmitted)) return false;
  return db.transaction(async (tx) => {
    await lockAttempt(tx, flow.attempt.id);
    let changed = false;
    for (const stage of overdue) {
      const run = flow.runs.find((r) => r.stageId === stage.id)!;
      if (await closeRun(tx, run, stage, { reason: "CLOCK", late: true, closedBy: "CLOCK" }, now)) changed = true;
    }
    if (!flow.attempt.completedAt && (await finishIfDone(tx, flow.attempt.id, h.assessment.id, h.candidate.id, flow.stages.map((s) => s.id), now))) changed = true;
    return changed;
  });
}

export async function loadHiringState(h: HiringContext, now: Date = new Date()): Promise<HiringCandidateState> {
  let flow = await loadFlow(h);
  if (await settleClock(h, flow, now)) flow = await loadFlow(h);

  const [meta] = await db
    .select({
      orgName: organizations.name,
      orgContact: organizations.contactEmail,
      mediaDays: organizations.mediaRetentionDays,
      candidateDays: organizations.candidateRetentionDays,
      openingStatus: hiringOpenings.status,
      openingContact: hiringOpenings.candidateContactEmail,
      finishSurveyEnabled: hiringOpenings.finishSurveyEnabled,
      feedbackDays: hiringOpenings.feedbackDays,
      positionName: positions.name,
      introTitle: hiringVersions.introTitle,
      introBody: hiringVersions.introBody,
      practiceEnabled: hiringVersions.practiceEnabled,
    })
    .from(hiringOpenings)
    .innerJoin(organizations, eq(organizations.id, hiringOpenings.orgId))
    .innerJoin(positions, and(eq(positions.id, hiringOpenings.positionId), eq(positions.orgId, hiringOpenings.orgId)))
    .innerJoin(hiringVersions, and(eq(hiringVersions.id, h.hiring.versionId), eq(hiringVersions.orgId, hiringOpenings.orgId)))
    .where(and(eq(hiringOpenings.id, h.hiring.openingId), eq(hiringOpenings.orgId, h.assessment.orgId)))
    .limit(1);
  if (!meta) throw new Error(`hiring opening ${h.hiring.openingId} of invitation ${h.assessment.id} is missing`);
  const [reviewers] = await db.select({ n: sql<number>`count(*)::int` }).from(hiringAssignments).where(eq(hiringAssignments.assessmentId, h.assessment.id));
  const [survey] = await db.select({ id: hiringSurveyResponses.assessmentId }).from(hiringSurveyResponses).where(eq(hiringSurveyResponses.assessmentId, h.assessment.id)).limit(1);
  const current = currentOf(flow);
  const rows = current?.run ? await db.select().from(hiringResponses).where(eq(hiringResponses.stageRunId, current.run.id)) : [];
  const takes = await takeInfo(db, rows);

  return buildCandidateState({
    now,
    orgName: meta.orgName,
    contactEmail: meta.openingContact ?? meta.orgContact,
    retention: { mediaDays: meta.mediaDays, candidateDays: meta.candidateDays },
    opening: { status: meta.openingStatus, positionName: meta.positionName, finishSurveyEnabled: meta.finishSurveyEnabled, feedbackDays: meta.feedbackDays },
    version: { stages: flow.content.stages, introTitle: meta.introTitle, introBody: meta.introBody, practiceEnabled: meta.practiceEnabled },
    invitation: {
      candidateName: h.candidate.fullName,
      candidateEmail: h.candidate.email,
      extraTimePct: h.hiring.extraTimePct,
      reviewers: Number(reviewers?.n ?? 0),
      consented: await hasConsented(h.assessment.id),
      deviceChecked: !!flow.attempt.deviceCheckedAt,
      started: flow.runs.some((r) => r.startedAt),
      completedAt: flow.attempt.completedAt,
      surveyAnswered: !!survey,
    },
    runs: flow.runs.map((r) => ({ stageId: r.stageId, startedAt: r.startedAt, deadlineAt: r.deadlineAt, submittedAt: r.submittedAt, closedByClock: r.closedBy === "CLOCK" })),
    responses: current
      ? rows.map((r) => {
          const t = takes(r);
          return {
            stageId: current.stage.id,
            activityId: r.activityId,
            payload: r.payload,
            takesUsed: t.usable,
            answeredAt: r.answeredAt,
            // `ref` is the asset's own id, opaque to the candidate and checked by playbackUrl.
            recording: t.newest ? { ref: t.newest.id, status: t.newest.status, durationMs: t.newest.durationMs } : null,
          };
        })
      : [],
  });
}

export type StartRefusal = "NO_STAGE" | "NOT_READY" | "STAGE_MISMATCH" | "OPENING_CLOSED";

/**
 * Starts the current stage's clock: one run with its deadline (extra time read
 * inside the lock), one response row per question (decision 6), the attempt
 * and the link marked as started. Idempotent: a started stage is left as it is.
 */
export async function startStage(h: HiringContext, position: unknown, now: Date = new Date()): Promise<{ ok: true } | { ok: false; code: StartRefusal }> {
  await ensureAttempt(h);
  return db.transaction(async (tx) => {
    const flow = await lockFlow(h, tx);
    const current = currentOf(flow);
    if (!current) return { ok: false as const, code: "NO_STAGE" as const };
    if (position !== current.index + 1) return { ok: false as const, code: "STAGE_MISMATCH" as const };
    if (!(await ready(h, flow, tx))) return { ok: false as const, code: "NOT_READY" as const };
    if (current.run?.startedAt) return { ok: true as const };
    if (!flow.runs.some((r) => r.startedAt)) {
      // Decision 12: a closed opening stops only candidates who have not started (a DRAFT one is not open either).
      const [opening] = await tx
        .select({ status: hiringOpenings.status })
        .from(hiringOpenings)
        .where(and(eq(hiringOpenings.id, h.hiring.openingId), eq(hiringOpenings.orgId, h.assessment.orgId)))
        .limit(1);
      if (opening?.status !== "OPEN") return { ok: false as const, code: "OPENING_CLOSED" as const };
    }
    const [terms] = await tx
      .select({ pct: hiringAssessments.extraTimePct })
      .from(hiringAssessments)
      .where(and(eq(hiringAssessments.assessmentId, h.assessment.id), eq(hiringAssessments.orgId, h.assessment.orgId)))
      .limit(1);
    const pct: ExtraTimePct = isExtraTimePct(terms?.pct) ? terms.pct : 0;
    const [run] = await tx
      .insert(hiringStageRuns)
      .values({ attemptId: flow.attempt.id, stageId: current.stage.id, orderIndex: current.index, startedAt: now, deadlineAt: stageDeadline(now, current.stage, pct) })
      .onConflictDoNothing()
      .returning({ id: hiringStageRuns.id });
    const activities = orderedActivities(current.stage);
    if (run && activities.length) {
      await tx
        .insert(hiringResponses)
        .values(activities.map((a) => ({ stageRunId: run.id, activityId: a.id })))
        .onConflictDoNothing();
    }
    await tx.update(attempts).set({ startedAt: now }).where(and(eq(attempts.id, flow.attempt.id), isNull(attempts.startedAt)));
    await tx.update(assessmentLinks).set({ status: "IN_PROGRESS" }).where(and(eq(assessmentLinks.id, h.link.id), eq(assessmentLinks.status, "NOT_STARTED")));
    return { ok: true as const };
  });
}

type Target = { run: RunRow; stage: ContentStage; activity: ContentActivity; response: ResponseRow };

/**
 * The running stage's question this write names, or the refusal
 * (rules/candidate-flow writeRefusal). Runs are read under the attempt's lock
 * and `current` is never a submitted run, so a submitted stage refuses writes.
 */
async function writeTarget(h: HiringContext, x: Executor, position: unknown, activityId: unknown, now: Date): Promise<{ ok: true; target: Target } | { ok: false; code: WriteRefusal }> {
  const flow = await lockFlow(h, x);
  const current = currentOf(flow);
  const rows = current?.run ? await x.select().from(hiringResponses).where(eq(hiringResponses.stageRunId, current.run.id)) : [];
  const activities = current ? orderedActivities(current.stage) : [];
  const refusal = writeRefusal({
    current: current
      ? { position: current.index + 1, startedAt: current.run?.startedAt ?? null, deadlineAt: current.run?.deadlineAt ?? null, onTimeout: current.stage.onTimeout, backNavigation: current.stage.backNavigation }
      : null,
    position,
    activityId,
    activities: activities.map((a) => ({ id: a.id, closed: !!rows.find((r) => r.activityId === a.id)?.answeredAt })),
    now,
  });
  if (refusal) return { ok: false, code: refusal };
  // writeRefusal's write window is exactly the complement of isOverdue; said once more with the sweep's own rule.
  if (current?.run && isOverdue(current.run, current.stage.onTimeout, now)) return { ok: false, code: "STAGE_EXPIRED" };
  const activity = activities.find((a) => a.id === activityId);
  const response = activity ? rows.find((r) => r.activityId === activity.id) : undefined;
  if (!current?.run || !activity || !response) return { ok: false, code: "ACTIVITY_NOT_FOUND" };
  return { ok: true, target: { run: current.run, stage: current.stage, activity, response } };
}

/** Writes the draft of an open question (any question of a stage with a way back). */
async function autosave(tx: Executor, target: Target, payload: HiringResponsePayload, now: Date) {
  await tx
    .update(hiringResponses)
    .set({ payload, usedTextAlternative: !!payload.usedTextAlternative, updatedAt: now })
    .where(target.stage.backNavigation ? eq(hiringResponses.id, target.response.id) : and(eq(hiringResponses.id, target.response.id), isNull(hiringResponses.answeredAt)));
}

/** Autosave of one question. Nothing is closed or scored until the candidate moves on. */
export async function saveResponse(
  h: HiringContext,
  input: { position: unknown; activityId: unknown; answer: unknown },
  now: Date = new Date(),
): Promise<{ ok: true; at: string } | { ok: false; code: WriteRefusal }> {
  await ensureAttempt(h);
  return db.transaction(async (tx) => {
    const found = await writeTarget(h, tx, input.position, input.activityId, now);
    if (!found.ok) return found;
    const { target } = found;
    // Locked, so an upload attached meanwhile is part of `previous` and kept.
    const [row] = await tx.select().from(hiringResponses).where(eq(hiringResponses.id, target.response.id)).for("update");
    const payload = sanitizeResponse(target.activity, input.answer, row?.payload ?? target.response.payload);
    await autosave(tx, target, payload, now);
    return { ok: true as const, at: now.toISOString() };
  });
}

/** "Sonraki soru": closes the question (with the answer sent along, if any); a required one needs an answer. */
export async function commitResponse(
  h: HiringContext,
  input: { position: unknown; activityId: unknown; answer?: unknown },
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; code: WriteRefusal | "REQUIRED_MISSING" }> {
  await ensureAttempt(h);
  return db.transaction(async (tx) => {
    const found = await writeTarget(h, tx, input.position, input.activityId, now);
    if (!found.ok) return found;
    const { target } = found;
    const [row] = await tx.select().from(hiringResponses).where(eq(hiringResponses.id, target.response.id)).for("update");
    const current = row ?? target.response;
    const payload = input.answer === undefined ? current.payload : sanitizeResponse(target.activity, input.answer, current.payload);
    const takes = await takeInfo(tx, [current]);
    const answered = answeredNow(target.activity, payload, takes(current).usable);
    if (target.activity.required && !answered) {
      // What the candidate sent is kept as a draft, the question stays open.
      if (input.answer !== undefined) await autosave(tx, target, payload, now);
      return { ok: false as const, code: "REQUIRED_MISSING" as const };
    }
    await tx
      .update(hiringResponses)
      .set({
        payload,
        answeredAt: now,
        autoScore: isChoice(target.activity.type) ? autoScore(target.activity, payload) : null,
        usedTextAlternative: !!payload.usedTextAlternative,
        updatedAt: now,
      })
      .where(eq(hiringResponses.id, current.id));
    return { ok: true as const };
  });
}

export type SubmitRefusal = "NO_STAGE" | "STAGE_MISMATCH" | "STAGE_NOT_STARTED" | "REQUIRED_MISSING";

/**
 * "Aşamayı bitir" and the client's submit at 0:00. Before the deadline every
 * required question needs an answer; after it the stage closes with what it
 * has (lib/timer submitDecision). The run records who closed it
 * (rules/candidate-flow closedByOf); the last stage finishes the attempt.
 */
export async function submitStage(
  h: HiringContext,
  position: unknown,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; code: SubmitRefusal; missing?: string[] }> {
  await ensureAttempt(h);
  return db.transaction(async (tx) => {
    const flow = await lockFlow(h, tx);
    const current = currentOf(flow);
    if (!current) return { ok: false as const, code: "NO_STAGE" as const };
    if (position !== current.index + 1) return { ok: false as const, code: "STAGE_MISMATCH" as const };
    const run = current.run;
    if (!run?.startedAt) return { ok: false as const, code: "STAGE_NOT_STARTED" as const };
    const rows = await tx.select().from(hiringResponses).where(eq(hiringResponses.stageRunId, run.id));
    const takes = await takeInfo(tx, rows);
    const activities = orderedActivities(current.stage);
    const missing = missingRequired(activities, (id) => {
      const row = rows.find((r) => r.activityId === id);
      const activity = activities.find((a) => a.id === id)!;
      return !!row && answeredNow(activity, row.payload, takes(row).usable);
    });
    const decision = submitDecision({ deadlineAt: run.deadlineAt, behaviour: current.stage.onTimeout, missingRequired: missing.length, now });
    if (decision.kind === "REJECT_REQUIRED") return { ok: false as const, code: "REQUIRED_MISSING" as const, missing };
    const reason = decision.expired ? "CLOCK" : "SUBMIT";
    // This is a submit (by hand or the client's 0:00), whatever completion path it takes: under ALLOW_LATE it is always the candidate's.
    const closedBy = closedByOf({ reason: "SUBMIT", deadlineAt: run.deadlineAt, onTimeout: current.stage.onTimeout, now });
    await closeRun(tx, run, current.stage, { reason, late: decision.late, closedBy }, now);
    await finishIfDone(tx, flow.attempt.id, h.assessment.id, h.candidate.id, flow.stages.map((s) => s.id), now);
    return { ok: true as const };
  });
}

/** Decision 5: 0, 25 or 50, changeable while no stage runs; stages started afterwards get it. */
export async function setExtraTime(
  h: HiringContext,
  pct: unknown,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; code: "EXTRA_TIME_INVALID" | "EXTRA_TIME_LOCKED" | "ALREADY_COMPLETED" }> {
  if (!isExtraTimePct(pct)) return { ok: false, code: "EXTRA_TIME_INVALID" };
  await ensureAttempt(h);
  return db.transaction(async (tx) => {
    // completedAt and the runs are read after the attempt's lock.
    const flow = await lockFlow(h, tx);
    if (flow.attempt.completedAt) return { ok: false as const, code: "ALREADY_COMPLETED" as const };
    if (extraTimeRefusal(flow.runs)) return { ok: false as const, code: "EXTRA_TIME_LOCKED" as const };
    await tx
      .update(hiringAssessments)
      .set({ extraTimePct: pct, extraTimeChosenAt: now })
      .where(and(eq(hiringAssessments.assessmentId, h.assessment.id), eq(hiringAssessments.orgId, h.assessment.orgId)));
    h.hiring.extraTimePct = pct;
    return { ok: true as const };
  });
}

/** The core heartbeat: marks the running stage alive (salvage waits for a quiet tab) and returns its deadline. */
export async function stageHeartbeat(h: HiringContext, now: Date = new Date()): Promise<{ deadlineAt: Date | null }> {
  // Only the invitation's current attempt: a retake's older attempt never takes the beat.
  const { attempt } = await currentAttempt(h.assessment);
  const [run] = await db
    .select({ id: hiringStageRuns.id, deadlineAt: hiringStageRuns.deadlineAt })
    .from(hiringStageRuns)
    .where(and(eq(hiringStageRuns.attemptId, attempt.id), isNotNull(hiringStageRuns.startedAt), isNull(hiringStageRuns.submittedAt)))
    .orderBy(asc(hiringStageRuns.orderIndex))
    .limit(1);
  if (!run) return { deadlineAt: null };
  await db.update(hiringStageRuns).set({ lastHeartbeatAt: now }).where(eq(hiringStageRuns.id, run.id));
  return { deadlineAt: run.deadlineAt };
}

/** The running stage run, named for proctoring records (spec 5: segment_kind 'stage_run'). */
export async function runningSegment(attemptId: string): Promise<{ kind: string; runId: string } | null> {
  const [run] = await db
    .select({ id: hiringStageRuns.id })
    .from(hiringStageRuns)
    .where(and(eq(hiringStageRuns.attemptId, attemptId), isNotNull(hiringStageRuns.startedAt), isNull(hiringStageRuns.submittedAt)))
    .limit(1);
  return run ? { kind: "stage_run", runId: run.id } : null;
}

export type MediaRefusal =
  | WriteRefusal
  | "NOT_A_RECORDING"
  | "NOT_A_FILE"
  | "TAKES_EXHAUSTED"
  | "FILE_TYPE_REJECTED"
  | "FILE_TOO_LARGE"
  | "FILE_EMPTY"
  | "RECORDING_TYPE_REJECTED"
  | "RECORDING_TOO_LARGE";
export type UploadOpened = {
  uploadRef: string;
  mime: string;
  minPartBytes: number;
  proxy: boolean;
  partTargets: Array<{ partNumber: number; url: string; proxy: boolean }>;
  /** A recording's caps, for the recorder to stop at: bytes always, duration when the question sets an answer time. */
  limits: { maxBytes: number; maxDurationMs: number | null } | null;
};

/** Part targets handed out with the upload; more come from the core /media/part-urls. */
const PREFETCH_PARTS = 24;
/** The most one take may weigh (well above a 10 minute 1080p WebM). */
export const RECORDING_MAX_BYTES = 1024 * 1024 * 1024;
/** Same margin as lib/timer isMediaOverlong: encoder overshoot on the last chunk, not a bonus. */
const durationCapMs = (answerSeconds: number | null): number | null => (answerSeconds && answerSeconds > 0 ? Math.ceil(answerSeconds * 1000 * 1.1) : null);

/**
 * Opens one upload for the running question: a take of a video or audio
 * question (decision 8: counted on the server under the response's lock; its
 * container must be of the question's kind) or the file of a file question
 * (decision 11). The asset belongs to the invitation's organisation and
 * attempt, and its storage key is derived from ids the server owns. A take
 * whose storage upload cannot open is FAILED and so given back, and the
 * question's answer is decided again. A crash before the storage upload opens
 * leaves an UPLOADING row without an upload id, which salvageHiringUploads
 * expires (FAILED) after SALVAGE_MIN_AGE_MS.
 */
export async function openUpload(
  h: HiringContext,
  input: { position: unknown; activityId: unknown; kind: unknown; mime: unknown; name?: unknown; bytes?: unknown },
  now: Date = new Date(),
): Promise<{ ok: true; upload: UploadOpened } | { ok: false; code: MediaRefusal }> {
  const rawMime = typeof input.mime === "string" ? input.mime : undefined;
  await ensureAttempt(h);
  const opened = await db.transaction(async (tx) => {
    const found = await writeTarget(h, tx, input.position, input.activityId, now);
    if (!found.ok) return found;
    const { target } = found;
    const [row] = await tx.select().from(hiringResponses).where(eq(hiringResponses.id, target.response.id)).for("update");
    const response = row ?? target.response;
    if (input.kind === "file") {
      if (target.activity.type !== "FILE_UPLOAD") return { ok: false as const, code: "NOT_A_FILE" as const };
      const mime = normaliseFileMime(rawMime, target.activity.config.acceptedMimeTypes);
      if (mime === null) return { ok: false as const, code: "FILE_TYPE_REJECTED" as const };
      const bytes = Number(input.bytes);
      if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false as const, code: "FILE_EMPTY" as const };
      if (bytes > (target.activity.config.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES)) return { ok: false as const, code: "FILE_TOO_LARGE" as const };
      const [asset] = await tx
        .insert(mediaAssets)
        .values({ orgId: h.assessment.orgId, attemptId: target.run.attemptId, storageKey: "pending", mime, status: "UPLOADING", parts: [] })
        .returning();
      const payload: HiringResponsePayload = { ...response.payload, pendingFile: { assetId: asset.id, name: cleanFileName(input.name), bytes: Math.round(bytes), mime } };
      await tx.update(hiringResponses).set({ payload, updatedAt: now }).where(eq(hiringResponses.id, response.id));
      return { ok: true as const, asset, runId: target.run.id, limits: null };
    }
    if (input.kind !== "recording" || !isRecorded(target.activity.type)) return { ok: false as const, code: "NOT_A_RECORDING" as const };
    const family = target.activity.type === "AUDIO" ? "audio/" : "video/";
    const base = (rawMime ?? "").split(";")[0].trim().toLowerCase();
    // An audio question never stores a video, and a video question never only sound.
    if (base && !base.startsWith(family)) return { ok: false as const, code: "RECORDING_TYPE_REJECTED" as const };
    if (input.bytes !== undefined && !(Number(input.bytes) <= RECORDING_MAX_BYTES)) return { ok: false as const, code: "RECORDING_TOO_LARGE" as const };
    const used = (await takeInfo(tx, [response]))(response).usable;
    if (used >= target.activity.maxTakes) return { ok: false as const, code: "TAKES_EXHAUSTED" as const };
    const mime = normaliseMime(rawMime, `${family}webm`);
    const [asset] = await tx
      .insert(mediaAssets)
      .values({ orgId: h.assessment.orgId, attemptId: target.run.attemptId, storageKey: "pending", mime, status: "UPLOADING", parts: [] })
      .returning();
    await tx
      .update(hiringResponses)
      .set({ takeAssetIds: [...response.takeAssetIds, asset.id], takesUsed: used + 1, updatedAt: now })
      .where(eq(hiringResponses.id, response.id));
    return { ok: true as const, asset, runId: target.run.id, limits: { maxBytes: RECORDING_MAX_BYTES, maxDurationMs: durationCapMs(target.activity.answerSeconds) } };
  });
  if (!opened.ok) return opened;
  try {
    const storage = getStorage();
    const key = mediaKey({ orgId: h.assessment.orgId, assessmentId: h.assessment.id, stageRunId: opened.runId, mediaId: opened.asset.id, mime: opened.asset.mime });
    const { uploadId } = await storage.initUpload(key, opened.asset.mime);
    await db.update(mediaAssets).set({ storageKey: key, uploadId }).where(eq(mediaAssets.id, opened.asset.id));
    const partTargets = await storage.signPartUrls(key, uploadId, Array.from({ length: PREFETCH_PARTS }, (_, i) => i + 1));
    return {
      ok: true,
      upload: { uploadRef: opened.asset.id, mime: opened.asset.mime, minPartBytes: storage.minPartBytes, proxy: partTargets[0]?.proxy ?? true, partTargets, limits: opened.limits },
    };
  } catch (error) {
    await failMedia(opened.asset.id);
    // The take is given back: an older finished take becomes the answer again, a pending file is cleared.
    await attachMedia({ ...opened.asset, status: "FAILED" }).catch((settleError: unknown) => console.error(`[hiring] could not settle ${opened.asset.id}`, settleError));
    throw error;
  }
}

/** A response row whose take list or pending file names this asset. */
const ownsAsset = (assetId: string) =>
  sql`(${hiringResponses.takeAssetIds} @> ${JSON.stringify([assetId])}::jsonb OR ${hiringResponses.payload} -> 'pendingFile' ->> 'assetId' = ${assetId})`;

/**
 * Decides the answer of the response that owns this asset, whenever one of its
 * uploads ends: the module's onMediaComplete and onMediaFailed, the salvage,
 * and an upload that could not open all call it with the asset's new status.
 *
 * A recording question's answer is the newest take that finished (READY or
 * INCOMPLETE) with no newer take that can still become it (decision 8): a
 * newer take still uploading keeps the decision open, a newer FAILED take
 * gives the place back. A finished file is attached under the candidate's own
 * name when it is complete and within its size, a failed or partial one only
 * clears the pending upload (decision 11). The response is found through the
 * asset's own attempt and held FOR UPDATE while this decides (C14). A
 * completion after the stage closed still attaches: the answer is the candidate's.
 */
export async function attachMedia(asset: MediaAssetRow): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ response: hiringResponses, activity: { type: hiringActivities.type, config: hiringActivities.config } })
      .from(hiringResponses)
      .innerJoin(hiringStageRuns, eq(hiringStageRuns.id, hiringResponses.stageRunId))
      .innerJoin(hiringActivities, eq(hiringActivities.id, hiringResponses.activityId))
      .where(and(eq(hiringStageRuns.attemptId, asset.attemptId), ownsAsset(asset.id)))
      .limit(1)
      .for("update", { of: hiringResponses });
    if (!row) return;
    const { response, activity } = row;
    const now = new Date();
    if (activity.type === "FILE_UPLOAD") {
      const pending = response.payload.pendingFile;
      if (!pending || pending.assetId !== asset.id) return;
      // Still uploading: nothing to decide yet.
      if (asset.status === "UPLOADING") return;
      const { pendingFile: _done, ...rest } = response.payload;
      void _done;
      const max = activity.config.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
      if (asset.status !== "READY" || (asset.bytes ?? 0) > max) {
        await tx.update(hiringResponses).set({ payload: rest, updatedAt: now }).where(eq(hiringResponses.id, response.id));
        return;
      }
      await tx
        .update(hiringResponses)
        .set({ fileAssetIds: [asset.id], payload: { ...rest, file: { name: pending.name, bytes: asset.bytes ?? pending.bytes, mime: asset.mime } }, updatedAt: now })
        .where(eq(hiringResponses.id, response.id));
      return;
    }
    if (!response.takeAssetIds.includes(asset.id)) return;
    const others = response.takeAssetIds.filter((id) => id !== asset.id);
    const states = others.length ? await tx.select({ id: mediaAssets.id, status: mediaAssets.status }).from(mediaAssets).where(inArray(mediaAssets.id, others)) : [];
    // The asset in hand carries its new status; the others are read under the response's lock.
    const statusOf = (id: string) => (id === asset.id ? asset.status : states.find((m) => m.id === id)?.status);
    let answer: string | null = null;
    for (const id of [...response.takeAssetIds].reverse()) {
      const status = statusOf(id);
      if (status === "FAILED") continue;
      if (status === "READY" || status === "INCOMPLETE") answer = id;
      // Uploading (or unknown): this newer take may still become the answer, so the decision waits.
      break;
    }
    if (!answer || (answer === response.mediaAssetId && !response.payload.usedTextAlternative)) return;
    const { usedTextAlternative: _alternative, ...payload } = response.payload;
    void _alternative;
    await tx.update(hiringResponses).set({ mediaAssetId: answer, payload, usedTextAlternative: false, updatedAt: now }).where(eq(hiringResponses.id, response.id));
  });
}

export type PlaybackResult = { ok: true; url: string } | { ok: false; code: "UPLOAD_NOT_FOUND" | "MEDIA_NOT_READY" };

/**
 * HIRING-UX 6.6 review: a short-lived URL to the candidate's own take. Only a
 * take of this invitation's answers plays; one still uploading (or failed)
 * answers MEDIA_NOT_READY, so the screen can say "Kaydediliyor" instead of failing.
 */
export async function playbackUrl(h: HiringContext, ref: unknown): Promise<PlaybackResult> {
  const owned = await resolveOwnedMedia(h, ref);
  if (!owned) return { ok: false, code: "UPLOAD_NOT_FOUND" };
  const [take] = await db
    .select({ id: hiringResponses.id })
    .from(hiringResponses)
    .innerJoin(hiringStageRuns, eq(hiringStageRuns.id, hiringResponses.stageRunId))
    .where(and(eq(hiringStageRuns.attemptId, owned.asset.attemptId), sql`${hiringResponses.takeAssetIds} @> ${JSON.stringify([owned.asset.id])}::jsonb`))
    .limit(1);
  if (!take) return { ok: false, code: "UPLOAD_NOT_FOUND" };
  if (owned.asset.status !== "READY" && owned.asset.status !== "INCOMPLETE") return { ok: false, code: "MEDIA_NOT_READY" };
  return { ok: true, url: await getStorage().getSignedUrl(owned.asset.storageKey, 600) };
}

/** HIRING-UX 6.13: one survey answer per invitation, after the finish, when the opening asks for it. */
export async function saveSurvey(
  h: HiringContext,
  input: { rating: unknown; comment: unknown },
): Promise<{ ok: true } | { ok: false; code: "NOT_FINISHED" | "SURVEY_OFF" | "SURVEY_INVALID" | "ALREADY_ANSWERED" }> {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, code: "SURVEY_INVALID" };
  const comment = typeof input.comment === "string" ? input.comment.trim().slice(0, 1000) : "";
  const [state] = await db
    .select({ completedAt: attempts.completedAt, enabled: hiringOpenings.finishSurveyEnabled })
    .from(attempts)
    .innerJoin(hiringAssessments, eq(hiringAssessments.assessmentId, attempts.assessmentId))
    .innerJoin(hiringOpenings, and(eq(hiringOpenings.id, hiringAssessments.openingId), eq(hiringOpenings.orgId, hiringAssessments.orgId)))
    .where(and(eq(attempts.assessmentId, h.assessment.id), eq(hiringAssessments.orgId, h.assessment.orgId)))
    .orderBy(desc(attempts.attemptNumber))
    .limit(1);
  if (!state?.completedAt) return { ok: false, code: "NOT_FINISHED" };
  if (!state.enabled) return { ok: false, code: "SURVEY_OFF" };
  const written = await db
    .insert(hiringSurveyResponses)
    .values({ assessmentId: h.assessment.id, rating, comment: comment || null })
    .onConflictDoNothing()
    .returning({ id: hiringSurveyResponses.assessmentId });
  return written.length ? { ok: true } : { ok: false, code: "ALREADY_ANSWERED" };
}

/** What a problem report calls this invitation: the opening's name, for the team. */
export async function hiringTitle(h: HiringContext): Promise<string> {
  const [row] = await db
    .select({ name: hiringOpenings.name })
    .from(hiringOpenings)
    .where(and(eq(hiringOpenings.id, h.hiring.openingId), eq(hiringOpenings.orgId, h.assessment.orgId)))
    .limit(1);
  return row?.name ?? "";
}

/**
 * Cron (the module's attempts.closeExpired): closes stage runs whose clock ran
 * out for candidates who closed the tab, and finishes attempts whose last stage
 * that was. The query narrows by the same rule as isOverdue (deadline plus the
 * write slack, never ALLOW_LATE) and every row is checked with isOverdue itself
 * against the invitation's own frozen version, so the sweep never closes a run
 * the write path would still accept. Idempotent: a closed run no longer matches.
 */
export async function closeExpiredStageRuns(now: Date = new Date(), limit = 50): Promise<{ scanned: number; closed: number }> {
  const due = new Date(now.getTime() - SUBMIT_SLACK_MS);
  const rows = await db
    .select({ run: hiringStageRuns, versionId: hiringAssessments.versionId, orgId: hiringAssessments.orgId, assessmentId: attempts.assessmentId, candidateId: assessments.candidateId })
    .from(hiringStageRuns)
    .innerJoin(hiringStages, eq(hiringStages.id, hiringStageRuns.stageId))
    .innerJoin(attempts, eq(attempts.id, hiringStageRuns.attemptId))
    .innerJoin(hiringAssessments, eq(hiringAssessments.assessmentId, attempts.assessmentId))
    .innerJoin(assessments, and(eq(assessments.id, attempts.assessmentId), eq(assessments.orgId, hiringAssessments.orgId)))
    .where(and(isNull(hiringStageRuns.submittedAt), isNotNull(hiringStageRuns.deadlineAt), lt(hiringStageRuns.deadlineAt, due), ne(hiringStages.onTimeout, "ALLOW_LATE")))
    .orderBy(asc(hiringStageRuns.deadlineAt))
    .limit(limit);
  const versions = new Map<string, VersionContent | null>();
  let closed = 0;
  for (const row of rows) {
    try {
      const cacheKey = `${row.orgId}:${row.versionId}`;
      if (!versions.has(cacheKey)) versions.set(cacheKey, await loadVersionContent(row.orgId, row.versionId));
      const content = versions.get(cacheKey);
      const stages = content ? orderedStages(content) : [];
      const stage = stages.find((s) => s.id === row.run.stageId);
      if (!stage) {
        console.error(`[hiring] stage run ${row.run.id} is not in its invitation's version ${row.versionId}; left open`);
        continue;
      }
      if (!isOverdue(row.run, stage.onTimeout, now)) continue;
      const done = await db.transaction(async (tx) => {
        await lockAttempt(tx, row.run.attemptId);
        const ok = await closeRun(tx, row.run, stage, { reason: "CLOCK", late: true, closedBy: "CLOCK" }, now);
        if (ok) await finishIfDone(tx, row.run.attemptId, row.assessmentId, row.candidateId, stages.map((s) => s.id), now);
        return ok;
      });
      if (done) closed += 1;
    } catch (error) {
      console.error(`[hiring] could not close stage run ${row.run.id}`, error);
    }
  }
  return { scanned: rows.length, closed };
}

/**
 * Cron: finalises hiring uploads whose browser never came back (lib/stage-timeout
 * decideSalvage on the owning stage run), as INCOMPLETE, attaches them like a
 * completion would, and sends recordings to transcription (the job reads the
 * hiring manifest's transcriptionHint: none, the provider detects the
 * language). A row whose storage upload never opened is expired (FAILED).
 * Every FAILED take re-decides its question's answer (attachMedia). The
 * exam's sweep takes only uploads with a section run.
 */
export async function salvageHiringUploads(now: Date = new Date(), limit = 20): Promise<{ scanned: number; salvaged: number; failed: number; skipped: number }> {
  const oldEnough = new Date(now.getTime() - SALVAGE_MIN_AGE_MS);
  const result = { scanned: 0, salvaged: 0, failed: 0, skipped: 0 };
  // An upload whose storage side never opened (a crash between the row and the
  // storage call) can never complete: it is given back, and its answer decided again.
  const neverOpened = await db
    .update(mediaAssets)
    .set({ status: "FAILED" })
    .where(
      and(
        sql`${mediaAssets.attemptId} in (select ${attempts.id} from ${attempts} where ${attempts.solution} = 'HIRING')`,
        isNull(mediaAssets.sectionRunId),
        eq(mediaAssets.status, "UPLOADING"),
        lt(mediaAssets.createdAt, oldEnough),
        or(isNull(mediaAssets.uploadId), eq(mediaAssets.storageKey, "pending")),
      ),
    )
    .returning();
  for (const asset of neverOpened) {
    result.failed += 1;
    await attachMedia(asset).catch((error: unknown) => console.error(`[hiring] could not settle ${asset.id}`, error));
  }
  const rows = await db
    .select({ asset: mediaAssets })
    .from(mediaAssets)
    .innerJoin(attempts, eq(attempts.id, mediaAssets.attemptId))
    .where(
      and(
        eq(attempts.solution, "HIRING"),
        isNull(mediaAssets.sectionRunId),
        eq(mediaAssets.status, "UPLOADING"),
        lt(mediaAssets.createdAt, oldEnough),
        isNotNull(mediaAssets.uploadId),
        like(mediaAssets.storageKey, "media/%"),
      ),
    )
    .orderBy(asc(mediaAssets.createdAt))
    .limit(limit);
  result.scanned = rows.length;
  const storage = getStorage();
  for (const { asset } of rows) {
    try {
      const [owner] = await db
        .select({ completion: hiringStageRuns.completion, deadlineAt: hiringStageRuns.deadlineAt, lastHeartbeatAt: hiringStageRuns.lastHeartbeatAt })
        .from(hiringResponses)
        .innerJoin(hiringStageRuns, eq(hiringStageRuns.id, hiringResponses.stageRunId))
        .where(and(eq(hiringStageRuns.attemptId, asset.attemptId), ownsAsset(asset.id)))
        .limit(1);
      if (decideSalvage({ assetCreatedAt: asset.createdAt, run: owner ?? null }, now).action === "SKIP") {
        result.skipped += 1;
        continue;
      }
      const { bytes, parts } = await storage.salvage(asset.storageKey, asset.uploadId!);
      if (bytes === 0) {
        const [failedAsset] = await db
          .update(mediaAssets)
          .set({ status: "FAILED" })
          .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.status, "UPLOADING")))
          .returning();
        result.failed += 1;
        // The take is given back: an older finished take becomes the answer again.
        if (failedAsset) await attachMedia(failedAsset);
        continue;
      }
      const [updated] = await db
        .update(mediaAssets)
        .set({ status: "INCOMPLETE", bytes, parts })
        .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.status, "UPLOADING")))
        .returning();
      if (!updated) {
        result.skipped += 1;
        continue;
      }
      await attachMedia(updated);
      if (isTranscribableMime(updated.mime)) await enqueueTranscription(updated.id);
      result.salvaged += 1;
    } catch (error) {
      console.error(`[hiring] salvage failed for ${asset.id}`, error);
    }
  }
  return result;
}
