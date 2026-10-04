import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, competencies, hiringOpenings, hiringVersions, hiringWeightSets, hiringWeights } from "@/db/schema";
import { isUuid } from "@/server/settings";
import { usedCompetencyIds } from "../rules/content";
import { publishProblems, type PublishProblem } from "../rules/gate";
import { buildScorecard } from "../rules/scorecard";
import { workingVersions } from "../rules/versions";
import { loadCompetencyFacts, loadScaleSnapshot, loadVersionContent, positionProfile } from "./content";
import { frozenAsConflict, HiringConflict, HiringNotFound } from "./errors";
import { assertActiveUser, lockOpening, versionsOf } from "./versions";

export type PublishOutcome = { ok: true; versionId: string; number: number } | { ok: false; problems: PublishProblem[] };

/**
 * Publish = lock (hiring solution design 2.2-2.3). One transaction at READ
 * COMMITTED, in this lock order:
 *
 * 1. the opening, FOR UPDATE by id AND org_id (lockOpening; a CLOSED opening
 *    refuses). Every draft write takes this lock first too, so a draft write
 *    either finished before the publish or waits and then finds no draft;
 * 2. the draft version, FOR UPDATE by id AND org_id, and still a DRAFT;
 * 3. the measured competencies, FOR SHARE. Every library write to a
 *    competency (its row, its anchors, its tags) first locks the competency
 *    row FOR UPDATE or updates it, so the gate and the snapshot read one state
 *    of each competency with its anchors and tags. The rating scale and the
 *    position profile are read without a lock: a scale or profile save that
 *    commits meanwhile may or may not be in the snapshot;
 * 4. the gate on the draft as stored; any problem returns before a write;
 * 5. the scorecard snapshot (anchors, tags, weights), the status change with
 *    published_at and published_by together, the first weight set, the opening
 *    opened, the audit row.
 *
 * After this the triggers of migrations 0006/0008 refuse every change to the
 * version; a freeze refusal here is answered NO_DRAFT (frozenAsConflict), never
 * a raw 23514. The version's languages are not written: the row already passed
 * the default-locale-in-set CHECK.
 */
export async function publishDraft(orgId: string, openingId: string, userId: string): Promise<PublishOutcome> {
  if (!isUuid(userId)) throw new HiringNotFound("user");
  return frozenAsConflict(() =>
    db.transaction(async (tx) => {
      const opening = await lockOpening(tx, orgId, openingId);
      await assertActiveUser(tx, orgId, userId);
      const { draft } = workingVersions(await versionsOf(orgId, openingId, tx));
      if (!draft) throw new HiringConflict("NO_DRAFT");
      const [version] = await tx
        .select({ id: hiringVersions.id, number: hiringVersions.versionNumber, status: hiringVersions.status })
        .from(hiringVersions)
        .where(and(eq(hiringVersions.id, draft.id), eq(hiringVersions.orgId, orgId), eq(hiringVersions.openingId, openingId)))
        .for("update");
      if (!version || version.status !== "DRAFT") throw new HiringConflict("NO_DRAFT");

      const content = await loadVersionContent(orgId, version.id, tx);
      if (!content) throw new HiringConflict("NO_DRAFT");
      const used = usedCompetencyIds(content);
      if (used.length) {
        await tx
          .select({ id: competencies.id })
          .from(competencies)
          .where(and(eq(competencies.orgId, orgId), inArray(competencies.id, used)))
          .orderBy(asc(competencies.id))
          .for("share");
      }
      const facts = await loadCompetencyFacts(orgId, used, tx);
      const problems = publishProblems(content, facts);
      if (problems.length) return { ok: false as const, problems };

      // Only after the gate passed: buildScorecard throws on a measured competency without a weight.
      const scorecard = buildScorecard({
        content,
        facts,
        scale: await loadScaleSnapshot(orgId, tx),
        profile: await positionProfile(orgId, opening.positionId, tx),
      });
      const now = new Date();
      const updated = await tx
        .update(hiringVersions)
        .set({ status: "PUBLISHED", scorecard, publishedAt: now, publishedBy: userId, updatedAt: now })
        .where(and(eq(hiringVersions.id, version.id), eq(hiringVersions.orgId, orgId), eq(hiringVersions.status, "DRAFT")))
        .returning({ id: hiringVersions.id });
      if (updated.length !== 1) throw new HiringConflict("NO_DRAFT");
      const [set] = await tx
        .insert(hiringWeightSets)
        .values({ versionId: version.id, label: `v${version.number}`, isActive: scorecard.weightsEnabled, createdBy: userId })
        .returning({ id: hiringWeightSets.id });
      if (scorecard.competencies.length) {
        await tx
          .insert(hiringWeights)
          .values(scorecard.competencies.map((c) => ({ weightSetId: set.id, competencyId: c.id, percentage: c.weight.toFixed(2) })));
      }
      if (opening.status === "DRAFT") {
        await tx
          .update(hiringOpenings)
          .set({ status: "OPEN", updatedAt: now })
          .where(and(eq(hiringOpenings.id, openingId), eq(hiringOpenings.orgId, orgId)));
      }
      await tx.insert(auditLogs).values({
        orgId,
        actorId: userId,
        action: "hiring.version.publish",
        subjectType: "hiring_version",
        subjectId: version.id,
        meta: { openingId, number: version.number, competencies: used.length, weightsEnabled: scorecard.weightsEnabled },
      });
      return { ok: true as const, versionId: version.id, number: version.number };
    }),
  );
}
