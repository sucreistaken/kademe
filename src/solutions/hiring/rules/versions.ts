export type VersionSummary = {
  id: string;
  number: number;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  previewedAt: Date | null;
};

/** The draft being edited and the newest published version; `list` is newest first. */
export function workingVersions(list: VersionSummary[]): { draft: VersionSummary | null; live: VersionSummary | null } {
  return {
    draft: list.find((v) => v.status === "DRAFT") ?? null,
    live: list.find((v) => v.status === "PUBLISHED") ?? null,
  };
}
