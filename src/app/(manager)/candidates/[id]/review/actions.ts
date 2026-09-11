"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assessments,
  attempts,
  evaluations,
  evaluationItems,
  evaluationItemRevisions,
  auditLogs,
  stageCompetencies,
  stages,
  weightSets,
} from "@/db/schema";
import { requireUser } from "@/server/session";

/**
 * The review screen has no save button by design, so every edit lands here.
 * Writes are keyed on (evaluation, competency, stage) and upserted, which makes
 * repeated autosaves idempotent and safe to fire on every keystroke debounce.
 */
const itemSchema = z.object({
  evaluationId: z.string().uuid(),
  competencyId: z.string().uuid(),
  stageId: z.string().uuid(),
  score: z.number().int().min(1).max(5).nullable().optional(),
  selectedOptionIds: z.array(z.string().uuid()).optional(),
  note: z.string().max(4000).nullable().optional(),
});

/** Codes, not sentences: the caller renders them in the manager's language. */
export type SaveErrorCode = "INVALID" | "NOT_YOURS";

export type SaveResult =
  | { ok: true; at: string }
  | { ok: false; code: SaveErrorCode };

export async function saveEvaluationItem(
  input: z.infer<typeof itemSchema>,
): Promise<SaveResult> {
  const user = await requireUser("evaluation:write");
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID" };
  const data = parsed.data;

  // An evaluation belongs to exactly one evaluator. Nobody edits someone
  // else's scores, not even an owner: they get their own row instead.
  const [evaluation] = await db
    .select()
    .from(evaluations)
    .where(
      and(
        eq(evaluations.id, data.evaluationId),
        eq(evaluations.evaluatorId, user.id),
      ),
    )
    .limit(1);
  if (!evaluation) return { ok: false, code: "NOT_YOURS" };

  const now = new Date();
  const patch: Record<string, unknown> = { updatedAt: now };
  if (data.score !== undefined) patch.score = data.score;
  if (data.selectedOptionIds !== undefined) {
    patch.selectedOptionIds = data.selectedOptionIds;
  }
  if (data.note !== undefined) patch.note = data.note;

  const [saved] = await db
    .insert(evaluationItems)
    .values({
      evaluationId: data.evaluationId,
      competencyId: data.competencyId,
      stageId: data.stageId,
      score: data.score ?? null,
      selectedOptionIds: data.selectedOptionIds ?? [],
      note: data.note ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        evaluationItems.evaluationId,
        evaluationItems.competencyId,
        evaluationItems.stageId,
      ],
      set: patch,
    })
    .returning();

  /**
   * Keep the trail. The screen saves silently as the manager works, so without
   * this a score could change months before a decision is questioned and
   * nobody could say when, or who did it.
   */
  if (saved) {
    await db.insert(evaluationItemRevisions).values({
      evaluationItemId: saved.id,
      score: saved.score,
      selectedOptionIds: saved.selectedOptionIds ?? [],
      note: saved.note,
      changedBy: user.id,
    });
  }

  /**
   * `submittedAt` is what moves a candidate from "yarım puanlandı" to
   * "puanlandı" and out of the review queue. There is no submit button, so it
   * is derived: set the first time every competency of every stage of this
   * attempt's template version carries a score, cleared again if one of those
   * scores is later removed. The first completion time is kept on later saves
   * so the timestamp means "when the scoring was finished", not "last touched".
   */
  const complete = await isFullyScored(evaluation.attemptId, data.evaluationId);
  const patchEvaluation: Partial<typeof evaluations.$inferInsert> = {
    updatedAt: now,
    submittedAt: complete ? (evaluation.submittedAt ?? now) : null,
  };
  // A finished evaluation is pinned to the weight set in force at that moment,
  // so weights retuned later leave it alone until "recalculate" (see
  // selectWeights in lib/scoring.ts). Only if nothing pinned it earlier.
  if (complete && !evaluation.weightSetId) {
    const activeSetId = await activeWeightSetIdFor(evaluation.attemptId);
    if (activeSetId) patchEvaluation.weightSetId = activeSetId;
  }
  await db
    .update(evaluations)
    .set(patchEvaluation)
    .where(eq(evaluations.id, data.evaluationId));

  return { ok: true, at: now.toISOString() };
}

/** Every (stage, competency) pair the attempt's template version measures has a score. */
async function isFullyScored(attemptId: string, evaluationId: string) {
  const versionId = await versionIdOfAttempt(attemptId);
  if (!versionId) return false;

  const [required, scored] = await Promise.all([
    db
      .select({
        stageId: stageCompetencies.stageId,
        competencyId: stageCompetencies.competencyId,
      })
      .from(stageCompetencies)
      .innerJoin(stages, eq(stages.id, stageCompetencies.stageId))
      .where(eq(stages.versionId, versionId)),
    db
      .select({
        stageId: evaluationItems.stageId,
        competencyId: evaluationItems.competencyId,
      })
      .from(evaluationItems)
      .where(
        and(
          eq(evaluationItems.evaluationId, evaluationId),
          isNotNull(evaluationItems.score),
        ),
      ),
  ]);

  // A version that measures nothing can never be "fully scored": an empty
  // requirement would mark the evaluation done the moment it was opened.
  if (required.length === 0) return false;
  const have = new Set(scored.map((s) => `${s.stageId}:${s.competencyId}`));
  return required.every((r) => have.has(`${r.stageId}:${r.competencyId}`));
}

async function versionIdOfAttempt(attemptId: string) {
  const [row] = await db
    .select({ versionId: assessments.versionId })
    .from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(eq(attempts.id, attemptId))
    .limit(1);
  return row?.versionId ?? null;
}

async function activeWeightSetIdFor(attemptId: string) {
  const versionId = await versionIdOfAttempt(attemptId);
  if (!versionId) return null;
  const [set] = await db
    .select({ id: weightSets.id })
    .from(weightSets)
    .where(and(eq(weightSets.versionId, versionId), eq(weightSets.isActive, 1)))
    .limit(1);
  return set?.id ?? null;
}

/**
 * Watching a candidate's recording is a privacy-relevant act, so it is audited
 * and the URL it returns is short lived. Media is never public.
 */
export async function recordMediaView(mediaAssetId: string) {
  const user = await requireUser("media:view");
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "media.view",
    subjectType: "media_asset",
    subjectId: mediaAssetId,
  });
}
