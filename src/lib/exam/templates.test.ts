import { describe, expect, it } from "vitest";
import { SEED_BANK } from "@/db/seed-bank";
import { eap, mulberry32, pCorrect } from "./adaptive";
import { adaptiveConfigFor, bankCoverage, blueprintConfigSchema, enabledSections, estimatedMinutes, resolveDistribution, type BankCount } from "./blueprint";
import { BAND_CENTER, levelFromTheta, thetaForLevel } from "./cefr";
import { isNavigableConfig } from "./navigation";
import { poolPosteriors } from "./result";
import { EXAM_TEMPLATES, examTemplateByKey } from "./templates";
import { C_TEST_SKILL_TAG, CEFR_LEVELS, isObjectiveSection, SECTIONS } from "./types";

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

  it("quick screen: fixed grammar only, four per level, 15 minutes, released at once", () => {
    const t = byKey("quick-screen");
    expect(enabledSections(t.config).map((s) => s.section)).toEqual(["GRAMMAR"]);
    expect(sectionOf("quick-screen", "GRAMMAR")).toMatchObject({
      adaptive: false,
      durationMinutes: 15,
      distribution: { kind: "ABSOLUTE", perLevel: { A1: 4, A2: 4, B1: 4, B2: 4, C1: 4, C2: 4 } },
      // The adaptive settings stay for a school that switches the section back.
      minItems: 15,
      maxItems: 30,
      targetSe: 0.5,
      cTest: false,
    });
    expect(estimatedMinutes(t.config)).toBe(15);
    expect(t.config.resultVisibility).toBe("OVERALL");
    expect(t.config.autoRelease).toBe(true);
    expect(t.config.proctoring.preset).toBe("STANDARD");
  });

  it("placement: five sections, about 64 minutes, fixed forms spread over the levels, grammar opens with a C-test", () => {
    const t = byKey("placement");
    expect(estimatedMinutes(t.config)).toBe(64);
    expect(sectionOf("placement", "GRAMMAR")).toMatchObject({
      adaptive: false,
      durationMinutes: 17,
      distribution: { kind: "ABSOLUTE", perLevel: { A1: 3, A2: 3, B1: 3, B2: 3, C1: 3, C2: 3 } },
      minItems: 10,
      maxItems: 16,
      targetSe: 0.45,
      cTest: true,
    });
    expect(t.summary.tr).toContain("64 dakika");
    expect(t.summary.en).toContain("64 minutes");
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

  it("placement's coverage asks for the B1 C-test and nothing else for C-tests", () => {
    const t = byKey("placement");
    const rows = bankCoverage(seedCounts(), t.config, t.mode, null).rows.filter((r) => r.cTest);
    expect(rows.map((r) => [r.section, r.level, r.needed, r.ok])).toEqual([["GRAMMAR", "B1", 1, true]]);
    for (const key of ["quick-screen", "level-check"]) {
      const o = byKey(key);
      expect(bankCoverage(seedCounts(), o.config, o.mode, null).rows.filter((r) => r.cTest)).toEqual([]);
    }
  });

  it("returns null for an unknown key", () => {
    expect(examTemplateByKey("nope")).toBeNull();
    expect(examTemplateByKey("")).toBeNull();
  });

  it("hands out a copy, so a caller cannot change the template", () => {
    const a = byKey("placement");
    a.config.sections[0].durationMinutes = 99;
    expect(byKey("placement").config.sections[0].durationMinutes).toBe(17);
  });

  it("placement's fixed form places simulated students within one level (pooled objective skills)", () => {
    // The Rasch model the engine scores with, the form as resolveDistribution
    // plans it, the opening C-test as one partial-credit observation. Students
    // are spread across each band, not only its centre.
    const t = byKey("placement");
    const rng = mulberry32(2026);
    const objective = enabledSections(t.config).filter((s) => isObjectiveSection(s.section));
    const within = ["EASY", "MID", "HARD"] as const;
    for (const level of CEFR_LEVELS) {
      let exact = 0;
      let withinOne = 0;
      const runs = 150;
      for (let r = 0; r < runs; r++) {
        const theta = BAND_CENTER[level] - 0.5 + rng();
        const posteriors = objective.map((s) => {
          const cfg = adaptiveConfigFor(s, t.mode, null);
          const dist = resolveDistribution(s, t.mode, null, t.config.difficultyOffset);
          const observations = CEFR_LEVELS.flatMap((l) =>
            Array.from({ length: dist[l] }, () => {
              const b = thetaForLevel(l, within[Math.floor(rng() * 3)]);
              return { b, score: rng() < pCorrect(theta, b) ? 1 : 0 };
            }),
          );
          if (s.cTest) {
            const b = thetaForLevel("B1");
            let right = 0;
            for (let g = 0; g < 18; g++) right += rng() < pCorrect(theta, b) ? 1 : 0;
            observations.push({ b, score: right / 18 });
          }
          return eap(observations, { mean: cfg.priorMean, sd: cfg.priorSd });
        });
        const got = levelFromTheta(poolPosteriors(posteriors)!.mean).level;
        const diff = Math.abs(CEFR_LEVELS.indexOf(got) - CEFR_LEVELS.indexOf(level));
        if (diff === 0) exact++;
        if (diff <= 1) withinOne++;
      }
      expect(withinOne / runs, `${level} within one`).toBeGreaterThanOrEqual(0.95);
      // C2 sits above the top text of the form; it is exact less often (about 40% in the long run).
      expect(exact / runs, `${level} exact`).toBeGreaterThanOrEqual(level === "C2" ? 0.25 : 0.5);
    }
  });
});
