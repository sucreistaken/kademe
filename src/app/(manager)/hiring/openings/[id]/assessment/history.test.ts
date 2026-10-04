import { describe, expect, it } from "vitest";
import type { VersionSummary } from "@/solutions/hiring/rules/versions";
import { versionHistory } from "./history";

const v = (number: number, status: VersionSummary["status"]): VersionSummary => ({
  id: `v${number}`,
  number,
  status,
  publishedAt: status === "PUBLISHED" ? new Date(Date.UTC(2026, 9, number)) : null,
  previewedAt: null,
  updatedAt: new Date(0),
});

describe("versionHistory (HIRING-UX 4.3)", () => {
  it("lists newest first: the draft, the live version, then earlier published ones", () => {
    expect(versionHistory([v(1, "PUBLISHED"), v(3, "DRAFT"), v(2, "PUBLISHED")]).map((r) => [r.number, r.state])).toEqual([
      [3, "draft"],
      [2, "live"],
      [1, "earlier"],
    ]);
  });

  it("has no live row before the first publish", () => {
    expect(versionHistory([v(1, "DRAFT")]).map((r) => r.state)).toEqual(["draft"]);
  });

  it("keeps the publish date of every published version", () => {
    const rows = versionHistory([v(1, "PUBLISHED"), v(2, "PUBLISHED")]);
    expect(rows[0].publishedAt?.toISOString()).toBe("2026-10-02T00:00:00.000Z");
    expect(rows[1].publishedAt?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});
