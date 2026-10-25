import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assessments,
  attempts,
  examAssessments,
  examResults,
  itemResponses,
  mediaAssets,
  organizations,
  responseGradings,
  sectionRuns,
  transcripts,
} from "@/db/schema";
import type { FinalSkill } from "@/db/schema/exam";
import { contentLocale, panelLocaleOf } from "@/i18n/locale";
import { callJson } from "@/lib/ai-runs";
import { enabledSections } from "@/lib/exam/blueprint";
import { medianLevel } from "@/lib/exam/cefr";
import { gradeAnswer, RULE_MODEL, type GradingJob } from "@/lib/exam/grade-answer";
import { ruleProposal } from "@/lib/exam/grading-rules";
import { GRADING_CALL_OPTIONS, GRADING_JSON_SCHEMA, speakingMetrics } from "@/lib/exam/grading";
import { sectionChance } from "@/lib/exam/chance";
import { blockerErrorCode, finalizeBlockers } from "@/lib/exam/finalize-blockers";
import { hasAnswer } from "@/lib/exam/item-scoring";
import { autoFinalizes, computeResult, type Decider, type SectionEvidence } from "@/lib/exam/result";
import { isObjectiveSection, type ProductiveSection, type ResultLevel, type Section } from "@/lib/exam/types";
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
    if (!answered) {
      // Nothing was written or said: a fixed rule proposes A0 at once (no model call) and the
      // teacher confirms it. A recording that arrives late reopens it (`reopenGradingForMedia`).
      await db
        .insert(responseGradings)
        .values({
          itemResponseId: r.id,
          taskLevel: snap.level,
          status: "AI_PROPOSED",
          aiProposal: ruleProposal(snap.section as ProductiveSection, { reason: "EMPTY", flags: ["EMPTY"] }, await rationaleLocaleOfRun(sectionRunId)),
          aiLevel: "A0",
          aiModel: RULE_MODEL,
          proposedAt: new Date(),
        })
        .onConflictDoNothing();
      continue;
    }
    const [grading] = await db
      .insert(responseGradings)
      .values({ itemResponseId: r.id, taskLevel: snap.level, status: "PENDING" })
      .onConflictDoNothing()
      .returning();
    if (!grading) continue;
    if (await gradingInputReady(r.id)) await enqueueGrading(grading.id);
  }
}

