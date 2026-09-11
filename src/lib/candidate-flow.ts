import { and, asc, desc, eq, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  assessmentLinks,
  assessments,
  attempts,
  candidates,
  consents,
  consentTexts,
  mediaAssets,
  organizations,
  positions,
  responses,
  stageRuns,
  stages,
  technicalEvents,
  templates,
  templateVersions,
  users,
} from "@/db/schema";
import type { ActivityConfig, ResponsePayload } from "@/db/schema/types";
import {
  candidateActivityColumns,
  candidateStageColumns,
  candidateVersionColumns,
  pickText,
  type CandidateLocale,
} from "@/lib/candidate-safe";
import { sha256 } from "@/lib/auth";
import {
  acceptsWrite,
  computeDeadline,
  isLate,
  remainingMs as remainingUntil,
} from "@/lib/timer";

/**
 * Every candidate-facing decision is made here, on the server.
 *
 * Two rules drive the whole file:
 *  1. The client never names a record. It sends a token and, at most, an index
 *     inside the stage the server itself decided the candidate is on. Server
 *     resolves the assessment, the attempt, the stage and the activity.
 *  2. The clock belongs to the server. `deadline_at` is written once when the
 *     stage starts and read back verbatim afterwards, so a refresh neither
 *     resets nor extends the remaining time.
 */

export type LinkProblem = "INVALID" | "NOT_YET" | "EXPIRED" | "COMPLETED";

export type CandidateContext = {
  rawToken: string;
  link: typeof assessmentLinks.$inferSelect;
  assessment: typeof assessments.$inferSelect;
  candidate: typeof candidates.$inferSelect;
  version: {
    id: string;
    defaultLocale: "tr" | "en";
    localeSet: Array<"tr" | "en"> | null;
    introTitle: { tr: string; en: string } | null;
    introBody: { tr: string; en: string } | null;
    consentTextId: string | null;
  };
  /**
   * The manager's own label for the position, used only as the fallback title
   * when the template version has no candidate-facing `introTitle` yet. It is
   * an internal label ("Kıdemli Ürün Tasarımcısı (Q4 backfill)") and never
   * reaches the candidate on its own.
   */
  positionName: string;
  orgName: string;
  /** Who to write to. The recruiter who sent the link, or the org fallback. */
  contactEmail: string;
  /** The recruiter's name, so "your request goes to the hiring team" can name
   *  the person it actually goes to. Null when the inviter row is gone. */
  contactName: string | null;
  /** The org's real media retention, so the intro can promise a real number. */
  mediaRetentionDays: number;
  locale: CandidateLocale;
};

export type ResolveResult =
  | { ok: true; ctx: CandidateContext }
  | { ok: false; problem: LinkProblem; ctx?: CandidateContext };

/**
 * Turns the raw URL token into an assessment, or into the reason it cannot.
 * The four failure shapes are the four candidate error screens.
 */
