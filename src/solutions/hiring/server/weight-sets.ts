import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, hiringWeightSets, hiringWeights } from "@/db/schema";
import { isUuid } from "@/server/settings";
import { workingVersions } from "../rules/versions";
import { weightSetPercentages } from "../rules/weights";
import { frozenAsConflict, HiringNotFound } from "./errors";
import { assertActiveUser, lockOpening, versionRow, versionsOf } from "./versions";

export type WeightSetOutcome = { ok: true } | { ok: false; code: "NO_LIVE" | "REASON_REQUIRED" | "NOT_100"; total?: number };

/** Shortest reason accepted for a weight change after publishing. */
export const WEIGHT_REASON_MIN = 3;

/**
 * A weight change after publishing is a new set with a reason (HIRING-UX 5.7,
 * R10): scores already given keep the set they were computed with, and the
 * published scorecard is never touched. Recomputing is a separate step (plan 3).
 *
 * One transaction under the opening's lock (the same first lock as publishing
 * and draft writes): the live version is found in the caller's organisation,
 * its sets are deactivated and the new one inserted, so there is never a moment
 * with two active sets (one_active_weight_set) or a half-written switch. The set
 * holds exactly the published scorecard's competencies (weightSetPercentages).
 * The author must be an active user of the organisation; a CLOSED opening is
 * history (HiringConflict CLOSED), another organisation's is not found.
 */
export async function addWeightSet(
  orgId: string,
  openingId: string,
  input: { enabled: boolean; weights: Record<string, number>; reason: string },
  userId: string,
): Promise<WeightSetOutcome> {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < WEIGHT_REASON_MIN) return { ok: false, code: "REASON_REQUIRED" };
  if (!isUuid(userId)) throw new HiringNotFound("user");
  // Weight sets are not frozen by the triggers; the mapping keeps any freeze refusal typed all the same.
  return frozenAsConflict(() =>
    db.transaction(async (tx): Promise<WeightSetOutcome> => {
      await lockOpening(tx, orgId, openingId);
      await assertActiveUser(tx, orgId, userId);
      const { live } = workingVersions(await versionsOf(orgId, openingId, tx));
      if (!live) return { ok: false, code: "NO_LIVE" };
      const version = await versionRow(tx, orgId, live.id);
      if (!version || version.status !== "PUBLISHED" || !version.scorecard) return { ok: false, code: "NO_LIVE" };
      const result = weightSetPercentages(version.scorecard, { enabled: input.enabled === true, weights: input.weights ?? {} });
      if (!result.ok) return { ok: false, code: "NOT_100", total: result.total };

      await tx
        .update(hiringWeightSets)
        .set({ isActive: false })
        .where(and(eq(hiringWeightSets.versionId, version.id), eq(hiringWeightSets.isActive, true)));
      const [set] = await tx
        .insert(hiringWeightSets)
        .values({ versionId: version.id, label: new Date().toISOString().slice(0, 10), isActive: input.enabled === true, reason, createdBy: userId })
        .returning({ id: hiringWeightSets.id });
      const rows = Object.entries(result.weights).map(([competencyId, percentage]) => ({ weightSetId: set.id, competencyId, percentage: percentage.toFixed(2) }));
      if (rows.length) await tx.insert(hiringWeights).values(rows);
      await tx.insert(auditLogs).values({
        orgId,
        actorId: userId,
        action: "hiring.weights.add",
        subjectType: "hiring_version",
        subjectId: version.id,
        meta: { openingId, weightSetId: set.id, enabled: input.enabled === true, weights: result.weights, reason },
      });
      return { ok: true };
    }),
  );
}
