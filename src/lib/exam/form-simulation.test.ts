import { describe, expect, it } from "vitest";
import { section, type BlueprintConfig } from "./blueprint";
import { gateFailures, simulateFixedForm, textGuess, type FormAccuracy } from "./form-simulation";
import { examTemplateByKey } from "./templates";
import { CEFR_LEVELS } from "./types";

const opts = { runs: 300, seed: 11, cTestGaps: 20, cTestWeight: 5, textEffectSd: 0.5 };
const NONE = { kind: "ABSOLUTE" as const, perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } };
const grammarOnly = (grammar: BlueprintConfig["sections"][number]): BlueprintConfig => ({
  ...examTemplateByKey("quick-screen")!.config,
  sections: [grammar],
});

describe("simulateFixedForm", () => {
  it("returns a share per level between 0 and 1, within-one never below exact", () => {
    const acc = simulateFixedForm(grammarOnly(section("GRAMMAR", 30, { distribution: NONE, cTestLevels: [...CEFR_LEVELS] })), "PLACEMENT", opts);
    for (const l of CEFR_LEVELS) {
      expect(acc[l].exact).toBeGreaterThanOrEqual(0);
      expect(acc[l].withinOne).toBeLessThanOrEqual(1);
      expect(acc[l].withinOne).toBeGreaterThanOrEqual(acc[l].exact);
    }
  });

  it("is deterministic for a seed", () => {
    const cfg = grammarOnly(section("GRAMMAR", 30, { distribution: NONE, cTestLevels: ["A2", "B1", "B2"] }));
    expect(simulateFixedForm(cfg, "PLACEMENT", opts)).toEqual(simulateFixedForm(cfg, "PLACEMENT", opts));
  });

  it("six weighted C-tests place better than one unweighted C-test alone", () => {
    const six = simulateFixedForm(grammarOnly(section("GRAMMAR", 30, { distribution: NONE, cTestLevels: [...CEFR_LEVELS] })), "PLACEMENT", opts);
    const one = simulateFixedForm(grammarOnly(section("GRAMMAR", 5, { distribution: NONE, cTestLevels: ["B1"] })), "PLACEMENT", { ...opts, cTestWeight: 1 });
    const mean = (a: typeof six) => CEFR_LEVELS.reduce((s, l) => s + a[l].exact, 0) / CEFR_LEVELS.length;
    expect(mean(six)).toBeGreaterThan(mean(one));
  });
});

describe("simulateFixedForm with guessing (spec 2026-10-18)", () => {
  const small = { ...opts, runs: 200 };
  const sixCTests = grammarOnly(section("GRAMMAR", 30, { distribution: NONE, cTestLevels: [...CEFR_LEVELS] }));

  it("a legacy C-test form gives the very numbers the simulation gave before the change", () => {
    // Recorded with the pre-change form-simulation.ts (commit 55ce992), same options.
    const before = {
      A1: { exact: 0.765, withinOne: 1 },
      A2: { exact: 0.77, withinOne: 1 },
      B1: { exact: 0.795, withinOne: 1 },
      B2: { exact: 0.815, withinOne: 1 },
      C1: { exact: 0.7, withinOne: 1 },
      C2: { exact: 0.65, withinOne: 1 },
    };
    const now = simulateFixedForm(sixCTests, "PLACEMENT", small);
    for (const l of CEFR_LEVELS) expect({ exact: now[l].exact, withinOne: now[l].withinOne }, l).toEqual(before[l]);
    expect(simulateFixedForm(sixCTests, "PLACEMENT", { ...small, itemGuess: 0 })).toEqual(now);
  });

  it("textGuess: a quarter for a cloze, one over the pool for a word bank, 0 for a C-test", () => {
    expect(textGuess("CLOZE", 12)).toBe(0.25);
    expect(textGuess("WORDBANK", 8)).toBe(1 / 12);
    expect(textGuess("WORDBANK", 8, 5)).toBe(1 / 13);
    expect(textGuess("CTEST", 20)).toBe(0);
  });

  it("reports over-placement, and guessing on an MC form over-places more A1 students than none", () => {
    const mc = grammarOnly(section("GRAMMAR", 17, { distribution: { kind: "ABSOLUTE", perLevel: { A1: 3, A2: 3, B1: 3, B2: 3, C1: 3, C2: 3 } } }));
    const honest = simulateFixedForm(mc, "PLACEMENT", small);
    const guessing = simulateFixedForm(mc, "PLACEMENT", { ...small, itemGuess: 0.25 });
    for (const l of CEFR_LEVELS) {
      expect(honest[l].over).toBeGreaterThanOrEqual(0);
      expect(honest[l].over).toBeLessThanOrEqual(1 - honest[l].exact);
    }
    expect(honest.C2.over).toBe(0);
    expect(guessing.A1.over).toBeGreaterThan(honest.A1.over);
  });

  it("runs a cloze and word-bank form, deterministic for a seed", () => {
    const texts = grammarOnly(
      section("GRAMMAR", 30, {
        distribution: NONE,
        texts: [...CEFR_LEVELS.map((level) => ({ level, kind: "CLOZE" as const })), ...(["A2", "B1", "B2"] as const).map((level) => ({ level, kind: "WORDBANK" as const }))],
      }),
    );
    const o = { ...small, cTestWeight: 3, textGaps: { CLOZE: 12, WORDBANK: 8 } };
    const a = simulateFixedForm(texts, "PLACEMENT", o);
    expect(simulateFixedForm(texts, "PLACEMENT", o)).toEqual(a);
    for (const l of CEFR_LEVELS) expect(a[l].withinOne).toBeGreaterThanOrEqual(a[l].exact);
  });
});