export async function resolveToken(rawToken: string): Promise<ResolveResult> {
  // Cheap shape check before touching the database, so junk never hits it.
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(rawToken)) {
    return { ok: false, problem: "INVALID" };
  }

  const rows = await db
    .select({
      link: assessmentLinks,
      assessment: assessments,
      candidate: candidates,
      version: candidateVersionColumns,
      positionName: positions.name,
      orgName: organizations.name,
      mediaRetentionDays: organizations.mediaRetentionDays,
      inviterEmail: users.email,
      inviterName: users.name,
    })
    .from(assessmentLinks)
    .innerJoin(
      assessments,
      eq(assessments.id, assessmentLinks.assessmentId),
    )
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .innerJoin(templateVersions, eq(templateVersions.id, assessments.versionId))
    .innerJoin(templates, eq(templates.id, templateVersions.templateId))
    .innerJoin(positions, eq(positions.id, templates.positionId))
    .innerJoin(organizations, eq(organizations.id, assessments.orgId))
    .leftJoin(users, eq(users.id, assessments.invitedBy))
    .where(eq(assessmentLinks.tokenHash, sha256(rawToken)))
    .limit(1);

  const row = rows[0];
  if (!row) return { ok: false, problem: "INVALID" };
  if (row.candidate.deletedAt) return { ok: false, problem: "INVALID" };

  const ctx: CandidateContext = {
    rawToken,
    link: row.link,
    assessment: row.assessment,
    candidate: row.candidate,
    version: row.version,
    positionName: row.positionName,
    orgName: row.orgName,
    contactEmail:
      row.inviterEmail ?? process.env.SUPPORT_EMAIL ?? "destek@kademe.local",
    contactName: row.inviterName ?? null,
    mediaRetentionDays: row.mediaRetentionDays,
    locale: row.assessment.locale as CandidateLocale,
  };

  const now = Date.now();
  if (row.link.notBefore && row.link.notBefore.getTime() > now) {
    return { ok: false, problem: "NOT_YET", ctx };
  }
  if (row.link.status === "COMPLETED") {
    return { ok: false, problem: "COMPLETED", ctx };
  }
  // Both ways a link stops working: the clock ran out, or the manager issued a
  // replacement and this row was retired (drizzle/sql/0002_single_active_link).
  if (row.link.status === "EXPIRED" || row.link.expiresAt.getTime() < now) {
    return { ok: false, problem: "EXPIRED", ctx };
  }
  return { ok: true, ctx };
}

/** First contact is recorded once. A later mismatch is a note, never a block. */
export async function recordFirstSeen(
  ctx: CandidateContext,
  ip: string | null,
  userAgent: string | null,
) {
  if (ctx.link.firstSeenIp || ctx.link.firstSeenUserAgent) return;
  await db
    .update(assessmentLinks)
    .set({ firstSeenIp: ip, firstSeenUserAgent: userAgent })
    .where(eq(assessmentLinks.id, ctx.link.id));
}

/* ------------------------------------------------------------------ *
 * Template content
 * ------------------------------------------------------------------ */

export type StageRow = {
  id: string;
  orderIndex: number;
  name: { tr: string; en: string };
  description: { tr: string; en: string } | null;
  durationSeconds: number;
  graceSeconds: number;
  onTimeout: "AUTO_SUBMIT" | "AUTO_CLOSE" | "ALLOW_GRACE" | "ALLOW_LATE";
  backNavigation: boolean;
};

export type ActivityRow = {
  id: string;
  stageId: string;
  orderIndex: number;
  type:
    | "VIDEO"
    | "AUDIO"
    | "LONG_TEXT"
    | "SHORT_TEXT"
    | "SINGLE_CHOICE"
    | "MULTI_CHOICE"
    | "FILE_UPLOAD"
    | "SCENARIO";
  isRequired: boolean;
  candidatePrompt: { tr: string; en: string };
  candidateNote: { tr: string; en: string } | null;
  thinkSeconds: number;
  answerSeconds: number | null;
  maxTakes: number;
  config: ActivityConfig | null;
};

export async function loadStages(versionId: string): Promise<StageRow[]> {
  return (await db
    .select(candidateStageColumns)
    .from(stages)
    .where(eq(stages.versionId, versionId))
    .orderBy(asc(stages.orderIndex))) as StageRow[];
}

export async function loadActivities(
  stageIds: string[],
): Promise<ActivityRow[]> {
  if (stageIds.length === 0) return [];
  return (await db
    .select(candidateActivityColumns)
    .from(activities)
    .where(inArray(activities.stageId, stageIds))
    .orderBy(asc(activities.stageId), asc(activities.orderIndex))) as ActivityRow[];
}

/**
 * One activity by an id the SERVER already holds (a media asset's
 * `activityId`). The id never comes from the client; the candidate surface
 * still addresses activities by position only.
 */
export async function loadActivity(activityId: string): Promise<ActivityRow | null> {
  const [row] = await db
    .select(candidateActivityColumns)
    .from(activities)
    .where(eq(activities.id, activityId))
    .limit(1);
  return (row as ActivityRow | undefined) ?? null;
}

