import { describe, expect, it } from "vitest";
import { initialState, mulberry32, replay, type ReplayResponse } from "./adaptive";
import {
  adaptiveConfigFor,
  adaptivePlacementBlueprint,
  bankCoverage,
  blueprintConfigSchema,
  cTestLevelsOf,
  defaultBlueprint,
  isTextOnly,
  nextAdaptiveItems,
  planFixedSection,
  section,
  estimatedMinutes,
  productiveTaskLevels,
  resolveDistribution,
  sampleFixedForm,
  textKindsOf,
  textPlanOf,
  weighsTexts,
  type BankCount,
  type BankItem,
  type SectionConfig,
} from "./blueprint";
import { thetaForLevel } from "./cefr";
import { isNavigableConfig } from "./navigation";
import { C_TEST_SKILL_TAG, CEFR_LEVELS, CLOZE_SKILL_TAG, SECTIONS, WORD_BANK_SKILL_TAG, type Cefr } from "./types";

describe("default blueprints", () => {
  it("the default placement blueprint is a fixed form (back, flag, review)", () => {
    const cfg = defaultBlueprint("PLACEMENT");
    for (const s of cfg.sections.filter((x) => ["GRAMMAR", "READING", "LISTENING"].includes(x.section))) {
      expect(s.adaptive, s.section).toBe(false);
      expect(s.distribution.kind, s.section).toBe("ABSOLUTE");
      expect(isNavigableConfig(s), s.section).toBe(true);
    }
  });

  it("the adaptive placement blueprint keeps the three objective sections adaptive", () => {
    const cfg = adaptivePlacementBlueprint();
    expect(blueprintConfigSchema.safeParse(cfg).success).toBe(true);
    expect(cfg.sections.filter((s) => s.adaptive).map((s) => s.section)).toEqual(["GRAMMAR", "READING", "LISTENING"]);
  });

  it("both modes validate", () => {
    expect(blueprintConfigSchema.safeParse(defaultBlueprint("PLACEMENT")).success).toBe(true);
    expect(blueprintConfigSchema.safeParse(defaultBlueprint("LEVEL_VERIFICATION")).success).toBe(true);
  });

  it("adds up the minutes of enabled sections", () => {
    const cfg = defaultBlueprint("PLACEMENT");
    cfg.sections[4].enabled = false;
    expect(estimatedMinutes(cfg)).toBe(17 + 18 + 13 + 10);
  });

  it("rejects a repeated section and an empty exam", () => {
    const cfg = defaultBlueprint("PLACEMENT");
    expect(blueprintConfigSchema.safeParse({ ...cfg, sections: [cfg.sections[0], cfg.sections[0]] }).success).toBe(false);
    expect(
      blueprintConfigSchema.safeParse({ ...cfg, sections: cfg.sections.map((s) => ({ ...s, enabled: false })) }).success,
    ).toBe(false);
  });
});

describe("distribution", () => {
  const s = defaultBlueprint("LEVEL_VERIFICATION").sections[0];

  it("centres a relative form on the claim", () => {
    const d = resolveDistribution(s, "LEVEL_VERIFICATION", "B2", 0);
    expect(d).toEqual({ A1: 0, A2: 0, B1: 3, B2: 6, C1: 3, C2: 0 });
  });

  it("folds off-scale counts back onto the end level", () => {
    const d = resolveDistribution(s, "LEVEL_VERIFICATION", "A1", 0);
    expect(d.A1).toBe(9);
    expect(d.A2).toBe(3);
  });

  it("shifts with the difficulty offset", () => {
    const d = resolveDistribution(s, "LEVEL_VERIFICATION", "B1", 1);
    expect(d).toEqual({ A1: 0, A2: 0, B1: 3, B2: 6, C1: 3, C2: 0 });
  });
});

