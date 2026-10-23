import { describe, expect, it } from "vitest";
import {
  PRE_A1_CUT,
  RESULT_CUTS,
  compareLevels,
  isCefr,
  isResultLevel,
  levelFromTheta,
  levelIndex,
  maxLevel,
  medianLevel,
  minLevel,
  normalCdf,
  probAtOrAbove,
  resultLevelFromTheta,
  shiftLevel,
  thetaForLevel,
} from "./cefr";

describe("levels on the scale", () => {
  it("maps band centres back to their level", () => {
    for (const l of ["A1", "A2", "B1", "B2", "C1", "C2"] as const) {
      expect(levelFromTheta(thetaForLevel(l)).level).toBe(l);
    }
  });

  it("puts a cut score in the upper level", () => {
    expect(levelFromTheta(0).level).toBe("B2");
    expect(levelFromTheta(-0.0001).level).toBe("B1");
  });

  it("floors at A1 and says it is below the scale", () => {
    expect(levelFromTheta(-5)).toEqual({ level: "A1", belowScale: true });
    expect(levelFromTheta(9).level).toBe("C2");
  });

  it("clamps shifts at the ends", () => {
    expect(shiftLevel("A1", -1)).toBe("A1");
    expect(shiftLevel("C1", 3)).toBe("C2");
    expect(shiftLevel("B1", 1)).toBe("B2");
  });
});

describe("median level", () => {
  it("takes the lower middle for an even count", () => {
    expect(medianLevel(["B2", "B1", "C1", "A2"])).toBe("B1");
  });
  it("is null for nothing", () => {
    expect(medianLevel([])).toBe(null);
  });
});

describe("holding a level", () => {
  it("normal cdf is sane", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it("is one half at the edge and near certain far above", () => {
    expect(probAtOrAbove({ mean: -1, sd: 0.4 }, "B1")).toBeCloseTo(0.5, 5);
    expect(probAtOrAbove({ mean: 1, sd: 0.3 }, "B1")).toBeGreaterThan(0.99);
    expect(probAtOrAbove({ mean: -2, sd: 0.3 }, "B1")).toBeLessThan(0.01);
  });

  it("holding A1 means being above the A0 (Pre-A1) band, the same rule as every other level", () => {
    expect(probAtOrAbove({ mean: -3, sd: 0.4 }, "A1")).toBeCloseTo(0.5, 5);
    expect(probAtOrAbove({ mean: -9, sd: 0.1 }, "A1")).toBeLessThan(0.01);
    expect(probAtOrAbove({ mean: -1.5, sd: 0.3 }, "A1")).toBeGreaterThan(0.99);
  });
});

describe("A0 (Pre-A1), a result level below A1", () => {
  it("reads theta below the A1 band as A0 and the band itself as A1", () => {
    expect(PRE_A1_CUT).toBe(-3);
    expect(resultLevelFromTheta(-5)).toBe("A0");
    expect(resultLevelFromTheta(-3.0001)).toBe("A0");
    expect(resultLevelFromTheta(-3)).toBe("A1");
    expect(resultLevelFromTheta(thetaForLevel("A1"))).toBe("A1");
    expect(resultLevelFromTheta(0)).toBe("B2");
  });

  it("keeps the item scale: levelFromTheta still floors at A1 for choosing items", () => {
    expect(levelFromTheta(-5).level).toBe("A1");
  });

  it("orders A0 below A1 without moving the CEFR indexes", () => {
    expect(levelIndex("A0")).toBe(-1);
    expect(levelIndex("A1")).toBe(0);
    expect(levelIndex("C2")).toBe(5);
    expect(compareLevels("A0", "A1")).toBeLessThan(0);
    expect(compareLevels("A0", "A0")).toBe(0);
    expect(RESULT_CUTS).toEqual([-3, -2, -1, 0, 1, 2]);
  });

  it("takes A0 into the lower median, min and max", () => {
    expect(medianLevel(["A0", "A1", "B1"])).toBe("A1");
    expect(medianLevel(["A0", "A0", "A1", "B1"])).toBe("A0");
    expect(minLevel(["B1", "A0"])).toBe("A0");
    expect(maxLevel(["A0", "A2"])).toBe("A2");
  });

  it("tells a result level from a CEFR level", () => {
    expect(isResultLevel("A0")).toBe(true);
    expect(isResultLevel("C2")).toBe(true);
    expect(isResultLevel("B3")).toBe(false);
    expect(isCefr("A0")).toBe(false);
  });
});