/* ------------------------------------------------------------------ *
 * Attempt and stage run bookkeeping
 * ------------------------------------------------------------------ */

/** The attempt the candidate is working in. Created on first consent. */
export async function activeAttempt(assessmentId: string) {
  const [open] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.assessmentId, assessmentId), isNull(attempts.completedAt)))
    .orderBy(desc(attempts.attemptNumber))
    .limit(1);
  return open ?? null;
}

/**
 * The attempt the candidate is currently in, or the last one if it is already
 * finished. Read-only on purpose: `loadState` and `currentStage` both run on
 * every request, and neither may quietly open a second attempt after the
 * candidate has completed the assessment.
 */
export async function workingAttempt(assessmentId: string): Promise<{
  attempt: typeof attempts.$inferSelect;
  finished: boolean;
}> {
  const [latest] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.assessmentId, assessmentId))
    .orderBy(desc(attempts.attemptNumber))
    .limit(1);
  if (!latest) {
    return { attempt: await ensureAttempt(assessmentId), finished: false };
  }
  return { attempt: latest, finished: !!latest.completedAt };
}

export async function ensureAttempt(assessmentId: string) {
  const open = await activeAttempt(assessmentId);
  if (open) return open;
  const [last] = await db
    .select({ n: attempts.attemptNumber })
    .from(attempts)
    .where(eq(attempts.assessmentId, assessmentId))
    .orderBy(desc(attempts.attemptNumber))
    .limit(1);
  const [created] = await db
    .insert(attempts)
    .values({
      assessmentId,
      attemptNumber: (last?.n ?? 0) + 1,
      scope: "FULL",
      isPrimary: (last?.n ?? 0) === 0,
      startedAt: new Date(),
    })
    .returning();
  return created;
}

export type StageProgress = {
  stage: StageRow;
  run: typeof stageRuns.$inferSelect | null;
  /** Position among the stages this candidate actually has to do, 1 based. */
  position: number;
  total: number;
  done: boolean;
};

/**
 * The ordered list of stages this attempt asks the candidate to do. On a
 * PARTIAL retake the manager has already written a stage_run for every stage;
 * the ones carrying `carriedFromStageRunId` were not asked for again and are
 * invisible to the candidate.
 */
export async function stageProgress(
  attempt: typeof attempts.$inferSelect,
  allStages: StageRow[],
): Promise<StageProgress[]> {
  const runs = await db
    .select()
    .from(stageRuns)
    .where(eq(stageRuns.attemptId, attempt.id));
  const byStage = new Map(runs.map((r) => [r.stageId, r]));

  const visible =
    attempt.scope === "PARTIAL"
      ? allStages.filter((s) => {
          const run = byStage.get(s.id);
          return !!run && !run.carriedFromStageRunId;
        })
      : allStages;

  return visible.map((stage, i) => {
    const run = byStage.get(stage.id) ?? null;
    return {
      stage,
      run,
      position: i + 1,
      total: visible.length,
      done: !!run && run.completion !== "PENDING",
    };
  });
}

/** First stage that is neither finished nor carried forward. */
export function nextStage(progress: StageProgress[]): StageProgress | null {
  return progress.find((p) => !p.done) ?? null;
}

/* ------------------------------------------------------------------ *
 * Timer. Wall clock, written once, read back verbatim.
 * ------------------------------------------------------------------ */

export function deadlineFor(startedAt: Date, stage: StageRow): Date {
  return computeDeadline(startedAt, stage.durationSeconds, stage.graceSeconds);
}

export function remainingMs(
  run: typeof stageRuns.$inferSelect,
  now = new Date(),
): number {
  if (!run.deadlineAt) return 0;
  return remainingUntil(run.deadlineAt, now);
}

export type WriteWindow =
  | { allowed: true; late: boolean }
  | { allowed: false; reason: "EXPIRED" };