describe("fixed forms", () => {
  const pool: BankItem[] = [];
  for (const level of CEFR_LEVELS) {
    for (let i = 0; i < 8; i++)
      pool.push({ id: `${level}-${i}`, level, b: thetaForLevel(level), skillTag: "g", stimulusId: null, orderInStimulus: 0 });
    for (let t = 0; t < 3; t++)
      for (let i = 0; i < 3; i++)
        pool.push({ id: `${level}-t${t}-${i}`, level, b: thetaForLevel(level), skillTag: "r", stimulusId: `${level}-t${t}`, orderInStimulus: i });
  }

  it("draws the asked counts, easiest first, without repeats", () => {
    const singles = pool.filter((p) => !p.stimulusId);
    const ids = sampleFixedForm(singles, { A1: 0, A2: 2, B1: 4, B2: 2, C1: 0, C2: 0 }, mulberry32(3));
    expect(ids.length).toBe(8);
    expect(new Set(ids).size).toBe(8);
    const levels = ids.map((id) => id.split("-")[0]);
    expect(levels).toEqual([...levels].sort((a, b) => CEFR_LEVELS.indexOf(a as never) - CEFR_LEVELS.indexOf(b as never)));
  });

  it("keeps whole texts together and in order", () => {
    const texts = pool.filter((p) => p.stimulusId);
    const ids = sampleFixedForm(texts, { A1: 0, A2: 0, B1: 4, B2: 0, C1: 0, C2: 0 }, mulberry32(5));
    expect(ids.length).toBe(6);
    for (let i = 0; i < ids.length; i += 3) {
      expect(ids.slice(i, i + 3).map((id) => id.split("-")[2])).toEqual(["0", "1", "2"]);
    }
  });
});

describe("bank coverage", () => {
  const full: BankCount[] = SECTIONS.flatMap((section) =>
    CEFR_LEVELS.map((level) => ({ section, level, items: 12, stimuli: 3 })),
  );

  it("passes on a full bank for both modes", () => {
    expect(bankCoverage(full, defaultBlueprint("PLACEMENT"), "PLACEMENT", null).ok).toBe(true);
    expect(bankCoverage(full, defaultBlueprint("LEVEL_VERIFICATION"), "LEVEL_VERIFICATION", "B1").ok).toBe(true);
  });

  it("names the missing cell", () => {
    const thin = full.map((c) => (c.section === "LISTENING" && c.level === "B2" ? { ...c, items: 3, stimuli: 1 } : c));
    const res = bankCoverage(thin, defaultBlueprint("PLACEMENT"), "PLACEMENT", null);
    expect(res.ok).toBe(false);
    expect(res.rows.filter((r) => !r.ok).map((r) => `${r.section}:${r.level}`)).toEqual(["LISTENING:B2"]);
  });

  it("checks only the claim's neighbourhood for one verification student", () => {
    const noC2 = full.map((c) => (c.level === "C2" ? { ...c, items: 0, stimuli: 0 } : c));
    expect(bankCoverage(noC2, defaultBlueprint("LEVEL_VERIFICATION"), "LEVEL_VERIFICATION", "A2").ok).toBe(true);
    expect(bankCoverage(noC2, defaultBlueprint("LEVEL_VERIFICATION"), "LEVEL_VERIFICATION", "C1").ok).toBe(false);
  });
});

