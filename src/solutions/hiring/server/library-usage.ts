import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { hiringActivities, hiringActivityCompetencies, hiringOpeningMembers, hiringOpenings, hiringStages, hiringVersions } from "@/db/schema";
import type { LibraryRefs, LibraryUsage, LibraryUsageEntry, LibraryViewer } from "@/solutions/types";
import { openingAccess } from "../rules/access";

/**
 * One entry per library row: each opening once, live when any of its rows is
 * live. An opening the viewer may not see is counted but never named or linked.
 */
export function usageFromRows(
  rows: Array<{ ref: string; openingId: string; name: string; live: boolean; visible: boolean }>,
): Record<string, LibraryUsageEntry> {
  const out: Record<string, LibraryUsageEntry> = {};
  // ref -> opening id -> already counted as live
  const seen = new Map<string, Map<string, boolean>>();
  for (const row of rows) {
    const entry = (out[row.ref] ??= { total: 0, live: 0, items: [] });
    const openings = seen.get(row.ref) ?? new Map<string, boolean>();
    seen.set(row.ref, openings);
    if (!openings.has(row.openingId)) {
      openings.set(row.openingId, false);
      entry.total += 1;
      if (row.visible) entry.items.push({ label: row.name, href: `/hiring/openings/${row.openingId}` });
    }
    if (row.live && !openings.get(row.openingId)) {
      openings.set(row.openingId, true);
      entry.live += 1;
    }
  }
  return out;
}

type OpeningFacts = {
  openingId: string;
  decisionMakerId: string | null;
  backupDecisionMakerId: string | null;
  status: "DRAFT" | "OPEN" | "CLOSED";
};

/**
 * Which of these openings the viewer may see, by the same rule as the opening
 * pages (openingAccess with its status): a reviewer sees only the openings they
 * work on. No viewer means counts only.
 */
async function visibleOpenings(orgId: string, viewer: LibraryViewer | null, rows: OpeningFacts[], x: Executor = db): Promise<Set<string>> {
  if (!viewer || rows.length === 0) return new Set();
  const ids = [...new Set(rows.map((r) => r.openingId))];
  const memberOf = new Set(
    (
      await x
        .select({ openingId: hiringOpeningMembers.openingId })
        .from(hiringOpeningMembers)
        .innerJoin(hiringOpenings, eq(hiringOpenings.id, hiringOpeningMembers.openingId))
        .where(and(eq(hiringOpeningMembers.userId, viewer.id), eq(hiringOpenings.orgId, orgId), inArray(hiringOpeningMembers.openingId, ids)))
    ).map((m) => m.openingId),
  );
  const visible = new Set<string>();
  for (const r of rows) {
    const { view } = openingAccess(viewer, {
      decisionMakerId: r.decisionMakerId,
      backupDecisionMakerId: r.backupDecisionMakerId,
      memberIds: memberOf.has(r.openingId) ? [viewer.id] : [],
      status: r.status,
    });
    if (view) visible.add(r.openingId);
  }
  return visible;
}

/**
 * HIRING-UX 4.2 rule 2 for hiring: which openings use a position or a
 * competency. Totals count every opening of the organisation; only the ones
 * the viewer may see are named and linked. `x`: the caller's transaction, if any.
 */
export async function hiringLibraryUsage(orgId: string, refs: LibraryRefs, viewer: LibraryViewer | null, x: Executor = db): Promise<LibraryUsage> {
  const people = {
    decisionMakerId: hiringOpenings.decisionMakerId,
    backupDecisionMakerId: hiringOpenings.backupDecisionMakerId,
  };
  const positionRows = refs.positionIds.length
    ? await x
        .select({ ref: hiringOpenings.positionId, openingId: hiringOpenings.id, name: hiringOpenings.name, status: hiringOpenings.status, ...people })
        .from(hiringOpenings)
        .where(and(eq(hiringOpenings.orgId, orgId), inArray(hiringOpenings.positionId, refs.positionIds)))
    : [];
  const competencyRows = refs.competencyIds.length
    ? await x
        .selectDistinct({
          ref: hiringActivityCompetencies.competencyId,
          openingId: hiringOpenings.id,
          name: hiringOpenings.name,
          openingStatus: hiringOpenings.status,
          versionStatus: hiringVersions.status,
          ...people,
        })
        .from(hiringActivityCompetencies)
        .innerJoin(hiringActivities, eq(hiringActivities.id, hiringActivityCompetencies.activityId))
        .innerJoin(hiringStages, eq(hiringStages.id, hiringActivities.stageId))
        .innerJoin(hiringVersions, eq(hiringVersions.id, hiringStages.versionId))
        .innerJoin(hiringOpenings, eq(hiringOpenings.id, hiringVersions.openingId))
        .where(and(eq(hiringOpenings.orgId, orgId), inArray(hiringActivityCompetencies.competencyId, refs.competencyIds)))
    : [];
  const visible = await visibleOpenings(orgId, viewer, [...positionRows, ...competencyRows.map((r) => ({ ...r, status: r.openingStatus }))], x);
  return {
    positions: usageFromRows(
      positionRows.map((r) => ({ ref: r.ref, openingId: r.openingId, name: r.name, live: r.status === "OPEN", visible: visible.has(r.openingId) })),
    ),
    competencies: usageFromRows(
      competencyRows.map((r) => ({
        ref: r.ref,
        openingId: r.openingId,
        name: r.name,
        live: r.openingStatus === "OPEN" && r.versionStatus === "PUBLISHED",
        visible: visible.has(r.openingId),
      })),
    ),
  };
}