/**
 * Whether a write is still accepted for this run. The rules themselves live in
 * `@/lib/timer` and are shared with the manager side; this only adds the two
 * facts the pure functions cannot know: a submitted run takes nothing more, and
 * a run with no deadline has not started yet.
 */
export function writeWindow(
  run: typeof stageRuns.$inferSelect,
  stage: StageRow,
  now = new Date(),
): WriteWindow {
  if (run.submittedAt) return { allowed: false, reason: "EXPIRED" };
  if (!run.deadlineAt) return { allowed: true, late: false };
  if (!acceptsWrite(run.deadlineAt, stage.onTimeout, now)) {
    return { allowed: false, reason: "EXPIRED" };
  }
  return { allowed: true, late: isLate(run.deadlineAt, now) };
}

/**
 * Starts the stage the server itself picked. Idempotent: calling it again after
 * a refresh returns the same `deadline_at`, which is the whole point.
 */
export async function startStage(
  ctx: CandidateContext,
  attempt: typeof attempts.$inferSelect,
  target: StageProgress,
) {
  // Always before the early return: a candidate who reopens a stage that was
  // already started still needs the link to read IN_PROGRESS.
  await markLinkInProgress(ctx);
  if (target.run?.startedAt && target.run.deadlineAt) return target.run;

  const startedAt = new Date();
  const deadlineAt = deadlineFor(startedAt, target.stage);

  if (target.run) {
    const [updated] = await db
      .update(stageRuns)
      .set({ startedAt, deadlineAt, lastHeartbeatAt: startedAt })
      .where(eq(stageRuns.id, target.run.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(stageRuns)
    .values({
      attemptId: attempt.id,
      stageId: target.stage.id,
      startedAt,
      deadlineAt,
      lastHeartbeatAt: startedAt,
      completion: "PENDING",
    })
    .returning();
  return created;
}

async function markLinkInProgress(ctx: CandidateContext) {
  if (ctx.link.status !== "NOT_STARTED" && ctx.link.status !== "RETAKE_AVAILABLE") {
    return;
  }
  await db
    .update(assessmentLinks)
    .set({ status: "IN_PROGRESS" })
    .where(eq(assessmentLinks.id, ctx.link.id));
}

export async function heartbeat(runId: string) {
  await db
    .update(stageRuns)
    .set({ lastHeartbeatAt: new Date() })
    .where(eq(stageRuns.id, runId));
}

/* ------------------------------------------------------------------ *
 * Responses
 * ------------------------------------------------------------------ */

export function isAnswered(
  activity: ActivityRow,
  payload: ResponsePayload | null | undefined,
): boolean {
  if (!payload) return false;
  switch (activity.type) {
    case "VIDEO":
    case "AUDIO":
      return !!payload.mediaAssetId || !!payload.text?.trim();
    case "FILE_UPLOAD":
      return (payload.fileAssetIds ?? []).length > 0;
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return (payload.choiceIds ?? []).length > 0;
    default:
      return !!payload.text?.trim();
  }
}

export async function saveResponse(
  runId: string,
  activity: ActivityRow,
  payload: ResponsePayload,
) {
  const now = new Date();
  await db
    .insert(responses)
    .values({
      stageRunId: runId,
      activityId: activity.id,
      payload,
      answeredAt: isAnswered(activity, payload) ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [responses.stageRunId, responses.activityId],
      set: {
        payload,
        answeredAt: isAnswered(activity, payload) ? now : null,
        updatedAt: now,
      },
    });
}

export async function loadResponses(runId: string) {
  return db.select().from(responses).where(eq(responses.stageRunId, runId));
}

/**
 * Takes used so far in this run, per activity. A take is a recording that
 * finished (READY) or was cut short but kept (INCOMPLETE); an upload that never
 * produced a playable asset did not cost the candidate one. This is the number
 * `maxTakes` is enforced against, both when the client asks for another
 * recording and when the state payload tells the screen how many are left. It
 * used to live only in component state, which reset to zero on every reload.
 */
export async function takeCounts(runId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ activityId: mediaAssets.activityId })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.stageRunId, runId),
        inArray(mediaAssets.status, ["READY", "INCOMPLETE"]),
      ),
    );
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.activityId) continue;
    counts.set(row.activityId, (counts.get(row.activityId) ?? 0) + 1);
  }
  return counts;
}

