import { describe, expect, it } from "vitest";
import { gapResults, scoreItem } from "./item-scoring";

describe("gapResults", () => {
  const key = { kind: "GAP" as const, answers: { g1: ["dem"], g2: ["den", "denn"], g3: ["x"] }, topics: { g1: "dativ", g2: "akkusativ" } };
  const content = { kind: "GAP" as const, gaps: [{ id: "g1" }, { id: "g2" }, { id: "g3" }] };

  it("gives topic and right, wrong or blank per gap, null topic when the key has none", () => {
    expect(gapResults({ key }, { gaps: { g1: " Dem ", g2: "der", g3: "  " } })).toEqual([
      { gapId: "g1", topic: "dativ", outcome: "right" },
      { gapId: "g2", topic: "akkusativ", outcome: "wrong" },
      { gapId: "g3", topic: null, outcome: "blank" },
    ]);
  });

  it("treats a missing answer as all blank and a non-gap key as no gaps", () => {
    expect(gapResults({ key }, null).map((g) => g.outcome)).toEqual(["blank", "blank", "blank"]);
    expect(gapResults({ key: { kind: "CHOICE", correct: ["a"] } }, null)).toEqual([]);
  });

  it("agrees with scoreItem on the number of right gaps", () => {
    const answers = [{ gaps: { g1: "dem", g2: "denn", g3: "y" } }, { gaps: { g1: "DEM", g2: "", g3: "x" } }, null];
    for (const a of answers) {
      const right = gapResults({ key }, a).filter((g) => g.outcome === "right").length;
      expect(scoreItem("GAP_FILL", content, key, a)?.score).toBeCloseTo(right / 3);
    }
  });
});
