import { describe, expect, it } from "vitest";
import { cheerKind, cheerPose } from "./SectionCheer";

describe("cheerKind", () => {
  it("welcomes on the first section with nothing finished", () => {
    expect(cheerKind(0, 1)).toBe("start");
  });

  it("shows no headline when nothing is done but an earlier section was skipped", () => {
    expect(cheerKind(0, 2)).toBe("none");
  });

  it("cheers the first finished section, then the following ones", () => {
    expect(cheerKind(1, 2)).toBe("first");
    expect(cheerKind(2, 3)).toBe("more");
    expect(cheerKind(4, 5)).toBe("more");
  });

  it("waves on the section 1 intro, celebrates once something is done, and is absent otherwise", () => {
    expect(cheerPose(cheerKind(0, 1))).toBe("wave");
    expect(cheerPose(cheerKind(0, 2))).toBeNull();
    expect(cheerPose(cheerKind(1, 2))).toBe("celebrate");
    expect(cheerPose(cheerKind(3, 4))).toBe("celebrate");
  });
});
