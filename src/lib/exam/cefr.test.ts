import { describe, expect, it } from "vitest";
import {
  levelFromTheta,
  medianLevel,
  normalCdf,
  probAtOrAbove,
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

  it("everyone holds A1", () => {
    expect(probAtOrAbove({ mean: -9, sd: 0.1 }, "A1")).toBe(1);
  });
});
