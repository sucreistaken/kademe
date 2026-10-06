import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { competencies, competencyAnchors, observationTags, ratingScales, scaleLevels } from "@/db/schema";
import { DEFAULT_SCALE, SEED_COMPETENCIES } from "./library-seed-data";

/**
 * Writes the starter library for one organisation. Safe to run any number of
 * times: the default scale is created only when the organisation has none, and
 * a competency only when no row carries its seed key, so a renamed, edited or
 * archived starter competency is never touched again. `x` lets a caller's
 * transaction create the scale with its own writes (a savepoint inside it).
 */
export async function ensureDefaultScale(orgId: string, x: Executor = db): Promise<{ id: string; created: boolean }> {
  const find = async () =>
    (
      await x
        .select({ id: ratingScales.id })
        .from(ratingScales)
        .where(and(eq(ratingScales.orgId, orgId), eq(ratingScales.isDefault, true)))
        .limit(1)
    )[0];
  const existing = await find();
  if (existing) return { id: existing.id, created: false };
  const created = await x.transaction(async (tx) => {
    const [scale] = await tx
      .insert(ratingScales)
      .values({ orgId, name: DEFAULT_SCALE.name, minValue: 1, maxValue: 5, isDefault: true })
      .onConflictDoNothing()
      .returning({ id: ratingScales.id });
    if (!scale) return null;
    await tx.insert(scaleLevels).values(DEFAULT_SCALE.levels.map((l) => ({ scaleId: scale.id, value: l.value, label: { ...l.label } })));
    return scale.id;
  });
  if (created) return { id: created, created: true };
  // Another request created it between the two statements.
  const raced = await find();
  if (!raced) throw new Error(`organisation ${orgId} has no default rating scale`);
  return { id: raced.id, created: false };
}

export async function seedLibrary(orgId: string): Promise<{ scaleCreated: boolean; competenciesCreated: number }> {
  const scale = await ensureDefaultScale(orgId);
  let competenciesCreated = 0;
  for (const item of SEED_COMPETENCIES) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(competencies)
        .values({ orgId, name: item.name, description: item.description, scaleId: scale.id, seedKey: item.key })
        .onConflictDoNothing()
        .returning({ id: competencies.id });
      if (!row) return;
      competenciesCreated += 1;
      await tx.insert(competencyAnchors).values(
        ([1, 3, 5] as const).map((value) => ({ competencyId: row.id, value, body: item.anchors[value] })),
      );
      await tx.insert(observationTags).values([
        ...item.positive.map((label, i) => ({ competencyId: row.id, polarity: "POSITIVE" as const, label, orderIndex: i })),
        ...item.negative.map((label, i) => ({
          competencyId: row.id,
          polarity: "NEGATIVE" as const,
          label,
          orderIndex: item.positive.length + i,
        })),
      ]);
    });
  }
  return { scaleCreated: scale.created, competenciesCreated };
}
