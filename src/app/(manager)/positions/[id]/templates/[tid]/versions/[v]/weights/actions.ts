"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  weightSets,
  weights,
  templateVersions,
  evaluations,
  evaluationItems,
  attempts,
  assessments,
  auditLogs,
} from "@/db/schema";
import { requireUser } from "@/server/session";
import { overallScore, weightsAreValid } from "@/lib/scoring";

const saveSchema = z.object({
  versionId: z.string().uuid(),
  entries: z
    .array(
      z.object({
        competencyId: z.string().uuid(),
        percentage: z.number().min(0).max(100),
      }),
    )
    .min(1),
});

/**
 * Codes, not sentences: the editor renders them in the manager's own language.
 * `NOT_100` carries the total it saw, because the number is the whole point of
 * the message and the client's copy of it may already have moved on.
 */
export type WeightsError =
  | { code: "READ_FAILED" }
  | { code: "INVALID" }
  | { code: "VERSION_NOT_FOUND" }
  | { code: "NOT_100"; total: string };

export type WeightsResult =
  | { status: "idle" }
  | ({ status: "error" } & WeightsError)
  | { status: "saved"; weightSetId: string };

/**
 * Saving never edits the current set. It creates a NEW one and retires the old,
 * because scores already computed point at the set they were computed with. A
 * candidate scored last month must not silently change because the weighting
 * was retuned this month; recalculating is a separate, explicit action.
 */
export async function saveWeights(
  _previous: WeightsResult,
  formData: FormData,
): Promise<WeightsResult> {
  const user = await requireUser("template:write");

  const versionId = String(formData.get("versionId") ?? "");
  let entries: z.infer<typeof saveSchema>["entries"];
  try {
    entries = JSON.parse(String(formData.get("entries") ?? "[]"));
  } catch {
    return { status: "error", code: "READ_FAILED" };
  }

  const parsed = saveSchema.safeParse({ versionId, entries });
  if (!parsed.success) {
    return { status: "error", code: "INVALID" };
  }

  const [version] = await db
    .select({ id: templateVersions.id })
    .from(templateVersions)
    .where(
      and(
        eq(templateVersions.id, parsed.data.versionId),
        eq(templateVersions.orgId, user.orgId),
      ),
    )
    .limit(1);
  if (!version) return { status: "error", code: "VERSION_NOT_FOUND" };

  const total = parsed.data.entries.reduce((acc, e) => acc + e.percentage, 0);
  if (!weightsAreValid(parsed.data.entries)) {
    return { status: "error", code: "NOT_100", total: total.toFixed(0) };
  }

  /**
   * Saving weights and switching weighting on are two different decisions.
   * Writing numbers into this form must not silently start applying them to
   * every score, so the new set inherits whatever the current state was: if
   * weighting was off, it stays off until the manager turns it on.
   */
  const [wasEnabled] = await db
    .select({ id: weightSets.id })
    .from(weightSets)
    .where(
      and(
        eq(weightSets.versionId, parsed.data.versionId),
        eq(weightSets.isActive, 1),
      ),
    )
    .limit(1);

  const [created] = await db.transaction(async (tx) => {
    await tx
      .update(weightSets)
      .set({ isActive: 0 })
      .where(eq(weightSets.versionId, parsed.data.versionId));

    const [set] = await tx
      .insert(weightSets)
      .values({
        versionId: parsed.data.versionId,
        label: new Date().toISOString().slice(0, 10),
        isActive: wasEnabled ? 1 : 0,
      })
      .returning();

    await tx.insert(weights).values(
      parsed.data.entries.map((e) => ({
        weightSetId: set.id,
        competencyId: e.competencyId,
        percentage: e.percentage.toFixed(2),
      })),
    );
    return [set];
  });

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "weights.save",
    subjectType: "template_version",
    subjectId: parsed.data.versionId,
    meta: { weightSetId: created.id, entries: parsed.data.entries },
  });

  revalidatePath("/compare");
  return { status: "saved", weightSetId: created.id };
}