describe("C-test opening", () => {
  /** Ten ordinary grammar items and one C-test per level. */
  const pool: BankItem[] = CEFR_LEVELS.flatMap((level) => [
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `${level}-${i}`,
      level,
      b: thetaForLevel(level),
      skillTag: `grammar.t${i % 4}`,
      stimulusId: null,
      orderInStimulus: 0,
    })),
    { id: `ctest-${level}`, level, b: thetaForLevel(level), skillTag: C_TEST_SKILL_TAG, stimulusId: null, orderInStimulus: 0 },
  ]);
  const isC = (id: string) => id.startsWith("ctest");
  const adaptive = (cTest?: boolean) =>
    section("GRAMMAR", 17, { adaptive: true, minItems: 10, maxItems: 16, targetSe: 0.45, ...(cTest === undefined ? {} : { cTest }) });
  const fixed = (cTest?: boolean) =>
    section("GRAMMAR", 15, { distribution: { kind: "RELATIVE", below: 3, at: 6, above: 3 }, ...(cTest === undefined ? {} : { cTest }) });

  /** Runs an adaptive section to its end and returns the served ids in order. */
  function runAdaptive(s: ReturnType<typeof adaptive>, mode: "PLACEMENT" | "LEVEL_VERIFICATION", claimed: Cefr | null, seed: number) {
    const cfg = adaptiveConfigFor(s, mode, claimed);
    const rng = mulberry32(seed);
    const responses: ReplayResponse[] = [];
    for (;;) {
      const state = replay(cfg, responses);
      if (state.answered >= cfg.maxItems) break;
      const next = nextAdaptiveItems(s, mode, claimed, state, pool, cfg, rng);
      if (!next) break;
      for (const id of next.itemIds) {
        const item = pool.find((p) => p.id === id)!;
        responses.push({ itemId: id, b: item.b, skillTag: item.skillTag, stimulusId: null, score: isC(id) ? 0.6 : rng() < 0.5 ? 1 : 0 });
      }
    }
    return responses.map((r) => r.itemId);
  }

  it("is optional in the schema and stored configs without it stay valid", () => {
    const cfg = defaultBlueprint("PLACEMENT");
    expect(cfg.sections[0].cTest).toBeUndefined();
    expect(blueprintConfigSchema.safeParse(cfg).success).toBe(true);
    const on = { ...cfg, sections: cfg.sections.map((s) => (s.section === "GRAMMAR" ? { ...s, cTest: true } : s)) };
    expect(blueprintConfigSchema.parse(on).sections[0].cTest).toBe(true);
  });

  it("adaptive: never serves a C-test when the flag is off or missing", () => {
    for (const flag of [undefined, false]) {
      for (let seed = 1; seed <= 30; seed++) {
        expect(runAdaptive(adaptive(flag), "PLACEMENT", null, seed).filter(isC)).toEqual([]);
      }
    }
  });

  it("fixed form: never draws a C-test when the flag is off or missing", () => {
    for (const flag of [undefined, false]) {
      for (let seed = 1; seed <= 30; seed++) {
        const ids = planFixedSection(fixed(flag), pool, "LEVEL_VERIFICATION", "B1", 0, mulberry32(seed));
        expect(ids.filter(isC)).toEqual([]);
        expect(ids.length).toBe(12);
      }
    }
    // sampleFixedForm on its own skips them too.
    const onlyB1 = sampleFixedForm(pool, { A1: 0, A2: 0, B1: 11, B2: 0, C1: 0, C2: 0 }, mulberry32(1));
    expect(onlyB1.filter(isC)).toEqual([]);
    expect(onlyB1.length).toBe(10);
  });

  it("adaptive placement with the flag: the B1 C-test first, then no other C-test", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const ids = runAdaptive(adaptive(true), "PLACEMENT", null, seed);
      expect(ids[0]).toBe("ctest-B1");
      expect(ids.slice(1).filter(isC)).toEqual([]);
    }
  });

  it("adaptive verification with the flag: the claimed level's C-test first", () => {
    const ids = runAdaptive(adaptive(true), "LEVEL_VERIFICATION", "C1", 3);
    expect(ids[0]).toBe("ctest-C1");
    expect(ids.slice(1).filter(isC)).toEqual([]);
  });

  it("the C-test's partial credit is the first observation", () => {
    const s = adaptive(true);
    const cfg = adaptiveConfigFor(s, "PLACEMENT", null);
    const first = nextAdaptiveItems(s, "PLACEMENT", null, initialState(cfg), pool, cfg, mulberry32(1))!;
    expect(first.itemIds).toEqual(["ctest-B1"]);
    const after = replay(cfg, [{ itemId: "ctest-B1", b: thetaForLevel("B1"), skillTag: C_TEST_SKILL_TAG, stimulusId: null, score: 0.6 }]);
    expect(after.answered).toBe(1);
    expect(after.posterior.mean).toBeGreaterThan(cfg.priorMean);
  });

  it("fixed form with the flag: the anchor C-test first, the form unchanged after it", () => {
    const ids = planFixedSection(fixed(true), pool, "LEVEL_VERIFICATION", "B2", 0, mulberry32(4));
    expect(ids[0]).toBe("ctest-B2");
    expect(ids.slice(1).filter(isC)).toEqual([]);
    expect(ids.length).toBe(13);
  });

  it("falls back to the plain section when the bank has no C-test at the anchor", () => {
    const noB1 = pool.filter((p) => p.id !== "ctest-B1");
    const s = adaptive(true);
    const cfg = adaptiveConfigFor(s, "PLACEMENT", null);
    const first = nextAdaptiveItems(s, "PLACEMENT", null, initialState(cfg), noB1, cfg, mulberry32(1))!;
    expect(first.itemIds.filter(isC)).toEqual([]);
  });

  it("only GRAMMAR honours the flag", () => {
    const reading = section("READING", 12, { distribution: { kind: "RELATIVE", below: 0, at: 3, above: 0 }, cTest: true });
    const ids = planFixedSection(reading, pool, "PLACEMENT", null, 0, mulberry32(2));
    expect(ids.filter(isC)).toEqual([]);
  });

  const listed = (levels: Cefr[], over: Partial<SectionConfig> = {}) =>
    section("GRAMMAR", 30, { distribution: { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } }, cTestLevels: levels, ...over });

  it("cTestLevels: schema accepts a GRAMMAR list, rejects repeats and other sections", () => {
    const cfg = defaultBlueprint("PLACEMENT");
    const withLevels = (s: Partial<SectionConfig>, target = "GRAMMAR") =>
      ({ ...cfg, sections: cfg.sections.map((x) => (x.section === target ? { ...x, ...s } : x)) });
    expect(blueprintConfigSchema.safeParse(withLevels({ cTestLevels: ["A1", "B1"] })).success).toBe(true);
    expect(blueprintConfigSchema.safeParse(withLevels({ cTestLevels: ["B1", "B1"] })).success).toBe(false);
    expect(blueprintConfigSchema.safeParse(withLevels({ cTestLevels: [] })).success).toBe(false);
    expect(blueprintConfigSchema.safeParse(withLevels({ cTestLevels: ["B1"] }, "READING")).success).toBe(false);
  });

  it("cTestLevelsOf: the list in CEFR order; else the anchor when cTest is on; else none", () => {
    expect(cTestLevelsOf(listed(["C2", "A1", "B1"]), "PLACEMENT", null)).toEqual(["A1", "B1", "C2"]);
    expect(cTestLevelsOf(listed(["A2"], { cTest: true }), "LEVEL_VERIFICATION", "C1")).toEqual(["A2"]);
    expect(cTestLevelsOf(fixed(true), "LEVEL_VERIFICATION", "C1")).toEqual(["C1"]);
    expect(cTestLevelsOf(fixed(false), "PLACEMENT", null)).toEqual([]);
    const reading = section("READING", 12, { cTestLevels: ["B1"] });
    expect(cTestLevelsOf(reading, "PLACEMENT", null)).toEqual([]);
  });

  it("fixed form with cTestLevels: one C-test per level, easy to hard, then the form", () => {
    const all = ["A1", "A2", "B1", "B2", "C1", "C2"] as Cefr[];
    const ids = planFixedSection(listed(all), pool, "PLACEMENT", null, 0, mulberry32(7));
    expect(ids).toEqual(all.map((l) => `ctest-${l}`));
    const mixed = planFixedSection(listed(["B1", "A2"], { distribution: { kind: "RELATIVE", below: 3, at: 6, above: 3 } }), pool, "PLACEMENT", null, 0, mulberry32(7));
    expect(mixed.slice(0, 2)).toEqual(["ctest-A2", "ctest-B1"]);
    expect(mixed.slice(2).filter(isC)).toEqual([]);
    expect(mixed.length).toBe(14);
  });

  it("fixed form skips a level with no C-test in the bank", () => {
    const noB2 = pool.filter((p) => p.id !== "ctest-B2");
    expect(planFixedSection(listed(["B1", "B2", "C1"]), noB2, "PLACEMENT", null, 0, mulberry32(3))).toEqual(["ctest-B1", "ctest-C1"]);
  });

  it("adaptive with cTestLevels: the listed C-tests first, in order, then never another", () => {
    const s = listed(["A2", "B1", "B2"], { adaptive: true, minItems: 10, maxItems: 16, targetSe: 0.45 });
    for (let seed = 1; seed <= 10; seed++) {
      const ids = runAdaptive(s, "PLACEMENT", null, seed);
      expect(ids.slice(0, 3)).toEqual(["ctest-A2", "ctest-B1", "ctest-B2"]);
      expect(ids.slice(3).filter(isC)).toEqual([]);
    }
  });

  it("adaptive skips a level with no C-test in the bank", () => {
    const noB1 = pool.filter((p) => p.id !== "ctest-B1");
    const s = listed(["A2", "B1", "B2"], { adaptive: true, minItems: 10, maxItems: 16, targetSe: 0.45 });
    const cfg = adaptiveConfigFor(s, "PLACEMENT", null);
    const rng = mulberry32(1);
    const responses: ReplayResponse[] = [];
    const served: string[] = [];
    for (let k = 0; k < 3; k++) {
      const next = nextAdaptiveItems(s, "PLACEMENT", null, replay(cfg, responses), noB1, cfg, rng)!;
      const id = next.itemIds[0];
      served.push(id);
      const item = noB1.find((p) => p.id === id)!;
      responses.push({ itemId: id, b: item.b, skillTag: item.skillTag, stimulusId: null, score: 0.5 });
    }
    expect(served.slice(0, 2)).toEqual(["ctest-A2", "ctest-B2"]);
    expect(isC(served[2])).toBe(false);
  });

  it("isTextOnly: a fixed GRAMMAR section with C-tests and no ordinary items", () => {
    expect(isTextOnly(listed(["B1"]), "PLACEMENT", null, 0)).toBe(true);
    expect(isTextOnly(listed(["B1"], { distribution: { kind: "RELATIVE", below: 0, at: 1, above: 0 } }), "PLACEMENT", null, 0)).toBe(false);
    expect(isTextOnly(listed(["B1"], { adaptive: true }), "PLACEMENT", null, 0)).toBe(false);
    expect(isTextOnly(fixed(false), "PLACEMENT", null, 0)).toBe(false);
  });
});