/** The language a teacher reads a rationale in, from the assessment of the run's attempt. */
async function rationaleLocaleOfRun(sectionRunId: string) {
  const [row] = await db
    .select({ locale: assessments.locale })
    .from(sectionRuns)
    .innerJoin(attempts, eq(attempts.id, sectionRuns.attemptId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(eq(sectionRuns.id, sectionRunId));
  return contentLocale(panelLocaleOf(row?.locale ?? "en"));
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
 * reopens a grading that was closed as EMPTY, so it is graded like any other:
 * the failed one of before, or the A0 a rule proposed for an empty answer, as
 * long as no teacher has decided on it.
 */
export async function reopenGradingForMedia(itemResponseId: string) {
  const reopen = { status: "PENDING" as const, aiError: null, aiProposal: null, aiLevel: null, aiModel: null, proposedAt: null, updatedAt: new Date() };
  await db
    .update(responseGradings)
    .set(reopen)
    .where(and(eq(responseGradings.itemResponseId, itemResponseId), eq(responseGradings.status, "AI_FAILED")));
  await db
    .update(responseGradings)
    .set(reopen)
    .where(
      and(
        eq(responseGradings.itemResponseId, itemResponseId),
        eq(responseGradings.status, "AI_PROPOSED"),
        eq(responseGradings.aiModel, RULE_MODEL),
        isNull(responseGradings.finalLevel),
      ),
    );
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
  | { status: "PROPOSED"; level: ResultLevel | null }
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
  const rationaleLocale = contentLocale(panelLocaleOf(row.assessment.locale));

  let job: GradingJob;
  if (snap.content.kind === "WRITING") {
    job = {
      section: "WRITING",
      task: snap.prompt,
      contentPoints: rubric.contentPoints,
      register: rubric.register,
      taskLevel,
      images: snap.content.images,
      minWords: snap.content.minWords,
      maxWords: snap.content.maxWords,
      text: answer.text ?? "",
      rationaleLocale,
    };
  } else {
    // No recording and no typed text is an answer with nothing in it: a rule proposes A0 (EMPTY).
    let source = "";
    let words: Array<{ text: string; startMs: number; endMs: number }> = [];
    let durationMs = 0;
    if (answer.usedTextAlternative) {
      source = answer.text ?? "";
    } else if (answer.mediaAssetId) {
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
    job = {
      section: "SPEAKING",
      task: snap.prompt,
      contentPoints: rubric.contentPoints,
      register: rubric.register,
      taskLevel,
      images: snap.content.kind === "SPEAKING" ? snap.content.images : undefined,
      transcript: source,
      metrics: speakingMetrics(words, durationMs),
      rationaleLocale,
    };
  }

  const purpose = section === "WRITING" ? "WRITING_GRADING" : "SPEAKING_GRADING";
  const meta = { orgId: row.org.id, purpose, inputRef: `item_response:${row.response.id}` } as const;

  const graded = await gradeAnswer(job, async (messages) => {
    const { response, runId } = await callJson("cefr_grading", GRADING_JSON_SCHEMA, messages, meta, GRADING_CALL_OPTIONS);
    return { text: response.text, model: response.model, runId };
  });
  if (graded.status === "UNPARSEABLE") {
    await db
      .update(responseGradings)
      .set({ status: "AI_FAILED", aiError: `unparseable: ${graded.error}`.slice(0, 1000), aiRunId: graded.runId, aiModel: graded.model, updatedAt: new Date() })
      .where(eq(responseGradings.id, gradingId));
    await recomputeResult(row.attempt.id);
    return { status: "FAILED", reason: graded.error };
  }

  const { proposal, level } = graded;
  await db
    .update(responseGradings)
    .set({
      status: "AI_PROPOSED",
      aiProposal: proposal,
      aiLevel: level,
      aiRunId: graded.runId,
      aiModel: graded.model,
      aiError: null,
      proposedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(responseGradings.id, gradingId), eq(responseGradings.status, "PENDING")));
  await recomputeResult(row.attempt.id);
  return { status: "PROPOSED", level };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

type GradingRow = typeof responseGradings.$inferSelect;

/** The level a grading stands at now, and who put it there. */
export function gradingLevel(g: GradingRow): { level: ResultLevel | null; decider: Decider | null } {
  if (g.finalLevel) return { level: g.finalLevel, decider: "TEACHER" };
  if (g.status === "AI_PROPOSED" && g.aiLevel) return { level: g.aiLevel, decider: "AI" };
  return { level: null, decider: null };
}

export async function recomputeResult(attemptId: string) {
  const [row] = await db
    .select({ attempt: attempts, exam: examAssessments })
    .from(attempts)
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, attempts.assessmentId))
    .where(eq(attempts.id, attemptId));
  if (!row) return;
  const cfg = row.exam.blueprintSnapshot;
  const runs = await db.select().from(sectionRuns).where(eq(sectionRuns.attemptId, attemptId));
  const runIds = runs.map((r) => r.id);
  const gradings = runIds.length
    ? await db
        .select({ grading: responseGradings, sectionRunId: itemResponses.sectionRunId })
        .from(responseGradings)
        .innerJoin(itemResponses, eq(itemResponses.id, responseGradings.itemResponseId))
        .where(inArray(itemResponses.sectionRunId, runIds))
    : [];
  // The objective answers, for the chance rule (chance.ts): a section not credibly above guessing is A0.
  const objectiveRunIds = runs.filter((r) => isObjectiveSection(r.section)).map((r) => r.id);
  const objectiveAnswers = objectiveRunIds.length
    ? await db
        .select({ sectionRunId: itemResponses.sectionRunId, itemSnapshot: itemResponses.itemSnapshot, score: itemResponses.score, answer: itemResponses.answer })
        .from(itemResponses)
        .where(inArray(itemResponses.sectionRunId, objectiveRunIds))
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
        chance: sectionChance(objectiveAnswers.filter((a) => a.sectionRunId === run.id)),
      });
      continue;
    }
    const mine = gradings.filter((g) => g.sectionRunId === run.id).map((g) => g.grading);
    if (mine.length === 0) continue;
    const levels = mine.map(gradingLevel);
    if (mine.some((g) => g.status === "PENDING")) anyPending = true;
    if (mine.some((g) => !g.finalLevel)) anyUndecided = true;
    const known = levels.map((l) => l.level).filter((l): l is ResultLevel => !!l);
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
      Object.entries(existing?.skillOverrides ?? {}).map(([k, v]) => [k, v.level as ResultLevel]),
    ) as Partial<Record<Section, ResultLevel>>,
  };
  const computed = computeResult({
    mode: row.exam.mode,
    claimed: row.exam.claimedLevel,
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

  // An exam with no writing or speaking has nothing for a teacher to judge,
  // so a clear engine result is final the moment the attempt ends. A borderline
  // or imprecise one stays AWAITING_REVIEW: a teacher decides.
  const hasProductive = enabledSections(cfg).some((s) => !isObjectiveSection(s.section));
  const clean = evidenceComplete && !row.attempt.terminatedAt && row.attempt.integrityOutcome !== "INVALID";
  if (autoFinalizes({ status, hasProductive, anyUndecided, clean, computed })) {
    await finalizeResult(attemptId, null, null);
  }
}

/** Freezes the current computed result as final. `userId` null means the engine did it. */
export async function finalizeResult(attemptId: string, userId: string | null, reason: string | null) {
  const [result] = await db.select().from(examResults).where(eq(examResults.attemptId, attemptId));
  if (!result?.computed) return { ok: false as const, code: "NOT_READY" };
  const [assessment] = await db
    .select({ config: examAssessments.blueprintSnapshot })
    .from(attempts)
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, attempts.assessmentId))
    .where(eq(attempts.id, attemptId));
  const c = result.computed;
  if (result.finalizedAt) return { ok: false as const, code: "ALREADY_FINAL" };
  // The same rules the teacher's result screen shows as its checklist.
  const [blocker] = finalizeBlockers(c);
  if (blocker) return { ok: false as const, code: blockerErrorCode(blocker) };
  const overall = c.overall;
  if (!overall) return { ok: false as const, code: "NOT_READY" };

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
  const frozen = await db
    .update(examResults)
    .set({
      status: "FINAL",
      finalOverall: overall,
      finalSkills,
      finalOutcome: c.verification?.outcome ?? null,
      finalizedBy: userId,
      finalizedAt: now,
      ...(release ? { releasedAt: now, releasedBy: userId } : {}),
      updatedAt: now,
    })
    .where(and(eq(examResults.attemptId, attemptId), isNull(examResults.finalizedAt)))
    .returning({ id: examResults.id });
  void reason;
  // Nothing updated: someone finalized it between the read above and this write.
  if (frozen.length === 0) return { ok: false as const, code: "ALREADY_FINAL" };
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