/* ------------------------------------------------------------------ *
 * Submitting and finishing
 * ------------------------------------------------------------------ */

export async function submitStage(
  ctx: CandidateContext,
  run: typeof stageRuns.$inferSelect,
  stageActivities: ActivityRow[],
  opts: { late: boolean; expired?: boolean },
) {
  const saved = await loadResponses(run.id);
  const byActivity = new Map(saved.map((r) => [r.activityId, r]));
  const answeredRequired = stageActivities
    .filter((a) => a.isRequired)
    .every((a) => isAnswered(a, byActivity.get(a.id)?.payload));
  const answeredAny = stageActivities.some((a) =>
    isAnswered(a, byActivity.get(a.id)?.payload),
  );

  const completion = opts.expired
    ? answeredAny
      ? "PARTIAL"
      : "EXPIRED"
    : answeredRequired
      ? "COMPLETE"
      : "PARTIAL";

  await db
    .update(stageRuns)
    .set({ submittedAt: new Date(), completion, wasLate: opts.late })
    .where(eq(stageRuns.id, run.id));
}

/** Closes the attempt and the link once no stage is left to do. */
export async function finishAttemptIfDone(
  ctx: CandidateContext,
  attempt: typeof attempts.$inferSelect,
  allStages: StageRow[],
) {
  const progress = await stageProgress(attempt, allStages);
  if (nextStage(progress)) return false;
  const now = new Date();
  await db
    .update(attempts)
    .set({ completedAt: now })
    .where(eq(attempts.id, attempt.id));
  await db
    .update(assessmentLinks)
    .set({ status: "COMPLETED" })
    .where(eq(assessmentLinks.id, ctx.link.id));
  await db
    .update(candidates)
    .set({ lastContactAt: now })
    .where(eq(candidates.id, ctx.candidate.id));
  return true;
}

/* ------------------------------------------------------------------ *
 * Consent, personal details, device check
 * ------------------------------------------------------------------ */

const DEFAULT_CONSENT = {
  tr:
    "Bu değerlendirme kapsamında verdiğim video, ses ve yazılı cevapların " +
    "kaydedilmesini ve başvurduğum pozisyon için işe alım ekibi tarafından " +
    "değerlendirilmesini kabul ediyorum. Cevaplarımı bir yazılım değil, bir " +
    "insan değerlendiriyor. Kayıtlarımın silinmesini dilediğim zaman " +
    "isteyebileceğimi biliyorum.",
  en:
    "I agree that the video, audio and written answers I give in this " +
    "assessment are recorded and reviewed by the hiring team for the position " +
    "I applied to. My answers are reviewed by a person, not by software. I know " +
    "that I can ask for my recordings to be deleted at any time.",
};

/**
 * The consent copy the candidate must accept, versioned so that a year later we
 * can prove what was on screen. If the organisation has none yet, version 1 is
 * written here rather than leaving the candidate at a dead end.
 */
export async function getConsentText(ctx: CandidateContext) {
  if (ctx.version.consentTextId) {
    const [pinned] = await db
      .select()
      .from(consentTexts)
      .where(eq(consentTexts.id, ctx.version.consentTextId))
      .limit(1);
    if (pinned) return pinned;
  }
  const [latest] = await db
    .select()
    .from(consentTexts)
    .where(eq(consentTexts.orgId, ctx.assessment.orgId))
    .orderBy(desc(consentTexts.version))
    .limit(1);
  if (latest) return latest;

  const [created] = await db
    .insert(consentTexts)
    .values({ orgId: ctx.assessment.orgId, version: 1, body: DEFAULT_CONSENT })
    .returning();
  return created;
}

