import { describe, expect, it } from "vitest";
import { previewIsCurrent, workingVersions } from "./versions";

const v = (number: number, status: "DRAFT" | "PUBLISHED") => ({ id: `v${number}`, number, status, publishedAt: null, previewedAt: null, updatedAt: new Date(0) });

describe("working versions", () => {
  it("finds the draft and the newest published version (list is newest first)", () => {
    expect(workingVersions([v(3, "DRAFT"), v(2, "PUBLISHED"), v(1, "PUBLISHED")])).toMatchObject({ draft: { id: "v3" }, live: { id: "v2" } });
    expect(workingVersions([v(1, "DRAFT")])).toMatchObject({ draft: { id: "v1" }, live: null });
    expect(workingVersions([])).toEqual({ draft: null, live: null });
  });

  it("does not rely on the list order", () => {
    expect(workingVersions([v(1, "PUBLISHED"), v(2, "PUBLISHED"), v(3, "DRAFT")])).toMatchObject({ draft: { id: "v3" }, live: { id: "v2" } });
  });
});

describe("the preview stamp (HIRING-UX 5.4 readiness)", () => {
  const at = (iso: string) => new Date(iso);
  it("counts only a preview taken after the draft's last change", () => {
    expect(previewIsCurrent({ previewedAt: at("2026-10-04T10:05:00Z"), updatedAt: at("2026-10-04T10:00:00Z") })).toBe(true);
    expect(previewIsCurrent({ previewedAt: at("2026-10-04T10:00:00Z"), updatedAt: at("2026-10-04T10:00:00Z") })).toBe(true);
    expect(previewIsCurrent({ previewedAt: at("2026-10-04T10:00:00Z"), updatedAt: at("2026-10-04T10:00:01Z") })).toBe(false);
    expect(previewIsCurrent({ previewedAt: null, updatedAt: at("2026-10-04T10:00:00Z") })).toBe(false);
  });
});