describe("C-test coverage", () => {
  const full: BankCount[] = SECTIONS.flatMap((section) =>
    CEFR_LEVELS.map((level) => ({ section, level, items: 12, stimuli: 3, ...(section === "GRAMMAR" ? { cTests: 1 } : {}) })),
  );
  const withFlag = (mode: "PLACEMENT" | "LEVEL_VERIFICATION") => {
    const cfg = defaultBlueprint(mode);
    cfg.sections = cfg.sections.map((s) => (s.section === "GRAMMAR" ? { ...s, cTest: true } : s));
    return cfg;
  };
  const cRows = (rows: ReturnType<typeof bankCoverage>["rows"]) => rows.filter((r) => r.cTest);

  it("asks for nothing extra while the flag is off", () => {
    expect(cRows(bankCoverage(full, defaultBlueprint("PLACEMENT"), "PLACEMENT", null).rows)).toEqual([]);
  });

  it("placement needs one C-test at B1 only", () => {
    const res = bankCoverage(full, withFlag("PLACEMENT"), "PLACEMENT", null);
    expect(cRows(res.rows).map((r) => [r.level, r.needed, r.available, r.ok])).toEqual([["B1", 1, 1, true]]);
    expect(res.ok).toBe(true);
    const noB1 = full.map((c) => (c.section === "GRAMMAR" && c.level === "B1" ? { ...c, cTests: 0 } : c));
    const failed = bankCoverage(noB1, withFlag("PLACEMENT"), "PLACEMENT", null);
    expect(failed.ok).toBe(false);
    expect(failed.rows.filter((r) => !r.ok).map((r) => `${r.section}:${r.level}:${r.cTest ? "ctest" : "items"}`)).toEqual(["GRAMMAR:B1:ctest"]);
    const noA1 = full.map((c) => (c.section === "GRAMMAR" && c.level === "A1" ? { ...c, cTests: 0 } : c));
    expect(bankCoverage(noA1, withFlag("PLACEMENT"), "PLACEMENT", null).ok).toBe(true);
  });

  it("verification needs the claimed level's C-test, or every level without a claim", () => {
    expect(cRows(bankCoverage(full, withFlag("LEVEL_VERIFICATION"), "LEVEL_VERIFICATION", "C1").rows).map((r) => r.level)).toEqual(["C1"]);
    expect(cRows(bankCoverage(full, withFlag("LEVEL_VERIFICATION"), "LEVEL_VERIFICATION", null).rows).map((r) => r.level)).toEqual([...CEFR_LEVELS]);
  });

  it("does not count C-tests as ordinary grammar items", () => {
    const thin = full.map((c) => (c.section === "GRAMMAR" && c.level === "B1" ? { ...c, items: 9, cTests: 1 } : c));
    // Verification B1 needs 6 at B1; 9 items of which 1 C-test leaves 8.
    const res = bankCoverage(thin, defaultBlueprint("LEVEL_VERIFICATION"), "LEVEL_VERIFICATION", "B1");
    expect(res.rows.find((r) => r.section === "GRAMMAR" && r.level === "B1" && !r.cTest)?.available).toBe(8);
  });

  it("cTestLevels: one coverage row per listed level", () => {
    const cfg = defaultBlueprint("PLACEMENT");
    cfg.sections = cfg.sections.map((s) => (s.section === "GRAMMAR" ? { ...s, cTestLevels: ["A2", "B1", "B2"] as Cefr[] } : s));
    expect(cRows(bankCoverage(full, cfg, "PLACEMENT", null).rows).map((r) => r.level)).toEqual(["A2", "B1", "B2"]);
    const noB1 = full.map((c) => (c.section === "GRAMMAR" && c.level === "B1" ? { ...c, cTests: 0 } : c));
    const res = bankCoverage(noB1, cfg, "PLACEMENT", null);
    expect(res.ok).toBe(false);
    expect(cRows(res.rows).filter((r) => !r.ok).map((r) => r.level)).toEqual(["B1"]);
  });
});

