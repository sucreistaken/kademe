import { describe, expect, it } from "vitest";
import { bankCoverage, blueprintConfigSchema, enabledSections, estimatedMinutes, type CoverageRow } from "@/lib/exam/blueprint";
import { SECTIONS, type ExamMode, type Section } from "@/lib/exam/types";
import {
  allocateMinutes,
  applyExamEdits,
  buildExamConfig,
  coverageGaps,
  defaultExamName,
  editedTotal,
  examTemplateFor,
  initialSectionEdits,
  MIN_SECTION_MINUTES,
  type ExamShape,
} from "./exam-config";

const shape = (over: Partial<ExamShape> = {}): ExamShape => ({ mode: "PLACEMENT", targetMinutes: null, skills: [], emphasis: null, speakingRequired: null, ...over });
const subsets: Section[][] = Array.from({ length: 31 }, (_, mask) => SECTIONS.filter((_, i) => ((mask + 1) >> i) & 1));

describe("allocateMinutes", () => {
  it("hits the target exactly and keeps every section at the minimum", () => {
    expect(allocateMinutes(40, [17, 12, 12], 3)).toEqual([16, 12, 12]);
    expect(allocateMinutes(40, [17, 12, 12], 3).reduce((a, n) => a + n, 0)).toBe(40);
    expect(allocateMinutes(10, [1, 1, 1, 1, 1], 3)).toEqual([3, 3, 3, 3, 3]);
  });
});

describe("examTemplateFor", () => {
  it("picks the nearest template by mode, sections and minutes", () => {
    expect(examTemplateFor(shape({ skills: ["GRAMMAR"], targetMinutes: 15 })).key).toBe("quick-screen");
    expect(examTemplateFor(shape({ targetMinutes: 40 })).key).toBe("placement");
    expect(examTemplateFor(shape({ skills: ["GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"], targetMinutes: 20 })).key).toBe("placement");
    expect(examTemplateFor(shape({ mode: "LEVEL_VERIFICATION", targetMinutes: 30 })).key).toBe("level-check");
  });
});

describe("buildExamConfig", () => {
  it("stays inside the schema for every mode, section set and minutes 10..120", () => {
    for (const mode of ["PLACEMENT", "LEVEL_VERIFICATION"] as ExamMode[]) {
      for (const skills of subsets) {
        for (let target = 10; target <= 120; target++) {
          const { config } = buildExamConfig(shape({ mode, skills, targetMinutes: target }));
          expect(blueprintConfigSchema.safeParse(config).success).toBe(true);
          const on = enabledSections(config);
          expect(on.map((s) => s.section).sort()).toEqual([...skills].sort());
          expect(estimatedMinutes(config)).toBe(Math.max(target, MIN_SECTION_MINUTES * on.length));
          for (const s of config.sections) expect(s.durationMinutes).toBeLessThanOrEqual(180);
        }
      }
    }
  });

  it("gives the emphasis section the largest share", () => {
    for (const target of [30, 40, 60, 90, 120]) {
      const { config } = buildExamConfig(shape({ targetMinutes: target, emphasis: "READING" }));
      const reading = config.sections.find((s) => s.section === "READING")!.durationMinutes;
      for (const s of enabledSections(config)) expect(reading).toBeGreaterThanOrEqual(s.durationMinutes);
    }
  });

  it("switches on an emphasis section the template had off", () => {
    const { config } = buildExamConfig(shape({ skills: ["GRAMMAR"], targetMinutes: 30, emphasis: "READING" }));
    expect(enabledSections(config).map((s) => s.section).sort()).toEqual(["GRAMMAR", "READING"]);
  });

  it("drops speaking and its pass rule when speaking is not wanted", () => {
    const { config } = buildExamConfig(shape({ mode: "LEVEL_VERIFICATION", targetMinutes: 80, speakingRequired: false }));
    expect(config.sections.find((s) => s.section === "SPEAKING")!.enabled).toBe(false);
    expect(config.passRules.requiredSkills).toEqual([]);
  });

  it("keeps the template's own minutes when no target is given", () => {
    const { template, config } = buildExamConfig(shape());
    expect(estimatedMinutes(config)).toBe(estimatedMinutes(template.config));
  });

  it("never changes the template it starts from", () => {
    const before = JSON.stringify(examTemplateFor(shape({ targetMinutes: 40 })).config);
    buildExamConfig(shape({ targetMinutes: 90, emphasis: "LISTENING" }));
    expect(JSON.stringify(examTemplateFor(shape({ targetMinutes: 40 })).config)).toBe(before);
  });
});

describe("coverage gaps", () => {
  it("lists every failing row with what is missing", () => {
    const rows: CoverageRow[] = [
      { section: "READING", level: "B2", needed: 6, available: 2, units: 1, ok: false },
      { section: "LISTENING", level: "B1", needed: 3, available: 3, units: 0, ok: false },
      { section: "GRAMMAR", level: "B1", needed: 1, available: 0, cTest: true, ok: false },
      { section: "WRITING", level: "B1", needed: 1, available: 4, ok: true },
    ];
    expect(coverageGaps(rows)).toEqual([
      { section: "READING", level: "B2", missing: 4, cTest: false },
      { section: "LISTENING", level: "B1", missing: 1, cTest: false },
      { section: "GRAMMAR", level: "B1", missing: 1, cTest: true },
    ]);
  });

  it("finds gaps against an empty bank", () => {
    const { config } = buildExamConfig(shape({ targetMinutes: 40 }));
    expect(coverageGaps(bankCoverage([], config, "PLACEMENT", null).rows).length).toBeGreaterThan(0);
  });
});

describe("edits", () => {
  it("names a draft from the template and its minutes", () => {
    expect(defaultExamName("Yerleştirme sınavı", 40, "tr")).toBe("Yerleştirme sınavı, 40 dk");
    expect(defaultExamName("Placement test", 40, "en")).toBe("Placement test, 40 min");
  });

  it("applies minutes and on/off and refuses an exam with no section", () => {
    const { config } = buildExamConfig(shape({ targetMinutes: 40 }));
    const edits = initialSectionEdits(config).map((e) => (e.section === "SPEAKING" ? { ...e, enabled: false } : e.section === "READING" ? { ...e, durationMinutes: 20 } : e));
    const next = applyExamEdits(config, { name: "X", sections: edits })!;
    expect(next.sections.find((s) => s.section === "SPEAKING")!.enabled).toBe(false);
    expect(next.sections.find((s) => s.section === "READING")!.durationMinutes).toBe(20);
    expect(editedTotal(edits)).toBe(estimatedMinutes(next));
    expect(applyExamEdits(config, { name: "X", sections: edits.map((e) => ({ ...e, enabled: false })) })).toBeNull();
  });
});
