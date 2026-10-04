import { workingVersions, type VersionSummary } from "@/solutions/hiring/rules/versions";

export type HistoryRow = { id: string; number: number; state: "draft" | "live" | "earlier"; publishedAt: Date | null };

/**
 * The version history of an opening's assessment (HIRING-UX 4.3), newest
 * first: the draft being edited, the live version (the newest published one)
 * and the earlier published versions, which never change.
 */
export function versionHistory(list: VersionSummary[]): HistoryRow[] {
  const { draft, live } = workingVersions(list);
  return [...list]
    .sort((a, b) => b.number - a.number)
    .map((v) => ({
      id: v.id,
      number: v.number,
      state: v.id === draft?.id ? "draft" : v.id === live?.id ? "live" : "earlier",
      publishedAt: v.publishedAt,
    }));
}
