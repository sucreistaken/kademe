import { describe, expect, it } from "vitest";
import { SEED_BANK } from "@/db/seed-bank";
import { bankCoverage, blueprintConfigSchema, enabledSections, estimatedMinutes, type BankCount } from "./blueprint";
import { EXAM_TEMPLATES, examTemplateByKey } from "./templates";
import { C_TEST_SKILL_TAG, CEFR_LEVELS, SECTIONS } from "./types";

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

  it("quick screen: adaptive grammar only, 15 minutes, released at once", () => {
    const t = byKey("quick-screen");
    expect(enabledSections(t.config).map((s) => s.section)).toEqual(["GRAMMAR"]);
    expect(sectionOf("quick-screen", "GRAMMAR")).toMatchObject({ adaptive: true, durationMinutes: 15, minItems: 15, maxItems: 30, targetSe: 0.5, cTest: false });
    expect(estimatedMinutes(t.config)).toBe(15);
    expect(t.config.resultVisibility).toBe("OVERALL");
    expect(t.config.autoRelease).toBe(true);
    expect(t.config.proctoring.preset).toBe("STANDARD");
  });

  it("placement: five sections, about 57 minutes, opens grammar with a C-test, the teacher confirms", () => {
    const t = byKey("placement");
    expect(estimatedMinutes(t.config)).toBe(57);
    expect(sectionOf("placement", "GRAMMAR")).toMatchObject({ adaptive: true, durationMinutes: 17, minItems: 10, maxItems: 16, targetSe: 0.45, cTest: true });
    expect(t.summary.tr).toContain("57 dakika");
    expect(t.summary.en).toContain("57 minutes");
    expect(sectionOf("placement", "READING")).toMatchObject({ adaptive: true, durationMinutes: 12, minItems: 5, maxItems: 8, targetSe: 0.55 });
    expect(sectionOf("placement", "LISTENING")).toMatchObject({ adaptive: true, durationMinutes: 12, minItems: 5, maxItems: 8, targetSe: 0.55 });
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
});
