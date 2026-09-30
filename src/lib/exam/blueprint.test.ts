import { describe, expect, it } from "vitest";
import { mulberry32 } from "./adaptive";
import {
  bankCoverage,
  blueprintConfigSchema,
  defaultBlueprint,
  estimatedMinutes,
  productiveTaskLevels,
  resolveDistribution,
  sampleFixedForm,
  type BankCount,
  type BankItem,
} from "./blueprint";
import { thetaForLevel } from "./cefr";
import { CEFR_LEVELS, SECTIONS } from "./types";

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

describe("productive task levels", () => {
  it("tests the claim in verification", () => {
    expect(productiveTaskLevels("LEVEL_VERIFICATION", "B2", "A2", 2)).toEqual(["B2", "B2"]);
  });
  it("reaches one level up in placement", () => {
    expect(productiveTaskLevels("PLACEMENT", null, "B1", 2)).toEqual(["B1", "B2"]);
    expect(productiveTaskLevels("PLACEMENT", null, "C2", 2)).toEqual(["C2", "C2"]);
  });
});
