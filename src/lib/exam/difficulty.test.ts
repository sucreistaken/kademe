import { describe, expect, it } from "vitest";
import { BAND_CENTER, thetaForLevel } from "./cefr";
import { difficultyFor, parseWithin, WITHINS, withinOf, withinRange } from "./difficulty";
import { CEFR_LEVELS } from "./types";

/** What a 4-byte real column hands back for a number. */
const asReal = (n: number) => Math.fround(n);

describe("Kolay / Orta / Zor inside a level", () => {
  it("is the engine's own thetaForLevel", () => {
    for (const level of CEFR_LEVELS) for (const w of WITHINS) expect(difficultyFor(level, w)).toBe(thetaForLevel(level, w));
  });

  it("reads back the word an item was written with, also through the real column", () => {
    for (const level of CEFR_LEVELS) {
      for (const w of WITHINS) {
        expect(withinOf(level, difficultyFor(level, w))).toBe(w);
        expect(withinOf(level, asReal(difficultyFor(level, w)))).toBe(w);
      }
    }
  });

  it("takes the nearest point, halfway counting as Orta, and far values as the end word", () => {
    const c = BAND_CENTER.A2;
    expect(withinOf("A2", c - 0.14)).toBe("MID");
    expect(withinOf("A2", c - 0.15)).toBe("MID");
    expect(withinOf("A2", c - 0.16)).toBe("EASY");
    expect(withinOf("A2", c + 0.15)).toBe("MID");
    expect(withinOf("A2", c + 0.16)).toBe("HARD");
    expect(withinOf("A2", c - 2)).toBe("EASY");
    expect(withinOf("A2", c + 2)).toBe("HARD");
  });

  it("is relative to the level: the same number is Zor in A2 and Kolay in B1", () => {
    expect(withinOf("A2", -1.2)).toBe("HARD");
    expect(withinOf("B1", -0.8)).toBe("EASY");
    expect(withinOf("B1", -1.2)).toBe("EASY");
  });

  it("gives SQL edges that agree with withinOf", () => {
    for (const level of CEFR_LEVELS) {
      for (const probe of [-0.4, -0.3, -0.16, -0.15, 0, 0.15, 0.16, 0.3, 0.4].map((o) => asReal(BAND_CENTER[level] + o))) {
        const w = withinOf(level, probe);
        const r = withinRange(level, w);
        if (w === "EASY") expect(probe < (r.max as number)).toBe(true);
        if (w === "HARD") expect(probe > (r.min as number)).toBe(true);
        if (w === "MID") expect(probe >= (r.min as number) && probe <= (r.max as number)).toBe(true);
      }
    }
  });

  it("reads the words of a spreadsheet cell in Turkish, English and German", () => {
    expect(parseWithin("Kolay")).toBe("EASY");
    expect(parseWithin(" ORTA ")).toBe("MID");
    expect(parseWithin("zor")).toBe("HARD");
    expect(parseWithin("Hard")).toBe("HARD");
    expect(parseWithin("MID")).toBe("MID");
    expect(parseWithin("schwer")).toBe("HARD");
    expect(parseWithin("")).toBeNull();
    expect(parseWithin("sehr schwer")).toBeNull();
  });
});
