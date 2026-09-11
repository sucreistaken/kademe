import { describe, it, expect } from "vitest";
import {
  evenWeightSplit,
  averageScore,
  weightedScore,
  overallScore,
  selectWeights,
  knowledgeScore,
  weightsAreValid,
  formatScore,
} from "./scoring";

const s = (competencyId: string, score: number | null) => ({
  competencyId,
  score,
});

describe("plain average", () => {
  it("averages the scored competencies", () => {
    expect(averageScore([s("a", 5), s("b", 4), s("c", 3)])).toBe(4);
  });

  it("ignores unscored competencies instead of treating them as zero", () => {
    expect(averageScore([s("a", 4), s("b", null)])).toBe(4);
  });

  it("returns null when nothing has been scored", () => {
    expect(averageScore([s("a", null)])).toBe(null);
  });
});

describe("weighted average", () => {
  const weights = [
    { competencyId: "comm", percentage: 20 },
    { competencyId: "sales", percentage: 30 },
    { competencyId: "problem", percentage: 50 },
  ];

  it("applies the weights", () => {
    // 5*.2 + 3*.3 + 4*.5 = 1 + 0.9 + 2 = 3.9
    expect(
      weightedScore([s("comm", 5), s("sales", 3), s("problem", 4)], weights),
    ).toBe(3.9);
  });

  it("renormalises when a competency is unscored", () => {
    // Only comm and sales scored: (5*20 + 3*30) / 50 = 190/50 = 3.8
    expect(
      weightedScore([s("comm", 5), s("sales", 3), s("problem", null)], weights),
    ).toBe(3.8);
  });

  it("falls back to a plain average when no weight matches", () => {
    expect(weightedScore([s("other", 4)], weights)).toBe(4);
  });
});

describe("overall score", () => {
  it("uses a plain average when weighting is off, which is the default", () => {
    expect(overallScore([s("a", 5), s("b", 4)], null)).toBe(4.5);
  });
});

describe("weight set selection", () => {
  const setA = [{ competencyId: "comm", percentage: 70 }, { competencyId: "sales", percentage: 30 }];
  const setB = [{ competencyId: "comm", percentage: 30 }, { competencyId: "sales", percentage: 70 }];
  const bySet = new Map([
    ["A", setA],
    ["B", setB],
  ]);

  it("is a plain average while weighting is off, even for a pinned evaluation", () => {
    expect(selectWeights(null, "A", bySet)).toBe(null);
  });

  it("keeps a pinned evaluation on its own set after a new set becomes active", () => {
    // Set B was saved and switched on later. The old score stays on A until
    // the manager recalculates, which is what re-pins it.
    expect(selectWeights("B", "A", bySet)).toBe(setA);
  });

  it("lets an unpinned evaluation follow the active set", () => {
    expect(selectWeights("B", null, bySet)).toBe(setB);
  });

  it("falls back to the active set when the pinned set has no rows", () => {
    expect(selectWeights("B", "gone", bySet)).toBe(setB);
  });

  it("changes the overall only through the selected set", () => {
    const items = [s("comm", 5), s("sales", 3)];
    // A: 5*.7 + 3*.3 = 4.4. B: 5*.3 + 3*.7 = 3.6. Off: 4.
    expect(overallScore(items, selectWeights("B", "A", bySet))).toBe(4.4);
    expect(overallScore(items, selectWeights("B", null, bySet))).toBe(3.6);
    expect(overallScore(items, selectWeights(null, "A", bySet))).toBe(4);
  });
});

describe("knowledge score", () => {
  it("stays separate from the competency average", () => {
    // Three of four right is 75 percent, and it must not appear in the average.
    const items = [s("a", 3)];
    expect(averageScore(items)).toBe(3);
    expect(
      knowledgeScore([
        { correct: true },
        { correct: true },
        { correct: true },
        { correct: false },
      ]),
    ).toBe(75);
  });

  it("is null when there were no auto-scored questions", () => {
    expect(knowledgeScore([])).toBe(null);
  });
});

describe("weight validation", () => {
  it("requires the set to sum to 100", () => {
    expect(weightsAreValid([{ competencyId: "a", percentage: 100 }])).toBe(true);
    expect(weightsAreValid([{ competencyId: "a", percentage: 90 }])).toBe(false);
  });
});

describe("formatting", () => {
  it("uses a Turkish decimal comma", () => {
    expect(formatScore(3.5)).toBe("3,5");
  });

  it("says so plainly when nothing is scored", () => {
    expect(formatScore(null)).toBe("puanlanmadı");
  });
});

describe("even weight split", () => {
  it("always sums to exactly 100", () => {
    for (let n = 1; n <= 20; n++) {
      const split = evenWeightSplit(n);
      expect(split).toHaveLength(n);
      expect(split.reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  it("spreads the remainder instead of rounding it away", () => {
    // 100/6 is 16.67, and six of those is 100.02, which would open the screen
    // in an unsaveable state.
    expect(evenWeightSplit(6)).toEqual([17, 17, 17, 17, 16, 16]);
    expect(evenWeightSplit(3)).toEqual([34, 33, 33]);
  });

  it("keeps every value a whole percent", () => {
    for (const value of evenWeightSplit(7)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("produces a valid weight set", () => {
    const split = evenWeightSplit(6);
    expect(
      weightsAreValid(
        split.map((percentage, i) => ({ competencyId: String(i), percentage })),
      ),
    ).toBe(true);
  });

  it("returns nothing for no competencies", () => {
    expect(evenWeightSplit(0)).toEqual([]);
  });
});
