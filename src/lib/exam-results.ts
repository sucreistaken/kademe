import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assessments,
  attempts,
  examResults,
  itemResponses,
  mediaAssets,
  organizations,
  responseGradings,
  sectionRuns,
  transcripts,
} from "@/db/schema";
import type { FinalSkill } from "@/db/schema/exam";
import { callJson } from "@/lib/ai-runs";
import { enabledSections } from "@/lib/exam/blueprint";
import { medianLevel } from "@/lib/exam/cefr";
import {
  buildGradingRepairMessages,
  buildSpeakingGradingMessages,
  buildWritingGradingMessages,
  capByTaskLevel,
  emptyAnswerReason,
  GRADING_JSON_SCHEMA,
  parseGradingAnswer,
  skillLevelFromCriteria,
  speakingMetrics,
  verifyEvidence,
  type GradingProposal,
} from "@/lib/exam/grading";
import { hasAnswer } from "@/lib/exam/item-scoring";
import { computeResult, type Decider, type SectionEvidence } from "@/lib/exam/result";
import { isObjectiveSection, type Cefr, type ProductiveSection, type Section } from "@/lib/exam/types";
import { enqueueGrading } from "@/lib/queue";

/**
 * Grading and results, server only.
 *
 * The AI never writes a final level. It writes `ai_proposal` and `ai_level`
 * on a grading row; a teacher turns that into `final_level` (CONFIRMED or
 * OVERRIDDEN, with a reason). The exam result is recomputed from those rows
 * every time one of them changes, so there is never a second copy of a level
 * that could disagree with its source.
 */

// ---------------------------------------------------------------------------
// Opening gradings when a writing / speaking section closes
// ---------------------------------------------------------------------------

const TRANSCRIBABLE = ["READY", "INCOMPLETE"] as const;

export async function openGradings(sectionRunId: string) {
  const responses = await db.select().from(itemResponses).where(eq(itemResponses.sectionRunId, sectionRunId));
  for (const r of responses) {
    const snap = r.itemSnapshot;
    if (snap.type !== "WRITING_PROMPT" && snap.type !== "SPEAKING_PROMPT") continue;
    const answered = hasAnswer(snap.type, r.answer ?? null);
    const [grading] = await db
      .insert(responseGradings)
      .values({
        itemResponseId: r.id,
        taskLevel: snap.level,
        status: answered ? "PENDING" : "AI_FAILED",
        aiError: answered ? null : "EMPTY",
      })
      .onConflictDoNothing()
      .returning();
    if (!grading || !answered) continue;
    if (await gradingInputReady(r.id)) await enqueueGrading(grading.id);
  }
}

/** Writing is ready at once; a spoken answer needs its transcript first. */
async function gradingInputReady(itemResponseId: string): Promise<boolean> {
  const [r] = await db.select().from(itemResponses).where(eq(itemResponses.id, itemResponseId));
  if (!r) return false;
  if (r.itemSnapshot.type === "WRITING_PROMPT") return true;
  if (r.answer?.usedTextAlternative && r.answer.text?.trim()) return true;
  if (!r.answer?.mediaAssetId) return false;
  const [t] = await db
    .select({ id: transcripts.id })
    .from(transcripts)
    .where(eq(transcripts.mediaAssetId, r.answer.mediaAssetId))
    .limit(1);
  return !!t;
}

/**
 * A recording that finished after its section closed (slow upload, salvage)
 * reopens a grading that was closed as EMPTY, so it is graded like any other.
 */
export async function reopenGradingForMedia(itemResponseId: string) {
  await db
    .update(responseGradings)
    .set({ status: "PENDING", aiError: null, updatedAt: new Date() })
    .where(and(eq(responseGradings.itemResponseId, itemResponseId), eq(responseGradings.status, "AI_FAILED")));
}

/** Called by the transcription job once a recording has text. */
export async function gradeAfterTranscript(mediaAssetId: string) {
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, mediaAssetId));
  if (!asset?.itemResponseId) return;
  const [grading] = await db
    .select()
    .from(responseGradings)
    .where(and(eq(responseGradings.itemResponseId, asset.itemResponseId), eq(responseGradings.status, "PENDING")));
  if (grading) await enqueueGrading(grading.id);
}

