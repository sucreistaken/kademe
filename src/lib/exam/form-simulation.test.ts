import { describe, expect, it } from "vitest";
import { section, type BlueprintConfig } from "./blueprint";
import { simulateFixedForm } from "./form-simulation";
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
