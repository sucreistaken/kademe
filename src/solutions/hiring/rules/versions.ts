export type VersionSummary = {
  id: string;
  number: number;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  previewedAt: Date | null;
};

/** The draft being edited and the newest published version, whatever order `list` comes in. */
export function workingVersions(list: VersionSummary[]): { draft: VersionSummary | null; live: VersionSummary | null } {
  const newestFirst = [...list].sort((a, b) => b.number - a.number);
  return {
    draft: newestFirst.find((v) => v.status === "DRAFT") ?? null,
    live: newestFirst.find((v) => v.status === "PUBLISHED") ?? null,
  };
}
