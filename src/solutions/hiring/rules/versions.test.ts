import { describe, expect, it } from "vitest";
import { workingVersions } from "./versions";

const v = (number: number, status: "DRAFT" | "PUBLISHED") => ({ id: `v${number}`, number, status, publishedAt: null, previewedAt: null });

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
