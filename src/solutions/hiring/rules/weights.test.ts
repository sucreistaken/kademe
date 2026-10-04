import { PgDialect, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { hiringWeights } from "@/db/schema";
import { defaultWeights, evenSplit, missingWeights, toPercentages, weightSetPercentages, weightsProblem } from "./weights";

describe("weights", () => {
  it("splits evenly, earlier rows take the remainder", () => {
    expect(evenSplit(3)).toEqual([34, 33, 33]);
    expect(evenSplit(0)).toEqual([]);
  });

  it("scales importance to whole percentages (largest remainder, ties to the earlier row)", () => {
    expect(toPercentages([50, 25, 25])).toEqual([50, 25, 25]);
    expect(toPercentages([2, 1])).toEqual([67, 33]);
    expect(toPercentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(toPercentages([0, 0])).toEqual([50, 50]);
    expect(toPercentages([0, 50])).toEqual([0, 100]);
  });

  it("always adds up to exactly 100", () => {
    for (let seed = 1; seed < 300; seed += 1) {
      const raw = Array.from({ length: (seed % 7) + 1 }, (_, i) => (seed * (i + 3) * 37) % 101);
      expect(toPercentages(raw).reduce((a, b) => a + b, 0), String(raw)).toBe(100);
    }
  });

  it("breaks exact ties toward the earlier row", () => {
    // 57.5 and 42.5 are both exact halves: the earlier row takes the spare point.
    expect(toPercentages([23, 17])).toEqual([58, 42]);
    expect(toPercentages([17, 23])).toEqual([43, 57]);
    expect(toPercentages([1, 1])).toEqual([50, 50]);
    expect(toPercentages([1, 1, 1, 1, 1, 1, 1])).toEqual([15, 15, 14, 14, 14, 14, 14]);
  });

  it("falls back to an even split when the importances cannot be added up", () => {
    expect(toPercentages([Number.MAX_VALUE, Number.MAX_VALUE])).toEqual([50, 50]);
    expect(toPercentages([Number.POSITIVE_INFINITY, 1])).toEqual([0, 100]);
  });

  it("agrees with the database: every percentage is a whole number between 0 and 100 (hiring_weight_percentage)", () => {
    const check = getTableConfig(hiringWeights).checks.find((c) => c.name === "hiring_weight_percentage");
    expect(check).toBeDefined();
    expect(new PgDialect().sqlToQuery(check!.value).sql).toMatch(/between 0 and 100/i);
    for (const raw of [[1], [0, 0, 0], [3, 0, 0, 7], [-5, 10], [Number.NaN, 4], [100, 1, 1, 1, 1, 1, 1]]) {
      const out = toPercentages(raw);
      expect(out.every((p) => Number.isInteger(p) && p >= 0 && p <= 100), String(raw)).toBe(true);
      expect(out.reduce((a, b) => a + b, 0), String(raw)).toBe(100);
    }
  });

  it("takes defaults from the position profile; a measured competency missing from it counts as the profile's average", () => {
    const profile = [
      { competencyId: "c1", weight: 60 },
      { competencyId: "c2", weight: 20 },
    ];
    expect(defaultWeights(["c1", "c2"], profile)).toEqual({ c1: 75, c2: 25 });
    expect(defaultWeights(["c1", "c2", "c3"], profile)).toEqual({ c1: 50, c2: 17, c3: 33 });
    expect(defaultWeights(["c1", "c2"], [])).toEqual({ c1: 50, c2: 50 });
    // an average that is not a whole number (42.5) is still ranked exactly
    expect(defaultWeights(["c1", "c2", "c3"], [{ competencyId: "c1", weight: 60 }, { competencyId: "c2", weight: 25 }])).toEqual({ c1: 47, c2: 20, c3: 33 });
  });

  it("accepts whole percentages adding up to exactly 100 over the measured competencies", () => {
    expect(weightsProblem({ c1: 60, c2: 40 }, ["c1", "c2"])).toBeNull();
    expect(weightsProblem({ c1: 60, c2: 35 }, ["c1", "c2"])).toEqual({ total: 95 });
    expect(weightsProblem({ c1: 60.5, c2: 39.5 }, ["c1", "c2"])).toEqual({ total: 100 });
    expect(weightsProblem({ c1: 100, gone: 50 }, ["c1"])).toBeNull();
  });

  it("treats a measured competency with no weight as a problem, even when the rest adds up to 100", () => {
    expect(weightsProblem({ c1: 60, c2: 40 }, ["c1", "c2", "c3"])).toEqual({ total: 100 });
    expect(missingWeights({ c1: 60, c2: 40 }, ["c1", "c3", "c2", "c4"])).toEqual(["c3", "c4"]);
    expect(missingWeights({ c1: 0 }, ["c1"])).toEqual([]);
  });

  it("refuses a percentage outside 0-100 even when the total is 100", () => {
    expect(weightsProblem({ c1: 120, c2: -20 }, ["c1", "c2"])).toEqual({ total: 100 });
  });
});

describe("weightSetPercentages (a weight set after publishing)", () => {
  const scorecard = {
    competencies: [
      { id: "c1", weight: 75 },
      { id: "c2", weight: 25 },
    ],
  };

  it("weighting on: whole percentages adding up to 100, in the scorecard's order", () => {
    expect(weightSetPercentages(scorecard, { enabled: true, weights: { c2: 30, c1: 70 } })).toEqual({ ok: true, weights: { c1: 70, c2: 30 } });
  });

  it("holds exactly the published competencies: an extra or foreign id is never part of the set", () => {
    const result = weightSetPercentages(scorecard, { enabled: true, weights: { c1: 70, c2: 30, other: 0, foreign: 50 } });
    expect(result).toEqual({ ok: true, weights: { c1: 70, c2: 30 } });
  });

  it("refuses a total other than 100 with the total, and a missing competency", () => {
    expect(weightSetPercentages(scorecard, { enabled: true, weights: { c1: 70, c2: 25 } })).toEqual({ ok: false, total: 95 });
    expect(weightSetPercentages(scorecard, { enabled: true, weights: { c1: 100 } })).toEqual({ ok: false, total: 100 });
  });

  it("refuses values the database would refuse or round (hiring_weight_percentage, numeric(5,2))", () => {
    expect(weightSetPercentages(scorecard, { enabled: true, weights: { c1: 120, c2: -20 } })).toEqual({ ok: false, total: 100 });
    expect(weightSetPercentages(scorecard, { enabled: true, weights: { c1: 70.5, c2: 29.5 } })).toEqual({ ok: false, total: 100 });
  });

  it("a value that is not a finite number counts as missing, so the total stays a number", () => {
    const weights = { c1: "70", c2: Number.NaN } as unknown as Record<string, number>;
    expect(weightSetPercentages(scorecard, { enabled: true, weights })).toEqual({ ok: false, total: 0 });
  });

  it("an inherited key is not a weight", () => {
    const weights = Object.create({ c1: 70 }) as Record<string, number>;
    weights.c2 = 30;
    expect(weightSetPercentages(scorecard, { enabled: true, weights })).toEqual({ ok: false, total: 30 });
  });

  it("weighting off (plain average): the scorecard's percentages are kept, whatever came in", () => {
    expect(weightSetPercentages(scorecard, { enabled: false, weights: { c1: -5 } })).toEqual({ ok: true, weights: { c1: 75, c2: 25 } });
  });

  it("a scorecard without competencies: on is refused (total 0), off is an empty set", () => {
    expect(weightSetPercentages({ competencies: [] }, { enabled: true, weights: {} })).toEqual({ ok: false, total: 0 });
    expect(weightSetPercentages({ competencies: [] }, { enabled: false, weights: {} })).toEqual({ ok: true, weights: {} });
  });
});
