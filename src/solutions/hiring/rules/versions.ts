export type VersionSummary = {
  id: string;
  number: number;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  previewedAt: Date | null;
  /** Moved by every draft write (server/versions.ts draftOf), so a preview older than it is stale. */
  updatedAt: Date;
};

/** The draft being edited and the newest published version, whatever order `list` comes in. */
export function workingVersions(list: VersionSummary[]): { draft: VersionSummary | null; live: VersionSummary | null } {
  const newestFirst = [...list].sort((a, b) => b.number - a.number);
  return {
    draft: newestFirst.find((v) => v.status === "DRAFT") ?? null,
    live: newestFirst.find((v) => v.status === "PUBLISHED") ?? null,
  };
}

/** The readiness "preview" row is done only for a preview taken after the draft's last change. */
export function previewIsCurrent(v: { previewedAt: Date | null; updatedAt: Date }): boolean {
  return v.previewedAt !== null && v.previewedAt.getTime() >= v.updatedAt.getTime();
}
