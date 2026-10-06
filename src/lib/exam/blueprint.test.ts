import { describe, expect, it } from "vitest";
import { initialState, mulberry32, replay, type ReplayResponse } from "./adaptive";
import {
  adaptiveConfigFor,
  bankCoverage,
  blueprintConfigSchema,
  defaultBlueprint,
  nextAdaptiveItems,
  planFixedSection,
  section,
  estimatedMinutes,
  productiveTaskLevels,
  resolveDistribution,
  sampleFixedForm,
  type BankCount,
  type BankItem,
} from "./blueprint";
import { thetaForLevel } from "./cefr";
import { C_TEST_SKILL_TAG, CEFR_LEVELS, SECTIONS, type Cefr } from "./types";

describe("default blueprints", () => {
  it("both modes validate", () => {
    expect(blueprintConfigSchema.safeParse(defaultBlueprint("PLACEMENT")).success).toBe(true);
    expect(blueprintConfigSchema.safeParse(defaultBlueprint("LEVEL_VERIFICATION")).success).toBe(true);
  });

  it("adds up the minutes of enabled sections", () => {
    const cfg = defaultBlueprint("PLACEMENT");
    cfg.sections[4].enabled = false;
    expect(estimatedMinutes(cfg)).toBe(20 + 25 + 25 + 25);
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
    const thin = full.map((c) => (c.section === "LISTENING" && c.level === "C1" ? { ...c, items: 3, stimuli: 1 } : c));
    const res = bankCoverage(thin, defaultBlueprint("PLACEMENT"), "PLACEMENT", null);
    expect(res.ok).toBe(false);
    expect(res.rows.filter((r) => !r.ok).map((r) => `${r.section}:${r.level}`)).toEqual(["LISTENING:C1"]);
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