describe("text weight, the floor in the estimate and the gate (spec 2026-10-18)", () => {
  const small = { ...opts, runs: 200, cTestWeight: undefined };
  const cloze = (levels: readonly (typeof CEFR_LEVELS)[number][]) =>
    grammarOnly(section("GRAMMAR", 30, { distribution: NONE, texts: levels.map((level) => ({ level, kind: "CLOZE" as const })) }));

  it("weighs a text as the engine does: gaps over four where the section weighs texts, else 1", () => {
    const sixCTests = grammarOnly(section("GRAMMAR", 30, { distribution: NONE, cTestLevels: [...CEFR_LEVELS] }));
    expect(simulateFixedForm(sixCTests, "PLACEMENT", small)).toEqual(simulateFixedForm(sixCTests, "PLACEMENT", { ...small, cTestWeight: 5 }));
    const elevenGaps = { ...small, textGaps: { CLOZE: 11 } };
    expect(simulateFixedForm(cloze(CEFR_LEVELS), "PLACEMENT", elevenGaps)).toEqual(simulateFixedForm(cloze(CEFR_LEVELS), "PLACEMENT", { ...elevenGaps, cTestWeight: 2.75 }));
    // The opening C-test of an older form (cTest, no cTestLevels) weighs 1.
    const opening = grammarOnly(section("GRAMMAR", 17, { distribution: { kind: "ABSOLUTE", perLevel: { A1: 3, A2: 3, B1: 3, B2: 3, C1: 3, C2: 3 } }, cTest: true }));
    expect(simulateFixedForm(opening, "PLACEMENT", small)).toEqual(simulateFixedForm(opening, "PLACEMENT", { ...small, cTestWeight: 1 }));
    expect(simulateFixedForm(opening, "PLACEMENT", small)).not.toEqual(simulateFixedForm(opening, "PLACEMENT", { ...small, cTestWeight: 5 }));
  });

  it("an estimate without the cloze floor places guessing A1 students higher", () => {
    const o = { ...small, textGaps: { CLOZE: 11 } };
    const form = cloze(["A2", "B1", "B2"]);
    const floor = simulateFixedForm(form, "PLACEMENT", o);
    const raw = simulateFixedForm(form, "PLACEMENT", { ...o, estimateGuess: false });
    expect(raw.A1.over).toBeGreaterThan(floor.A1.over + 0.2);
    // A C-test has no floor: the option changes nothing.
    const cTests = grammarOnly(section("GRAMMAR", 15, { distribution: NONE, cTestLevels: ["A2", "B1", "B2"] }));
    expect(simulateFixedForm(cTests, "PLACEMENT", { ...small, estimateGuess: false })).toEqual(simulateFixedForm(cTests, "PLACEMENT", small));
  });

  it("gateFailures: exact 2 points, within one 1 point below the MC form at A1-C1; A1 over 5 points above the C-tests", () => {
    const flat = (exact: number, withinOne: number, over: number): FormAccuracy =>
      Object.fromEntries(CEFR_LEVELS.map((l) => [l, { exact, withinOne, over }])) as FormAccuracy;
    const mc = flat(0.6, 0.99, 0.3);
    const cTest = flat(0.6, 0.99, 0.3);
    expect(gateFailures(mc, cTest, flat(0.58, 0.98, 0.35))).toEqual([]);
    expect(gateFailures(mc, cTest, flat(0.57, 0.98, 0.35))).toEqual(["A1", "A2", "B1", "B2", "C1"].map((l) => `${l} exact 57.00 < 58.00`));
    expect(gateFailures(mc, cTest, flat(0.6, 0.97, 0.3))).toHaveLength(5);
    expect(gateFailures(mc, cTest, flat(0.6, 0.99, 0.36))).toEqual(["A1 over 36.00 > 35.00"]);
    // C2 is not gated.
    expect(gateFailures(mc, cTest, { ...flat(0.6, 0.99, 0.3), C2: { exact: 0, withinOne: 0.5, over: 0 } })).toEqual([]);
  });
});
