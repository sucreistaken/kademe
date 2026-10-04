import type { LibraryRefs, LibraryUsage, LibraryUsageEntry } from "@/solutions/types";

export type SolutionUsage = { solution: string; label: string; usage: LibraryUsage };
export type UsageGroup = { solution: string; label: string; entry: LibraryUsageEntry };

/**
 * One list per library row, grouped by solution (HIRING-UX 4.2 rule 2). A
 * solution that does not use the row adds no group, so a new solution adds a
 * group without the library screen changing.
 */
export function groupUsage(results: SolutionUsage[], refs: LibraryRefs) {
  const pick = (kind: "positions" | "competencies", id: string): UsageGroup[] =>
    results.flatMap((r) => {
      const entry = r.usage[kind][id];
      return entry && entry.total > 0 ? [{ solution: r.solution, label: r.label, entry }] : [];
    });
  return {
    positions: Object.fromEntries(refs.positionIds.map((id) => [id, pick("positions", id)])) as Record<string, UsageGroup[]>,
    competencies: Object.fromEntries(refs.competencyIds.map((id) => [id, pick("competencies", id)])) as Record<string, UsageGroup[]>,
  };
}

/** Published assessments that keep the old definition after an edit (HIRING-UX 4.2 rule 1). */
export function liveCount(groups: UsageGroup[]): number {
  return groups.reduce((n, g) => n + g.entry.live, 0);
}