export async function hasConsented(assessmentId: string) {
  const [row] = await db
    .select({ id: consents.id })
    .from(consents)
    .where(eq(consents.assessmentId, assessmentId))
    .limit(1);
  return !!row;
}

export async function recordConsent(
  ctx: CandidateContext,
  consentTextId: string,
  ip: string | null,
  userAgent: string | null,
) {
  await db.insert(consents).values({
    assessmentId: ctx.assessment.id,
    consentTextId,
    locale: ctx.locale,
    ip,
    userAgent,
  });
}

/** Personal details are complete once we have a name and an email. */
export function hasPersonalDetails(candidate: typeof candidates.$inferSelect) {
  return !!candidate.fullName?.trim() && !!candidate.email?.trim();
}

/**
 * The device check belongs to the attempt, not to the person. A retake can
 * happen on a different device, and the same candidate can be invited to a
 * second position; in both cases a flag carried on the candidate row would
 * claim a camera was proved when it was not. One check per attempt.
 */
export function hasPassedDeviceCheck(attempt: typeof attempts.$inferSelect) {
  return !!attempt.deviceCheckedAt;
}

export async function recordDeviceCheck(attemptId: string) {
  await db
    .update(attempts)
    .set({ deviceCheckedAt: new Date() })
    .where(eq(attempts.id, attemptId));
}

/** Only a template that actually records something needs the camera test. */
export function needsDeviceCheck(all: ActivityRow[]) {
  return all.some((a) => a.type === "VIDEO" || a.type === "AUDIO");
}

/* ------------------------------------------------------------------ *
 * Technical events
 * ------------------------------------------------------------------ */

export const TECHNICAL_EVENT_TYPES = [
  "VISIBILITY_HIDDEN",
  "VISIBILITY_VISIBLE",
  "WINDOW_BLUR",
  "WINDOW_FOCUS",
  "FULLSCREEN_ENTER",
  "FULLSCREEN_EXIT",
  "CAMERA_MUTED",
  "CAMERA_UNMUTED",
  "MIC_MUTED",
  "MIC_UNMUTED",
  "OFFLINE",
  "ONLINE",
  "PAGE_UNLOAD",
  "UPLOAD_STALLED",
  "UPLOAD_RESUMED",
  "DEVICE_CHECK_FAILED",
] as const;

export type TechnicalEventType = (typeof TECHNICAL_EVENT_TYPES)[number];

export async function logTechnicalEvents(
  runId: string,
  events: Array<{ type: TechnicalEventType; at?: string; meta?: Record<string, unknown> }>,
) {
  if (events.length === 0) return;
  await db.insert(technicalEvents).values(
    events.map((e) => ({
      stageRunId: runId,
      type: e.type,
      at: e.at ? new Date(e.at) : new Date(),
      meta: e.meta ?? null,
    })),
  );
}

/* ------------------------------------------------------------------ *
 * The single state read every candidate screen is built from
 * ------------------------------------------------------------------ */

export type CandidateStep = "CONSENT" | "INFO" | "CHECK" | "STAGE" | "DONE";

export type CandidateStateStage = {
  position: number;
  total: number;
  name: string;
  description: string;
  serverNow: number;
  startedAt: number | null;
  deadlineAt: number | null;
  remainingMs: number;
  backNavigation: boolean;
  onTimeout: StageRow["onTimeout"];
  activities: Array<{
    index: number;
    type: ActivityRow["type"];
    isRequired: boolean;
    prompt: string;
    note: string;
    thinkSeconds: number;
    answerSeconds: number | null;
    maxTakes: number;
    /** Recordings already kept for this activity in this run. See `takeCounts`. */
    takeCount: number;
    config: ActivityConfig;
    payload: ResponsePayload | null;
  }>;
};