/** Safety net for the cron: pending gradings whose input is ready but that no queue job holds. */
export async function findUngraded(limit = 20) {
  const minuteAgo = new Date(Date.now() - 60_000);
  const rows = await db
    .select({ id: responseGradings.id, itemResponseId: responseGradings.itemResponseId })
    .from(responseGradings)
    .where(and(eq(responseGradings.status, "PENDING"), lt(responseGradings.updatedAt, minuteAgo)))
    .limit(limit);
  const ready: string[] = [];
  for (const r of rows) if (await gradingInputReady(r.itemResponseId)) ready.push(r.id);
  return ready;
}

// ---------------------------------------------------------------------------
// The grading job
// ---------------------------------------------------------------------------

export type GradingOutcome =
  | { status: "PROPOSED"; level: Cefr | null }
  | { status: "SKIPPED"; reason: string }
  | { status: "FAILED"; reason: string };

export async function runGrading(gradingId: string): Promise<GradingOutcome> {
  const [row] = await db
    .select({
      grading: responseGradings,
      response: itemResponses,
      run: sectionRuns,
      attempt: attempts,
      assessment: assessments,
      org: organizations,
    })
    .from(responseGradings)
    .innerJoin(itemResponses, eq(itemResponses.id, responseGradings.itemResponseId))
    .innerJoin(sectionRuns, eq(sectionRuns.id, itemResponses.sectionRunId))
    .innerJoin(attempts, eq(attempts.id, sectionRuns.attemptId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .innerJoin(organizations, eq(organizations.id, assessments.orgId))
    .where(eq(responseGradings.id, gradingId));
  if (!row) return { status: "SKIPPED", reason: "grading is gone" };
  if (row.grading.status !== "PENDING") return { status: "SKIPPED", reason: `status is ${row.grading.status}` };

  const snap = row.response.itemSnapshot;
  const answer = row.response.answer ?? {};
  const section = snap.section as ProductiveSection;
  const taskLevel = row.grading.taskLevel;
  const rubric = snap.rubric ?? { contentPoints: [] };
  // Teachers read the rationale; the panel language of the school is Turkish by default.
  const rationaleLocale = row.assessment.locale;

  let messages;
  let source: string;
  if (snap.content.kind === "WRITING") {
    source = answer.text ?? "";
    const empty = emptyAnswerReason(source, snap.content.minWords);
    if (empty === "EMPTY") return fail(gradingId, "EMPTY");
    messages = buildWritingGradingMessages({
      task: snap.prompt,
      contentPoints: rubric.contentPoints,
      register: rubric.register,
      taskLevel,
      minWords: snap.content.minWords,
      maxWords: snap.content.maxWords,
      text: source,
      rationaleLocale,
    });
  } else {
    let words: Array<{ text: string; startMs: number; endMs: number }> = [];
    let durationMs = 0;
    if (answer.usedTextAlternative) {
      source = answer.text ?? "";
    } else {
      if (!answer.mediaAssetId) return fail(gradingId, "EMPTY");
      const [t] = await db
        .select({ text: transcripts.text, words: transcripts.words, durationMs: mediaAssets.durationMs })
        .from(transcripts)
        .innerJoin(mediaAssets, eq(mediaAssets.id, transcripts.mediaAssetId))
        .where(eq(transcripts.mediaAssetId, answer.mediaAssetId));
      if (!t) return { status: "SKIPPED", reason: "transcript not ready" };
      source = t.text;
      words = t.words ?? [];
      durationMs = t.durationMs ?? (words.length ? words[words.length - 1].endMs : 0);
    }
    if (!source.trim()) return fail(gradingId, "EMPTY");
    messages = buildSpeakingGradingMessages({
      task: snap.prompt,
      contentPoints: rubric.contentPoints,
      register: rubric.register,
      taskLevel,
      transcript: source,
      metrics: speakingMetrics(words, durationMs),
      rationaleLocale,
    });
  }

  const purpose = section === "WRITING" ? "WRITING_GRADING" : "SPEAKING_GRADING";
  const meta = { orgId: row.org.id, purpose, inputRef: `item_response:${row.response.id}` } as const;

  let proposal: GradingProposal | null = null;
  let runId: string | null = null;
  let model: string | null = null;
  let lastError = "";
  let attemptMessages = messages;
  for (let round = 0; round < 2 && !proposal; round++) {
    const { response, runId: id } = await callJson("cefr_grading", GRADING_JSON_SCHEMA, attemptMessages, meta, {
      maxTokens: 4000,
    });
    runId = id;
    model = response.model;
    const parsed = parseGradingAnswer(response.text, section);
    if (parsed.ok) proposal = parsed.proposal;
    else {
      lastError = parsed.error;
      attemptMessages = buildGradingRepairMessages(messages, response.text, parsed.error);
    }
  }
  if (!proposal) {
    await db
      .update(responseGradings)
      .set({ status: "AI_FAILED", aiError: `unparseable: ${lastError}`.slice(0, 1000), aiRunId: runId, aiModel: model, updatedAt: new Date() })
      .where(eq(responseGradings.id, gradingId));
    await recomputeResult(row.attempt.id);
    return { status: "FAILED", reason: lastError };
  }

  proposal = capByTaskLevel(verifyEvidence(proposal, source), taskLevel);
  const level = skillLevelFromCriteria(proposal) ?? proposal.overallLevel;
  await db
    .update(responseGradings)
    .set({
      status: "AI_PROPOSED",
      aiProposal: proposal,
      aiLevel: level,
      aiRunId: runId,
      aiModel: model,
      aiError: null,
      proposedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(responseGradings.id, gradingId), eq(responseGradings.status, "PENDING")));
  await recomputeResult(row.attempt.id);
  return { status: "PROPOSED", level };

  async function fail(id: string, reason: string): Promise<GradingOutcome> {
    await db
      .update(responseGradings)
      .set({ status: "AI_FAILED", aiError: reason, updatedAt: new Date() })
      .where(eq(responseGradings.id, id));
    await recomputeResult(row.attempt.id);
    return { status: "FAILED", reason };
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

type GradingRow = typeof responseGradings.$inferSelect;

/** The level a grading stands at now, and who put it there. */
export function gradingLevel(g: GradingRow): { level: Cefr | null; decider: Decider | null } {
  if (g.finalLevel) return { level: g.finalLevel, decider: "TEACHER" };
  if (g.status === "AI_PROPOSED" && g.aiLevel) return { level: g.aiLevel, decider: "AI" };
  return { level: null, decider: null };
}

export async function recomputeResult(attemptId: string) {
  const [row] = await db
    .select({ attempt: attempts, assessment: assessments })
    .from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(eq(attempts.id, attemptId));
  if (!row) return;
  const cfg = row.assessment.blueprintSnapshot;
  const runs = await db.select().from(sectionRuns).where(eq(sectionRuns.attemptId, attemptId));
  const runIds = runs.map((r) => r.id);
  const gradings = runIds.length
    ? await db
        .select({ grading: responseGradings, sectionRunId: itemResponses.sectionRunId })
        .from(responseGradings)
        .innerJoin(itemResponses, eq(itemResponses.id, responseGradings.itemResponseId))
        .where(inArray(itemResponses.sectionRunId, runIds))
    : [];

  const evidence: SectionEvidence[] = [];
  let anyPending = false;
  let anyUndecided = false;
  // False while any enabled section has not produced its evidence yet: not
  // run, still closing (submitted but theta not written), or skipped. Nothing
  // is finalized automatically on partial evidence.
  let evidenceComplete = true;
  for (const s of enabledSections(cfg)) {
    const run = runs.find((r) => r.section === s.section);
    if (!run?.submittedAt || run.completion === "SKIPPED") {
      evidenceComplete = false;
      continue;
    }
    if (isObjectiveSection(s.section)) {
      if (run.thetaMean === null || run.thetaSd === null) {
        evidenceComplete = false;
        continue;
      }
      if (run.stopReason === "INSUFFICIENT") evidenceComplete = false;
      evidence.push({
        section: s.section,
        kind: "OBJECTIVE",
        posterior: { mean: run.thetaMean, sd: run.thetaSd },
        answered: 0,
        insufficient: run.stopReason === "INSUFFICIENT",
      });
      continue;
    }
    const mine = gradings.filter((g) => g.sectionRunId === run.id).map((g) => g.grading);
    if (mine.length === 0) continue;
    const levels = mine.map(gradingLevel);
    if (mine.some((g) => g.status === "PENDING")) anyPending = true;
    if (mine.some((g) => !g.finalLevel)) anyUndecided = true;
    const known = levels.map((l) => l.level).filter((l): l is Cefr => !!l);
    const complete = known.length === levels.length;
    evidence.push({
      section: s.section,
      kind: "PRODUCTIVE",
      level: complete ? medianLevel(known) : null,
      decider: complete ? (levels.every((l) => l.decider === "TEACHER") ? "TEACHER" : "AI") : null,
    });
  }

  const [existing] = await db.select().from(examResults).where(eq(examResults.attemptId, attemptId));
  const overrides = {
    overall: existing?.overallOverride ?? null,
    skills: Object.fromEntries(
      Object.entries(existing?.skillOverrides ?? {}).map(([k, v]) => [k, v.level as Cefr]),
    ) as Partial<Record<Section, Cefr>>,
  };
  const computed = computeResult({
    mode: row.assessment.mode,
    claimed: row.assessment.claimedLevel,
    sections: evidence,
    rules: cfg.passRules,
    overrides,
  });

  let status: "IN_PROGRESS" | "AWAITING_GRADING" | "AWAITING_REVIEW" | "FINAL";
  if (existing?.status === "FINAL") status = "FINAL";
  else if (!row.attempt.completedAt && !row.attempt.terminatedAt) status = "IN_PROGRESS";
  else if (anyPending) status = "AWAITING_GRADING";
  else status = "AWAITING_REVIEW";

  const values = { attemptId, status, computed, updatedAt: new Date() };
  await db
    .insert(examResults)
    .values(values)
    .onConflictDoUpdate({ target: examResults.attemptId, set: { status, computed, updatedAt: new Date() } });

  // An exam with no writing or speaking has nothing for a teacher to judge:
  // the engine's result is final the moment the attempt ends.
  const hasProductive = enabledSections(cfg).some((s) => !isObjectiveSection(s.section));
  const clean = evidenceComplete && !row.attempt.terminatedAt && row.attempt.integrityOutcome !== "INVALID";
  if (status === "AWAITING_REVIEW" && !hasProductive && !anyUndecided && clean) {
    await finalizeResult(attemptId, null, null);
  }
}

/** Freezes the current computed result as final. `userId` null means the engine did it. */
export async function finalizeResult(attemptId: string, userId: string | null, reason: string | null) {
  const [result] = await db.select().from(examResults).where(eq(examResults.attemptId, attemptId));
  if (!result?.computed) return { ok: false as const, code: "NOT_READY" };
  const [assessment] = await db
    .select({ config: assessments.blueprintSnapshot })
    .from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(eq(attempts.id, attemptId));
  const c = result.computed;
  if (c.status === "AWAITING_GRADING" || !c.overall) return { ok: false as const, code: "NOT_READY" };
  if (Object.values(c.skills).some((s) => s?.decider === "AI" || s?.pending))
    return { ok: false as const, code: "UNDECIDED" };

  const at = new Date().toISOString();
  const finalSkills: Record<string, FinalSkill> = {};
  for (const [section, s] of Object.entries(c.skills)) {
    if (!s?.level) continue;
    const override = result.skillOverrides[section];
    finalSkills[section] = override ?? {
      level: s.level,
      decider: s.decider ?? "ENGINE",
      userId: s.decider === "TEACHER" ? userId : null,
      reason: null,
      at,
    };
  }
  const now = new Date();
  const [att] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
  // Automatic release only for a clean attempt: a teacher releases the rest by hand.
  const release =
    (assessment?.config.autoRelease ?? false) &&
    att?.integrityOutcome !== "INVALID" &&
    att?.integritySummary?.level !== "ATTENTION" &&
    !att?.terminatedAt;
  await db
    .update(examResults)
    .set({
      status: "FINAL",
      finalOverall: c.overall,
      finalSkills,
      finalOutcome: c.verification?.outcome ?? null,
      finalizedBy: userId,
      finalizedAt: now,
      ...(release ? { releasedAt: now, releasedBy: userId } : {}),
      updatedAt: now,
    })
    .where(and(eq(examResults.attemptId, attemptId), isNull(examResults.finalizedAt)));
  void reason;
  return { ok: true as const };
}

/** Rows the grading cron should look at, oldest first. */
export async function pendingGradingCount() {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(responseGradings)
    .where(eq(responseGradings.status, "PENDING"));
  return row?.n ?? 0;
}

export { TRANSCRIBABLE };
