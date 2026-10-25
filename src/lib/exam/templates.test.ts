import { describe, expect, it } from "vitest";
import { SEED_BANK } from "@/db/seed-bank";
import { bankCoverage, blueprintConfigSchema, enabledSections, estimatedMinutes, section, type BankCount, type SectionConfig } from "./blueprint";
import { gateFailures, simulateFixedForm, type SimulationOptions } from "./form-simulation";
import { isNavigableConfig } from "./navigation";
import { EXAM_TEMPLATES, examTemplateByKey } from "./templates";
import { C_TEST_SKILL_TAG, CEFR_LEVELS, CLOZE_SKILL_TAG, isObjectiveSection, OPEN_CLOZE_SKILL_TAG, SECTIONS, WORD_BANK_SKILL_TAG } from "./types";

/** The seed bank as `bankCounts` would see it once imported (listening audio made). */
function seedCounts(): BankCount[] {
  return SECTIONS.flatMap((section) =>
    CEFR_LEVELS.map((level) => {
      const items = SEED_BANK.items.filter((i) => i.section === section && i.level === level);
      return {
        section,
        level,
        items: items.length,
        stimuli: new Set(items.map((i) => i.stimulusKey).filter(Boolean)).size,
        cTests: items.filter((i) => i.skillTag === C_TEST_SKILL_TAG).length,
        clozeTexts: items.filter((i) => i.skillTag === CLOZE_SKILL_TAG).length,
        wordBanks: items.filter((i) => i.skillTag === WORD_BANK_SKILL_TAG).length,
        openTexts: items.filter((i) => i.skillTag === OPEN_CLOZE_SKILL_TAG).length,
      };
    }),
  );
}

const byKey = (key: string) => {
  const t = examTemplateByKey(key);
  if (!t) throw new Error(`no template ${key}`);
  return t;
};

const sectionOf = (key: string, section: string) => byKey(key).config.sections.find((s) => s.section === section);