export type CandidateState = {
  step: CandidateStep;
  locale: CandidateLocale;
  /**
   * What the candidate sees as the heading. `template_versions.introTitle` is
   * the candidate-facing field and wins; the position's internal name is only
   * the fallback while a version has no intro copy yet.
   */
  positionTitle: string;
  orgName: string;
  intro: string;
  candidate: { fullName: string; email: string; phone: string; location: string };
  stageCount: number;
  estimatedMinutes: number;
  expiresAt: number;
  completedStages: number;
  stage: CandidateStateStage | null;
};

export async function loadState(ctx: CandidateContext): Promise<CandidateState> {
  const allStages = await loadStages(ctx.version.id);
  const allActivities = await loadActivities(allStages.map((s) => s.id));

  const base = {
    locale: ctx.locale,
    positionTitle:
      pickText(ctx.version.introTitle, ctx.locale) || ctx.positionName,
    orgName: ctx.orgName,
    intro: pickText(ctx.version.introBody, ctx.locale),
    candidate: {
      fullName: ctx.candidate.fullName ?? "",
      email: ctx.candidate.email ?? "",
      phone: ctx.candidate.phone ?? "",
      location: ctx.candidate.location ?? "",
    },
    stageCount: allStages.length,
    estimatedMinutes: Math.max(
      1,
      Math.round(
        allStages.reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
      ),
    ),
    expiresAt: ctx.link.expiresAt.getTime(),
  };

  if (!(await hasConsented(ctx.assessment.id))) {
    return { ...base, step: "CONSENT", completedStages: 0, stage: null };
  }
  if (!hasPersonalDetails(ctx.candidate)) {
    return { ...base, step: "INFO", completedStages: 0, stage: null };
  }

  const { attempt, finished } = await workingAttempt(ctx.assessment.id);
  const progress = await stageProgress(attempt, allStages);
  const completedStages = progress.filter((p) => p.done).length;

  if (finished) {
    return { ...base, step: "DONE", completedStages, stage: null };
  }

  if (needsDeviceCheck(allActivities) && !hasPassedDeviceCheck(attempt)) {
    return { ...base, step: "CHECK", completedStages, stage: null };
  }

  const target = nextStage(progress);
  if (!target) {
    return { ...base, step: "DONE", completedStages, stage: null };
  }

  const run = target.run;
  const stageActivities = allActivities.filter(
    (a) => a.stageId === target.stage.id,
  );
  const saved = run ? await loadResponses(run.id) : [];
  const byActivity = new Map(saved.map((r) => [r.activityId, r.payload]));
  const takes = run ? await takeCounts(run.id) : new Map<string, number>();

  return {
    ...base,
    step: "STAGE",
    completedStages,
    stage: {
      position: target.position,
      total: target.total,
      name: pickText(target.stage.name, ctx.locale),
      description: pickText(target.stage.description, ctx.locale),
      serverNow: Date.now(),
      startedAt: run?.startedAt?.getTime() ?? null,
      deadlineAt: run?.deadlineAt?.getTime() ?? null,
      remainingMs: run ? remainingMs(run) : target.stage.durationSeconds * 1000,
      backNavigation: target.stage.backNavigation,
      onTimeout: target.stage.onTimeout,
      activities: stageActivities.map((a) => ({
        index: a.orderIndex,
        type: a.type,
        isRequired: a.isRequired,
        prompt: pickText(a.candidatePrompt, ctx.locale),
        note: pickText(a.candidateNote, ctx.locale),
        thinkSeconds: a.thinkSeconds,
        answerSeconds: a.answerSeconds,
        maxTakes: a.maxTakes,
        takeCount: takes.get(a.id) ?? 0,
        config: a.config ?? {},
        payload: byActivity.get(a.id) ?? null,
      })),
    },
  };
}

/* ------------------------------------------------------------------ *
 * The resolver every write endpoint starts from
 * ------------------------------------------------------------------ */

export type CurrentStage = {
  attempt: typeof attempts.$inferSelect;
  allStages: StageRow[];
  progress: StageProgress[];
  target: StageProgress;
  stageActivities: ActivityRow[];
};