/** Weighting is off by default; a plain average is enough for most managers. */
export async function setWeightingEnabled(versionId: string, enabled: boolean) {
  const user = await requireUser("template:write");

  const [latest] = await db
    .select({ id: weightSets.id })
    .from(weightSets)
    .innerJoin(
      templateVersions,
      eq(templateVersions.id, weightSets.versionId),
    )
    .where(
      and(
        eq(weightSets.versionId, versionId),
        eq(templateVersions.orgId, user.orgId),
      ),
    )
    .orderBy(sql`${weightSets.createdAt} desc`)
    .limit(1);
  if (!latest) return { ok: false as const, code: "NO_WEIGHT_SET" as const };

  await db.transaction(async (tx) => {
    await tx
      .update(weightSets)
      .set({ isActive: 0 })
      .where(eq(weightSets.versionId, versionId));
    if (enabled) {
      await tx
        .update(weightSets)
        .set({ isActive: 1 })
        .where(eq(weightSets.id, latest.id));
    }
  });

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: enabled ? "weights.enable" : "weights.disable",
    subjectType: "template_version",
    subjectId: versionId,
  });

  revalidatePath("/compare");
  return { ok: true as const };
}

/**
 * Recomputes stored overall scores against the active weight set. Deliberately
 * a button the manager presses, never a side effect of saving: rewriting past
 * scores is a decision, and they should be the one making it.
 */
export async function recalculateScores(versionId: string) {
  const user = await requireUser("template:write");

  const [activeSet] = await db
    .select()
    .from(weightSets)
    .where(
      and(eq(weightSets.versionId, versionId), eq(weightSets.isActive, 1)),
    )
    .limit(1);

  const weightRows = activeSet
    ? await db
        .select()
        .from(weights)
        .where(eq(weights.weightSetId, activeSet.id))
    : [];
  const weightList = weightRows.map((w) => ({
    competencyId: w.competencyId,
    percentage: Number(w.percentage),
  }));

  const evaluationRows = await db
    .select({ id: evaluations.id })
    .from(evaluations)
    .innerJoin(attempts, eq(attempts.id, evaluations.attemptId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(
      and(
        eq(assessments.versionId, versionId),
        eq(assessments.orgId, user.orgId),
      ),
    );

  if (evaluationRows.length === 0) return { ok: true as const, updated: 0 };

  const ids = evaluationRows.map((e) => e.id);
  const items = await db
    .select()
    .from(evaluationItems)
    .where(inArray(evaluationItems.evaluationId, ids));

  let updated = 0;
  for (const evaluation of evaluationRows) {
    const mine = items.filter((i) => i.evaluationId === evaluation.id);
    // One competency may be measured in several stages. Average it within the
    // competency first, so a competency scored three times does not outweigh
    // one scored once.
    const byCompetency = new Map<string, number[]>();
    for (const item of mine) {
      if (item.score === null) continue;
      const list = byCompetency.get(item.competencyId) ?? [];
      list.push(item.score);
      byCompetency.set(item.competencyId, list);
    }
    const perCompetency = [...byCompetency.entries()].map(
      ([competencyId, scores]) => ({
        competencyId,
        score: scores.reduce((a, b) => a + b, 0) / scores.length,
      }),
    );

    const score = overallScore(
      perCompetency,
      weightList.length > 0 ? weightList : null,
    );
    await db
      .update(evaluations)
      .set({
        overallScore: score === null ? null : score.toFixed(2),
        weightSetId: activeSet?.id ?? null,
      })
      .where(eq(evaluations.id, evaluation.id));
    updated += 1;
  }

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "weights.recalculate",
    subjectType: "template_version",
    subjectId: versionId,
    meta: { updated, weightSetId: activeSet?.id ?? null },
  });

  revalidatePath("/compare");
  return { ok: true as const, updated };
}