describe("exam templates", () => {
  it("offers the three research blueprints, quick screen first", () => {
    expect(EXAM_TEMPLATES.map((t) => t.key)).toEqual(["quick-screen", "placement", "level-check"]);
    expect(EXAM_TEMPLATES.map((t) => t.mode)).toEqual(["PLACEMENT", "PLACEMENT", "LEVEL_VERIFICATION"]);
  });

  it.each(EXAM_TEMPLATES.map((t) => [t.key, t] as const))("%s validates with the blueprint schema", (_key, t) => {
    expect(blueprintConfigSchema.safeParse(t.config).success).toBe(true);
  });

  it.each(EXAM_TEMPLATES.map((t) => [t.key, t] as const))("%s has a name and summary in both languages", (_key, t) => {
    for (const text of [t.name, t.summary]) {
      expect(text.tr.trim()).not.toBe("");
      expect(text.en.trim()).not.toBe("");
    }
  });

  it.each(EXAM_TEMPLATES.map((t) => [t.key, t] as const))("%s is covered by the current seed bank", (_key, t) => {
    const coverage = bankCoverage(seedCounts(), t.config, t.mode, null);
    expect(coverage.rows.filter((r) => !r.ok)).toEqual([]);
    expect(coverage.ok).toBe(true);
  });

  it.each(EXAM_TEMPLATES.map((t) => [t.key, t] as const))("%s is a fixed form: every enabled section but speaking is navigable", (_key, t) => {
    for (const s of enabledSections(t.config)) {
      if (isObjectiveSection(s.section)) expect(s.adaptive, s.section).toBe(false);
      expect(isNavigableConfig(s), s.section).toBe(s.section !== "SPEAKING");
    }
  });

  it("quick screen: cloze texts A1 to B2 and word banks A1 to B1, 25 minutes, released at once", () => {
    const t = byKey("quick-screen");
    expect(enabledSections(t.config).map((s) => s.section)).toEqual(["GRAMMAR"]);
    const grammar = sectionOf("quick-screen", "GRAMMAR")!;
    expect(grammar.cTestLevels).toBeUndefined();
    expect(grammar).toMatchObject({
      adaptive: false,
      durationMinutes: 25,
      distribution: { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } },
      texts: [
        { level: "A1", kind: "CLOZE" },
        { level: "A2", kind: "CLOZE" },
        { level: "B1", kind: "CLOZE" },
        { level: "B2", kind: "CLOZE" },
        { level: "A1", kind: "WORDBANK" },
        { level: "A2", kind: "WORDBANK" },
        { level: "B1", kind: "WORDBANK" },
      ],
      // The adaptive settings stay for a school that switches the section back.
      minItems: 15,
      maxItems: 30,
      targetSe: 0.5,
    });
    expect(estimatedMinutes(t.config)).toBe(25);
    expect(t.summary.tr).toContain("25 dakika");
    expect(t.summary.en).toContain("25 minutes");
    expect(t.config.resultVisibility).toBe("OVERALL");
    expect(t.config.autoRelease).toBe(true);
    expect(t.config.proctoring.preset).toBe("STANDARD");
  });

  it("placement: five sections, about 77 minutes, grammar is cloze texts A1-B2, three word banks and open cloze C1, C2", () => {
    const t = byKey("placement");
    expect(estimatedMinutes(t.config)).toBe(77);
    expect(sectionOf("placement", "GRAMMAR")!.cTestLevels).toBeUndefined();
    expect(sectionOf("placement", "GRAMMAR")).toMatchObject({
      adaptive: false,
      durationMinutes: 30,
      distribution: { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } },
      texts: [
        ...(["A1", "A2", "B1", "B2"] as const).map((level) => ({ level, kind: "CLOZE" })),
        { level: "A2", kind: "WORDBANK" },
        { level: "B1", kind: "WORDBANK" },
        { level: "B2", kind: "WORDBANK" },
        { level: "C1", kind: "OPEN" },
        { level: "C2", kind: "OPEN" },
      ],
      minItems: 10,
      maxItems: 16,
      targetSe: 0.45,
    });
    expect(t.summary.tr).toContain("77 dakika");
    expect(t.summary.en).toContain("77 minutes");
    expect(t.summary.tr).toContain("açık boşluklu");
    expect(t.summary.en).toContain("open cloze texts at C1 and C2");
    expect(sectionOf("placement", "READING")).toMatchObject({
      adaptive: false,
      durationMinutes: 18,
      distribution: { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 4, B1: 4, B2: 4, C1: 4, C2: 0 } },
      minItems: 5,
      maxItems: 8,
      targetSe: 0.55,
    });
    expect(sectionOf("placement", "LISTENING")).toMatchObject({
      adaptive: false,
      durationMinutes: 13,
      distribution: { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 4, B1: 4, B2: 4, C1: 0, C2: 0 } },
      minItems: 5,
      maxItems: 8,
      targetSe: 0.55,
    });
    expect(sectionOf("placement", "WRITING")).toMatchObject({ durationMinutes: 10, tasks: 1 });
    expect(sectionOf("placement", "SPEAKING")).toMatchObject({ durationMinutes: 6, tasks: 2 });
    expect(t.config.resultVisibility).toBe("OVERALL");
    expect(t.config.autoRelease).toBe(false);
  });

  it("level check: fixed Goethe/telc shape, about 97 minutes, speaking required", () => {
    const t = byKey("level-check");
    expect(estimatedMinutes(t.config)).toBe(97);
    expect(sectionOf("level-check", "READING")).toMatchObject({ adaptive: false, durationMinutes: 25, distribution: { kind: "RELATIVE", below: 2, at: 6, above: 2 } });
    expect(sectionOf("level-check", "LISTENING")).toMatchObject({ adaptive: false, durationMinutes: 20, distribution: { kind: "RELATIVE", below: 2, at: 5, above: 2 } });
    expect(sectionOf("level-check", "GRAMMAR")).toMatchObject({ adaptive: false, durationMinutes: 15, distribution: { kind: "RELATIVE", below: 3, at: 6, above: 3 }, cTest: false });
    expect(sectionOf("level-check", "WRITING")).toMatchObject({ durationMinutes: 25, tasks: 2 });
    expect(sectionOf("level-check", "SPEAKING")).toMatchObject({ durationMinutes: 12, tasks: 2 });
    expect(t.config.passRules).toEqual({ overallAtLeastClaimed: true, minSkillOffset: -1, requiredSkills: ["SPEAKING"], minHoldProbability: 0.5 });
    expect(t.config.resultVisibility).toBe("FULL");
    expect(t.config.autoRelease).toBe(false);
  });

  it("placement's coverage asks for cloze texts A1 to B2, word banks A2 to B2 and open cloze C1, C2, no C-test, and the seed bank has them", () => {
    const t = byKey("placement");
    const rows = bankCoverage(seedCounts(), t.config, t.mode, null).rows.filter((r) => r.text);
    expect(rows.map((r) => `${r.text} ${r.level}`)).toEqual([
      ...(["A1", "A2", "B1", "B2"] as const).map((l) => `CLOZE ${l}`),
      "WORDBANK A2",
      "WORDBANK B1",
      "WORDBANK B2",
      "OPEN C1",
      "OPEN C2",
    ]);
    expect(rows.every((r) => r.ok)).toBe(true);
  });

  it("the seed bank's texts do not count as ordinary grammar items", () => {
    // The 2026-10-25 bank: 3 MC cloze texts, plus a letter-style one at A2, B1 and B2; 3 word banks, 7 at B1 and
    // B2 (3 classic + 4 Sprachbausteine, one of them "advert and reply"); 3 open cloze texts from B2
    // (bank-seed.test.ts checks their shape).
    const want = { A1: [3, 3, 0], A2: [4, 3, 0], B1: [4, 7, 0], B2: [4, 7, 3], C1: [3, 3, 3], C2: [3, 3, 3] };
    const grammar = seedCounts().filter((c) => c.section === "GRAMMAR");
    for (const c of grammar) {
      expect([c.clozeTexts, c.wordBanks, c.openTexts], c.level).toEqual(want[c.level]);
    }
    // Read without its text counts, the bank seems to hold no texts and the template is not covered.
    const t = byKey("quick-screen");
    const blind = seedCounts().map((c) => ({ ...c, clozeTexts: 0, wordBanks: 0, openTexts: 0 }));
    expect(bankCoverage(blind, t.config, t.mode, null).ok).toBe(false);
  });

  it("returns null for an unknown key", () => {
    expect(examTemplateByKey("nope")).toBeNull();
    expect(examTemplateByKey("")).toBeNull();
  });

  it("hands out a copy, so a caller cannot change the template", () => {
    const a = byKey("placement");
    a.config.sections[0].durationMinutes = 99;
    expect(byKey("placement").config.sections[0].durationMinutes).toBe(30);
  });

  it("placement's fixed form places simulated students within one level (pooled objective skills)", () => {
    const acc = simulateFixedForm(byKey("placement").config, "PLACEMENT", { runs: 300, seed: 2026, cTestGaps: 20, textGaps: { CLOZE: 11, WORDBANK: 8, OPEN: 10 }, textEffectSd: 0.5 });
    for (const level of CEFR_LEVELS) {
      expect(acc[level].withinOne, `${level} within one`).toBeGreaterThanOrEqual(0.95);
      // C2 sits above the top text of the reading form; it is exact less often.
      expect(acc[level].exact, `${level} exact`).toBeGreaterThanOrEqual(level === "C2" ? 0.25 : 0.5);
    }
  });

  // A smaller version of scripts/simulate-placement.ts (spec 2026-10-18, section 4).
  describe.each(["placement", "quick-screen"] as const)("%s passes the guessing gate", (key) => {
    const opts: SimulationOptions = { runs: 1000, seed: 2026, cTestGaps: 20, textEffectSd: 0.5, itemGuess: 0.25, textGaps: { CLOZE: 11, WORDBANK: 8, OPEN: 10 }, wordBankDistractors: 4 };
    const withGrammar = (grammar: SectionConfig) => ({ ...byKey(key).config, sections: byKey(key).config.sections.map((s) => (s.section === "GRAMMAR" ? grammar : s)) });
    const none = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
    const mc =
      key === "placement"
        ? section("GRAMMAR", 17, { distribution: { kind: "ABSOLUTE", perLevel: { A1: 3, A2: 3, B1: 3, B2: 3, C1: 3, C2: 3 } }, cTest: true })
        : section("GRAMMAR", 15, { distribution: { kind: "ABSOLUTE", perLevel: { A1: 4, A2: 4, B1: 4, B2: 4, C1: 4, C2: 4 } }, cTest: false });
    const cTests = section("GRAMMAR", key === "placement" ? 30 : 15, {
      distribution: { kind: "ABSOLUTE", perLevel: none },
      cTestLevels: key === "placement" ? [...CEFR_LEVELS] : ["A2", "B1", "B2"],
    });

    it("against the multiple-choice form before onSET and today's C-tests", () => {
      const a = simulateFixedForm(withGrammar(mc), "PLACEMENT", opts);
      const b = simulateFixedForm(withGrammar(cTests), "PLACEMENT", opts);
      const c = simulateFixedForm(byKey(key).config, "PLACEMENT", opts);
      expect(gateFailures(a, b, c)).toEqual([]);
      // 3000 simulated students take about 1.6 s alone but up to 9.4 s in the full parallel suite, past
      // vitest's 5 s default; the assertions pass either way (checked 2026-10-23 with --testTimeout=60000).
    }, 30_000);
  });
});
