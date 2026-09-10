"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  evaluations,
  evaluationItems,
  evaluationItemRevisions,
  auditLogs,
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

  await db
    .update(evaluations)
    .set({ updatedAt: now })
    .where(eq(evaluations.id, data.evaluationId));

  return { ok: true, at: now.toISOString() };
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
