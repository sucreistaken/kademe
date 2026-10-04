import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { hiringActivities, hiringActivityCompetencies, hiringOpenings, hiringStages, hiringVersions } from "@/db/schema";
import type { LibraryRefs, LibraryUsage, LibraryUsageEntry } from "@/solutions/types";

/** One entry per library row: each opening once, live when any of its rows is live. */
export function usageFromRows(rows: Array<{ ref: string; openingId: string; name: string; live: boolean }>): Record<string, LibraryUsageEntry> {
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
      entry.items.push({ label: row.name, href: `/hiring/openings/${row.openingId}` });
    }
    if (row.live && !openings.get(row.openingId)) {
      openings.set(row.openingId, true);
      entry.live += 1;
    }
  }
  return out;
}

/** HIRING-UX 4.2 rule 2 for hiring: which openings use a position or a competency. */
export async function hiringLibraryUsage(orgId: string, refs: LibraryRefs): Promise<LibraryUsage> {
  const positionRows = refs.positionIds.length
    ? await db
        .select({ ref: hiringOpenings.positionId, openingId: hiringOpenings.id, name: hiringOpenings.name, status: hiringOpenings.status })
        .from(hiringOpenings)
        .where(and(eq(hiringOpenings.orgId, orgId), inArray(hiringOpenings.positionId, refs.positionIds)))
    : [];
  const competencyRows = refs.competencyIds.length
    ? await db
        .selectDistinct({
          ref: hiringActivityCompetencies.competencyId,
          openingId: hiringOpenings.id,
          name: hiringOpenings.name,
          openingStatus: hiringOpenings.status,
          versionStatus: hiringVersions.status,
        })
        .from(hiringActivityCompetencies)
        .innerJoin(hiringActivities, eq(hiringActivities.id, hiringActivityCompetencies.activityId))
        .innerJoin(hiringStages, eq(hiringStages.id, hiringActivities.stageId))
        .innerJoin(hiringVersions, eq(hiringVersions.id, hiringStages.versionId))
        .innerJoin(hiringOpenings, eq(hiringOpenings.id, hiringVersions.openingId))
        .where(and(eq(hiringOpenings.orgId, orgId), inArray(hiringActivityCompetencies.competencyId, refs.competencyIds)))
    : [];
  return {
    positions: usageFromRows(positionRows.map((r) => ({ ref: r.ref, openingId: r.openingId, name: r.name, live: r.status === "OPEN" }))),
    competencies: usageFromRows(
      competencyRows.map((r) => ({ ref: r.ref, openingId: r.openingId, name: r.name, live: r.openingStatus === "OPEN" && r.versionStatus === "PUBLISHED" })),
    ),
  };
}