/**
 * Answers "which stage is this candidate on" without asking the client. Every
 * write endpoint goes through here, which is why a candidate cannot address a
 * stage, an activity or a run belonging to anybody else: none of those ids ever
 * travel in a request body.
 */
export async function currentStage(
  ctx: CandidateContext,
): Promise<CurrentStage | null> {
  const { attempt, finished } = await workingAttempt(ctx.assessment.id);
  if (finished) return null;
  const allStages = await loadStages(ctx.version.id);
  const progress = await stageProgress(attempt, allStages);
  const target = nextStage(progress);
  if (!target) return null;
  const stageActivities = (await loadActivities([target.stage.id])).filter(
    (a) => a.stageId === target.stage.id,
  );
  return { attempt, allStages, progress, target, stageActivities };
}

/** Resolves an activity by its position in the current stage, never by id. */
export function activityAt(
  current: CurrentStage,
  index: number,
): ActivityRow | null {
  return current.stageActivities.find((a) => a.orderIndex === index) ?? null;
}

/** One activity as the candidate screens receive it. */
export type StageActivity = CandidateStateStage["activities"][number];

/**
 * Read-only progress, safe to call on a link that is expired or finished: it
 * opens no attempt and writes nothing.
 */
export async function progressSummary(ctx: CandidateContext) {
  const allStages = await loadStages(ctx.version.id);
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.assessmentId, ctx.assessment.id))
    .orderBy(desc(attempts.attemptNumber))
    .limit(1);
  if (!attempt) return { completed: 0, total: allStages.length };
  const progress = await stageProgress(attempt, allStages);
  return {
    completed: progress.filter((p) => p.done).length,
    total: allStages.length,
  };
}

/** When the candidate finished, for the closing screen. Reads nothing else. */
export async function completionInfo(ctx: CandidateContext) {
  const allStages = await loadStages(ctx.version.id);
  const [last] = await db
    .select({ completedAt: attempts.completedAt })
    .from(attempts)
    .where(eq(attempts.assessmentId, ctx.assessment.id))
    .orderBy(desc(attempts.attemptNumber))
    .limit(1);
  return {
    completedAt: last?.completedAt ?? null,
    stageCount: allStages.length,
    /**
     * The one concrete promise the candidate is given, on artboard A12. It is
     * derived rather than stored: a date on that screen has to mean something,
     * and "we will write within N days of your submission" is a promise the
     * hiring team can actually keep. `RESPONSE_PROMISE_DAYS` moves it.
     */
    responseByAt: last?.completedAt
      ? new Date(last.completedAt.getTime() + responsePromiseDays() * 86_400_000)
      : null,
  };
}

function responsePromiseDays(): number {
  const configured = Number(process.env.RESPONSE_PROMISE_DAYS);
  return Number.isFinite(configured) && configured > 0 ? configured : 7;
}

/* ------------------------------------------------------------------ *
 * Language
 * ------------------------------------------------------------------ */

/** The languages this template version was actually authored in. */
export function supportedLocales(ctx: CandidateContext): CandidateLocale[] {
  const set = (ctx.version.localeSet ?? []).filter(
    (l): l is CandidateLocale => l === "tr" || l === "en",
  );
  return set.length > 0 ? set : [ctx.version.defaultLocale];
}

/**
 * The candidate's language lives on the assessment, which is where the manager
 * set it when they sent the invitation. A candidate who switches language is
 * changing how they are taking this assessment, so it is written back rather
 * than kept in a cookie: the choice then survives navigation and a new device,
 * and the consent record stores the language actually shown on screen.
 */
export async function setAssessmentLocale(
  ctx: CandidateContext,
  locale: CandidateLocale,
) {
  if (ctx.locale === locale) return;
  await db
    .update(assessments)
    .set({ locale })
    .where(eq(assessments.id, ctx.assessment.id));
  ctx.locale = locale;
  ctx.assessment = { ...ctx.assessment, locale };
}