describe("productive task levels", () => {
  it("tests the claim in verification", () => {
    expect(productiveTaskLevels("LEVEL_VERIFICATION", "B2", "A2", 2)).toEqual(["B2", "B2"]);
  });
  it("reaches one level up in placement", () => {
    expect(productiveTaskLevels("PLACEMENT", null, "B1", 2)).toEqual(["B1", "B2"]);
    expect(productiveTaskLevels("PLACEMENT", null, "C2", 2)).toEqual(["C2", "C2"]);
  });
});

describe("weighsTexts", () => {
  it("is on only for a GRAMMAR section with cTestLevels (exams taken before 2026-10-15 keep weight 1)", () => {
    expect(weighsTexts(section("GRAMMAR", 30, { cTestLevels: ["A1", "B1"] }))).toBe(true);
    expect(weighsTexts(section("GRAMMAR", 17, { adaptive: true, minItems: 10, maxItems: 16, targetSe: 0.45, cTest: true }))).toBe(false);
    expect(weighsTexts(section("GRAMMAR", 17))).toBe(false);
    expect(weighsTexts(section("READING", 20))).toBe(false);
  });
});

describe("MC cloze and word-bank texts (spec 2026-10-18)", () => {
  const NONE = { kind: "ABSOLUTE" as const, perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } };
  type Texts = NonNullable<SectionConfig["texts"]>;
  const withTexts = (texts: Texts, over: Partial<SectionConfig> = {}) => section("GRAMMAR", 30, { distribution: NONE, texts, ...over });
  const pool: BankItem[] = CEFR_LEVELS.flatMap((level) => [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `${level}-${i}`, level, b: thetaForLevel(level), skillTag: `grammar.t${i % 3}`, stimulusId: null, orderInStimulus: 0 })),
    { id: `ctest-${level}`, level, b: thetaForLevel(level), skillTag: C_TEST_SKILL_TAG, stimulusId: null, orderInStimulus: 0 },
    { id: `cloze-${level}`, level, b: thetaForLevel(level), skillTag: CLOZE_SKILL_TAG, stimulusId: null, orderInStimulus: 0 },
    { id: `bank-${level}`, level, b: thetaForLevel(level), skillTag: WORD_BANK_SKILL_TAG, stimulusId: null, orderInStimulus: 0 },
  ]);
  const isText = (id: string) => /^(ctest|cloze|bank)-/.test(id);

  it("schema: texts for GRAMMAR only, no kind and level twice, both kinds at one level fine", () => {
    const cfg = defaultBlueprint("PLACEMENT");
    const put = (texts: unknown, target = "GRAMMAR") => ({ ...cfg, sections: cfg.sections.map((x) => (x.section === target ? { ...x, texts } : x)) });
    expect(blueprintConfigSchema.safeParse(put([{ level: "B1", kind: "CLOZE" }, { level: "B1", kind: "WORDBANK" }])).success).toBe(true);
    expect(blueprintConfigSchema.safeParse(put([{ level: "B1", kind: "CLOZE" }, { level: "B1", kind: "CLOZE" }])).success).toBe(false);
    expect(blueprintConfigSchema.safeParse(put([])).success).toBe(false);
    expect(blueprintConfigSchema.safeParse(put([{ level: "B1", kind: "CTEST" }])).success).toBe(false);
    expect(blueprintConfigSchema.safeParse(put([{ level: "B1", kind: "CLOZE" }], "READING")).success).toBe(false);
  });

  it("textPlanOf: cloze easy to hard, then word banks easy to hard, whatever the stored order", () => {
    const s = withTexts([
      { level: "B2", kind: "WORDBANK" },
      { level: "C1", kind: "CLOZE" },
      { level: "A2", kind: "WORDBANK" },
      { level: "A1", kind: "CLOZE" },
      { level: "B1", kind: "CLOZE" },
    ]);
    expect(textPlanOf(s, "PLACEMENT", null)).toEqual([
      { level: "A1", kind: "CLOZE" },
      { level: "B1", kind: "CLOZE" },
      { level: "C1", kind: "CLOZE" },
      { level: "A2", kind: "WORDBANK" },
      { level: "B2", kind: "WORDBANK" },
    ]);
  });

  it("textPlanOf: texts replaces the legacy fields; without it the legacy fields give C-tests; other sections none", () => {
    expect(textPlanOf(withTexts([{ level: "B1", kind: "CLOZE" }], { cTestLevels: ["A1"], cTest: true }), "PLACEMENT", null)).toEqual([{ level: "B1", kind: "CLOZE" }]);
    expect(textPlanOf(section("GRAMMAR", 30, { cTestLevels: ["B2", "A2"] }), "PLACEMENT", null)).toEqual([
      { level: "A2", kind: "CTEST" },
      { level: "B2", kind: "CTEST" },
    ]);
    expect(textPlanOf(section("GRAMMAR", 15, { cTest: true }), "LEVEL_VERIFICATION", "C1")).toEqual([{ level: "C1", kind: "CTEST" }]);
    expect(textPlanOf(section("GRAMMAR", 15), "PLACEMENT", null)).toEqual([]);
    expect(textPlanOf(section("READING", 15, { texts: [{ level: "B1", kind: "CLOZE" }] }), "PLACEMENT", null)).toEqual([]);
  });

  it("textKindsOf: each kind once in serving order, for the intro and the warm-up", () => {
    const both = withTexts([
      { level: "B2", kind: "WORDBANK" },
      { level: "A1", kind: "CLOZE" },
      { level: "B1", kind: "CLOZE" },
    ]);
    expect(textKindsOf(both, "PLACEMENT", null)).toEqual(["CLOZE", "WORDBANK"]);
    expect(textKindsOf(withTexts([{ level: "B1", kind: "WORDBANK" }]), "PLACEMENT", null)).toEqual(["WORDBANK"]);
    expect(textKindsOf(section("GRAMMAR", 30, { cTestLevels: ["A2", "B2"] }), "PLACEMENT", null)).toEqual(["CTEST"]);
    expect(textKindsOf(section("GRAMMAR", 15), "PLACEMENT", null)).toEqual([]);
  });

  it("fixed form: the planned texts first, of the right kind, then a form that never holds a text", () => {
    const texts: Texts = [{ level: "B1", kind: "WORDBANK" }, { level: "A2", kind: "CLOZE" }, { level: "B2", kind: "CLOZE" }];
    for (let seed = 1; seed <= 20; seed++) {
      const ids = planFixedSection(withTexts(texts, { distribution: { kind: "RELATIVE", below: 2, at: 4, above: 2 } }), pool, "PLACEMENT", null, 0, mulberry32(seed));
      expect(ids.slice(0, 3)).toEqual(["cloze-A2", "cloze-B2", "bank-B1"]);
      expect(ids.slice(3).filter(isText)).toEqual([]);
      expect(ids).toHaveLength(11);
    }
  });

  it("fixed form skips an entry the bank has no text for", () => {
    const thin = pool.filter((p) => p.id !== "cloze-B2");
    expect(planFixedSection(withTexts([{ level: "B2", kind: "CLOZE" }, { level: "B2", kind: "WORDBANK" }]), thin, "PLACEMENT", null, 0, mulberry32(1))).toEqual(["bank-B2"]);
  });

  it("no form draws a cloze or word bank by itself, adaptive or fixed", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const form = sampleFixedForm(pool, { A1: 8, A2: 8, B1: 8, B2: 8, C1: 8, C2: 8 }, mulberry32(seed));
      expect(form.filter(isText)).toEqual([]);
    }
    const s = section("GRAMMAR", 20, { adaptive: true, minItems: 10, maxItems: 30, targetSe: 0.2 });
    const cfg = adaptiveConfigFor(s, "PLACEMENT", null);
    const responses: ReplayResponse[] = [];
    const rng = mulberry32(3);
    for (;;) {
      const next = nextAdaptiveItems(s, "PLACEMENT", null, replay(cfg, responses), pool, cfg, rng);
      if (!next) break;
      for (const id of next.itemIds) responses.push({ itemId: id, b: pool.find((p) => p.id === id)!.b, skillTag: pool.find((p) => p.id === id)!.skillTag, stimulusId: null, score: rng() < 0.5 ? 1 : 0 });
    }
    expect(responses.length).toBe(30);
    expect(responses.map((r) => r.itemId).filter(isText)).toEqual([]);
  });

  it("adaptive: the planned texts first, one at a time, across kinds, and a reload continues where the student was", () => {
    const s = withTexts([{ level: "B1", kind: "WORDBANK" }, { level: "A2", kind: "CLOZE" }, { level: "B1", kind: "CLOZE" }], { adaptive: true, minItems: 6, maxItems: 10, targetSe: 0.3 });
    const cfg = adaptiveConfigFor(s, "PLACEMENT", null);
    const rng = mulberry32(5);
    const responses: ReplayResponse[] = [];
    for (let k = 0; k < 6; k++) {
      const next = nextAdaptiveItems(s, "PLACEMENT", null, replay(cfg, responses), pool, cfg, rng)!;
      expect(next.itemIds).toHaveLength(1);
      const item = pool.find((p) => p.id === next.itemIds[0])!;
      // Served, not yet answered: the next request still moves on.
      responses.push({ itemId: item.id, b: item.b, skillTag: item.skillTag, stimulusId: null, score: k % 2 ? null : 0.5 });
    }
    const ids = responses.map((r) => r.itemId);
    expect(ids.slice(0, 3)).toEqual(["cloze-A2", "cloze-B1", "bank-B1"]);
    expect(ids.slice(3).filter(isText)).toEqual([]);
  });

  it("isTextOnly: a fixed GRAMMAR section of texts only", () => {
    expect(isTextOnly(withTexts([{ level: "B1", kind: "CLOZE" }]), "PLACEMENT", null, 0)).toBe(true);
    expect(isTextOnly(withTexts([{ level: "B1", kind: "CLOZE" }], { distribution: { kind: "RELATIVE", below: 0, at: 2, above: 0 } }), "PLACEMENT", null, 0)).toBe(false);
    expect(isTextOnly(withTexts([{ level: "B1", kind: "WORDBANK" }], { adaptive: true }), "PLACEMENT", null, 0)).toBe(false);
  });

  it("weighsTexts: on for a section with texts", () => {
    expect(weighsTexts(withTexts([{ level: "B1", kind: "CLOZE" }]))).toBe(true);
    expect(weighsTexts(section("READING", 20, { texts: [{ level: "B1", kind: "CLOZE" }] }))).toBe(false);
  });

  it("coverage: one row per planned kind and level, counted from its own kind, and texts never count as items", () => {
    const counts: BankCount[] = SECTIONS.flatMap((section) =>
      CEFR_LEVELS.map((level) => ({ section, level, items: 20, stimuli: 3, ...(section === "GRAMMAR" ? { cTests: 1, clozeTexts: 2, wordBanks: level === "B1" ? 0 : 1 } : {}) })),
    );
    const cfg = defaultBlueprint("PLACEMENT");
    cfg.sections = cfg.sections.map((s) =>
      s.section === "GRAMMAR" ? { ...s, texts: [{ level: "B1", kind: "WORDBANK" }, { level: "A2", kind: "CLOZE" }, { level: "B1", kind: "CLOZE" }] as Texts } : s,
    );
    const res = bankCoverage(counts, cfg, "PLACEMENT", null);
    const textRows = res.rows.filter((r) => r.text);
    expect(textRows.map((r) => [r.text, r.level, r.needed, r.available, r.ok, r.cTest])).toEqual([
      ["CLOZE", "A2", 1, 2, true, undefined],
      ["CLOZE", "B1", 1, 2, true, undefined],
      ["WORDBANK", "B1", 1, 0, false, undefined],
    ]);
    expect(res.ok).toBe(false);
    // 20 approved grammar items at B1, of which 1 C-test, 2 cloze and 0 word banks: 17 ordinary ones.
    expect(res.rows.find((r) => r.section === "GRAMMAR" && r.level === "B1" && !r.text)?.available).toBe(17);
  });
});
