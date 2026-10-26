import { describe, expect, it } from "vitest";
import { bankCoverage, blueprintConfigSchema, enabledSections, estimatedMinutes, type CoverageRow } from "@/lib/exam/blueprint";
import { SECTIONS, type ExamMode, type Section } from "@/lib/exam/types";
import {
  allocateMinutes,
  applyExamEdits,
  buildExamConfig,
  coverageGaps,
  cTestLevelsFor,
  defaultExamName,
  editedTotal,
  examTemplateFor,
  initialSectionEdits,
  MIN_SECTION_MINUTES,
  relativeTextsFor,
  textsFor,
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

  it("pins the quick-screen/placement boundary by time ratio (about 34 minutes with no skills: the quick screen is matched at 15, placement 77)", () => {
    expect(examTemplateFor(shape({ targetMinutes: 40 })).key).toBe("placement");
    expect(examTemplateFor(shape({ targetMinutes: 34 })).key).toBe("placement");
    expect(examTemplateFor(shape({ targetMinutes: 33 })).key).toBe("quick-screen");
    expect(examTemplateFor(shape({ targetMinutes: 30 })).key).toBe("quick-screen");
    expect(examTemplateFor(shape({ targetMinutes: 60 })).key).toBe("placement");
    expect(examTemplateFor(shape({ skills: ["GRAMMAR"], targetMinutes: 40 })).key).toBe("quick-screen");
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

  it("scales a per-level fixed form with the minutes, keeping every level it uses", () => {
    const perLevel = (target: number, section: Section) => {
      const all: Section[] = ["GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"];
      const d = buildExamConfig(shape({ skills: all, targetMinutes: target })).config.sections.find((s) => s.section === section)!.distribution;
      if (d.kind !== "ABSOLUTE") throw new Error("expected a per-level form");
      return d.perLevel;
    };
    const short = perLevel(32, "READING");
    const long = perLevel(120, "READING");
    expect([short.A1, short.C2, long.A1, long.C2]).toEqual([0, 0, 0, 0]);
    for (const l of ["A2", "B1", "B2", "C1"] as const) {
      expect(short[l]).toBeGreaterThanOrEqual(1);
      expect(short[l]).toBeLessThan(4);
      expect(long[l]).toBeGreaterThan(4);
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

  it("names the kind of a missing text (cloze, word bank, C-test)", () => {
    const rows: CoverageRow[] = [
      { section: "GRAMMAR", level: "A2", needed: 1, available: 0, text: "CLOZE", ok: false },
      { section: "GRAMMAR", level: "B1", needed: 1, available: 0, text: "WORDBANK", ok: false },
      { section: "GRAMMAR", level: "B2", needed: 1, available: 0, cTest: true, text: "CTEST", ok: false },
    ];
    expect(coverageGaps(rows)).toEqual([
      { section: "GRAMMAR", level: "A2", missing: 1, cTest: false, text: "CLOZE" },
      { section: "GRAMMAR", level: "B1", missing: 1, cTest: false, text: "WORDBANK" },
      { section: "GRAMMAR", level: "B2", missing: 1, cTest: true, text: "CTEST" },
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

describe("text sections follow the minutes", () => {
  const ALL = ["GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"] as const;
  const kinds = (texts: Array<{ level: string; kind: string }> | undefined) => (texts ?? []).map((t) => `${t.kind} ${t.level}`);
  const grammarOf = (s: ExamShape) => buildExamConfig(s).config.sections.find((x) => x.section === "GRAMMAR")!;

  it("placement: fewer minutes drop the word banks, then the lowest cloze texts; more widen each kind", () => {
    // Since 2026-10-23 the placement's C1 and C2 texts are open cloze texts; they sit on the cloze ladder.
    for (const [target, cloze, wordBanks, open] of [
      // All five sections at 77 minutes give grammar 27 of its 30: one text fewer, the lowest word bank.
      [77, ["A1", "A2", "B1", "B2"], ["B1", "B2"], ["C1", "C2"]],
      [60, ["A1", "A2", "B1", "B2"], [], ["C1", "C2"]],
      [45, ["A2", "B1", "B2"], [], ["C1", "C2"]],
      [120, ["A1", "A2", "B1", "B2"], ["A2", "B1", "B2", "C1"], ["C1", "C2"]],
    ] as const) {
      const s = shape({ skills: [...ALL], targetMinutes: target });
      expect(examTemplateFor(s).key, `${target} min template`).toBe("placement");
      const g = grammarOf(s);
      expect(g.cTestLevels, `${target} min`).toBeUndefined();
      expect(kinds(g.texts), `${target} min (${g.durationMinutes} grammar)`).toEqual([
        ...cloze.map((l) => `CLOZE ${l}`),
        ...wordBanks.map((l) => `WORDBANK ${l}`),
        ...open.map((l) => `OPEN ${l}`),
      ]);
    }
  });

  it("quick screen: fewer minutes drop the word banks, then the lowest cloze texts; more widen upward first", () => {
    for (const [target, cloze, wordBanks] of [
      [10, ["A2", "B1", "B2"], []],
      [15, ["A1", "A2", "B1", "B2"], []],
      [20, ["A1", "A2", "B1", "B2"], ["A2", "B1"]],
      [25, ["A1", "A2", "B1", "B2"], ["A1", "A2", "B1"]],
      [35, ["A1", "A2", "B1", "B2", "C1", "C2"], ["A1", "A2", "B1", "B2"]],
    ] as const) {
      const s = shape({ skills: ["GRAMMAR"], targetMinutes: target });
      expect(examTemplateFor(s).key).toBe("quick-screen");
      expect(kinds(grammarOf(s).texts), `${target} min`).toEqual([...cloze.map((l) => `CLOZE ${l}`), ...wordBanks.map((l) => `WORDBANK ${l}`)]);
    }
  });

  it("a shorter AI-made quick screen keeps its hardest cloze text at B2 (final review I1)", () => {
    for (const target of [15, 20, 25]) {
      for (const skills of [["GRAMMAR"] as Section[], []]) {
        const s = shape({ skills, targetMinutes: target });
        expect(examTemplateFor(s).key, `${target} min`).toBe("quick-screen");
        const cloze = (grammarOf(s).texts ?? []).filter((t) => t.kind === "CLOZE").map((t) => t.level);
        expect(cloze.at(-1), `${target} min, skills [${skills.join(",")}]`).toBe("B2");
        expect(cloze, `${target} min`).toContain("B1");
      }
    }
  });

  it("textsFor: at least one text, B2 kept longest; word banks drop out before cloze texts, never when they stand alone", () => {
    const t = (cloze: string[], wordBanks: string[]) => [
      ...cloze.map((level) => ({ level, kind: "CLOZE" as const })),
      ...wordBanks.map((level) => ({ level, kind: "WORDBANK" as const })),
    ] as Parameters<typeof textsFor>[0];
    expect(kinds(textsFor(t(["A2", "B1", "B2"], ["B1"]), 0.1))).toEqual(["CLOZE B2"]);
    expect(kinds(textsFor(t(["A2", "B1", "B2"], ["B1"]), 0.5))).toEqual(["CLOZE B1", "CLOZE B2"]);
    expect(kinds(textsFor(t(["A2", "B1", "B2"], ["B1"]), 0.75))).toEqual(["CLOZE A2", "CLOZE B1", "CLOZE B2"]);
    expect(kinds(textsFor(t([], ["A2", "B1", "B2"]), 0.1))).toEqual(["WORDBANK B2"]);
    // Above B2 the top is kept before the lowest levels: never cut the top of the span first.
    expect(kinds(textsFor(t(["A1", "A2", "B1", "B2", "C1", "C2"], []), 0.5))).toEqual(["CLOZE B1", "CLOZE B2", "CLOZE C2"]);
    expect(kinds(textsFor(t(["B1"], ["B1"]), 1))).toEqual(["CLOZE B1", "WORDBANK B1"]);
    // An open cloze text at a level that also has a cloze text goes and stays with that level.
    const withOpen = [...t(["A2", "B1", "B2"], []), { level: "B2", kind: "OPEN" }] as Parameters<typeof textsFor>[0];
    expect(kinds(textsFor(withOpen, 0.1))).toEqual(["CLOZE B2", "OPEN B2"]);
  });

  it("textsFor: open cloze texts count as texts and sit on the cloze ladder, each level keeping its kind", () => {
    const placement = [
      ...["A1", "A2", "B1", "B2"].map((level) => ({ level, kind: "CLOZE" as const })),
      ...["A2", "B1", "B2"].map((level) => ({ level, kind: "WORDBANK" as const })),
      ...["C1", "C2"].map((level) => ({ level, kind: "OPEN" as const })),
    ] as Parameters<typeof textsFor>[0];
    // Half the minutes: round(9 / 2) = 5 texts, word banks first, then A1; the open C1 and C2 stay.
    expect(kinds(textsFor(placement, 0.5))).toEqual(["CLOZE A2", "CLOZE B1", "CLOZE B2", "OPEN C1", "OPEN C2"]);
    // A third: 3 texts, B2, B1 and the top of the span.
    expect(kinds(textsFor(placement, 1 / 3))).toEqual(["CLOZE B1", "CLOZE B2", "OPEN C2"]);
    expect(textsFor(placement, 0.5)).toHaveLength(5);
    // The same minutes keep the list; more minutes widen the word banks, the full ladder has no room left.
    expect(kinds(textsFor(placement, 1))).toEqual(kinds(placement));
    expect(kinds(textsFor(placement, 4 / 3))).toEqual([...kinds(placement).slice(0, 4), "WORDBANK A2", "WORDBANK B1", "WORDBANK B2", "WORDBANK C1", "OPEN C1", "OPEN C2"]);
  });

  it("relativeTextsFor: the level check's texts scale with the minutes, the claim kept longest, word bank first to go", () => {
    type Relative = Parameters<typeof relativeTextsFor>[0];
    const rel = (cloze: number[], wordBanks: number[]) =>
      [...cloze.map((offset) => ({ offset, kind: "CLOZE" as const })), ...wordBanks.map((offset) => ({ offset, kind: "WORDBANK" as const }))] as Relative;
    const names = (texts: Relative) => texts.map((t) => `${t.kind} ${t.offset}`);
    const levelCheck = rel([-1, 0, 1], [0]);
    expect(names(relativeTextsFor(levelCheck, 1))).toEqual(["CLOZE -1", "CLOZE 0", "CLOZE 1", "WORDBANK 0"]);
    // Fewer minutes: round(4 * f) texts, at least one; the word bank goes first, then the cloze texts farthest from the claim
    // (the one above is kept before the one below), the claim itself last.
    expect(names(relativeTextsFor(levelCheck, 0.75))).toEqual(["CLOZE -1", "CLOZE 0", "CLOZE 1"]);
    expect(names(relativeTextsFor(levelCheck, 0.5))).toEqual(["CLOZE 0", "CLOZE 1"]);
    expect(names(relativeTextsFor(levelCheck, 0.25))).toEqual(["CLOZE 0"]);
    expect(names(relativeTextsFor(levelCheck, 0.05))).toEqual(["CLOZE 0"]);
    // More minutes: each span widens, upward first, within two levels of the claim.
    expect(names(relativeTextsFor(levelCheck, 1.25))).toEqual(["CLOZE -1", "CLOZE 0", "CLOZE 1", "CLOZE 2", "WORDBANK 0"]);
    expect(names(relativeTextsFor(levelCheck, 1.5))).toEqual(["CLOZE -2", "CLOZE -1", "CLOZE 0", "CLOZE 1", "CLOZE 2", "WORDBANK 0", "WORDBANK 1"]);
    expect(names(relativeTextsFor(levelCheck, 10))).toEqual(["CLOZE -2", "CLOZE -1", "CLOZE 0", "CLOZE 1", "CLOZE 2", "WORDBANK -2", "WORDBANK -1", "WORDBANK 0", "WORDBANK 1", "WORDBANK 2"]);
    // A list of word banks alone stays word banks; an open cloze text keeps its kind on the ladder.
    expect(names(relativeTextsFor(rel([], [0, 1]), 0.1))).toEqual(["WORDBANK 0"]);
    const withOpen = [...rel([-1, 0], [0]), { offset: 1, kind: "OPEN" as const }] as Relative;
    expect(names(relativeTextsFor(withOpen, 0.5))).toEqual(["CLOZE 0", "OPEN 1"]);
    // Whatever the minutes, the result is a valid list.
    for (const f of [0.01, 0.3, 0.6, 0.9, 1, 1.1, 1.7, 3, 20]) {
      const out = relativeTextsFor(levelCheck, f);
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(new Set(names(out)).size).toBe(out.length);
      for (const t of out) expect(Math.abs(t.offset)).toBeLessThanOrEqual(2);
    }
  });

  it("an AI-made level check scales its grammar texts with the minutes and stays valid", () => {
    const grammarAt = (target: number) => {
      const s = buildExamConfig(shape({ mode: "LEVEL_VERIFICATION", targetMinutes: target })).config.sections.find((x) => x.section === "GRAMMAR")!;
      expect([s.texts, s.cTestLevels]).toEqual([undefined, undefined]);
      return s;
    };
    expect(grammarAt(97).relativeTexts).toEqual(examTemplateFor(shape({ mode: "LEVEL_VERIFICATION" })).config.sections.find((x) => x.section === "GRAMMAR")!.relativeTexts);
    const counts = [30, 60, 97, 120].map((target) => grammarAt(target).relativeTexts!.length);
    expect(counts.every((n, i) => i === 0 || n >= counts[i - 1])).toBe(true);
    expect(counts[0]).toBeLessThan(counts[2]);
    expect(counts[3]).toBeGreaterThan(counts[2]);
  });

  it("an older C-test section keeps one text per five minutes, middle levels first, then wider upward (R11)", () => {
    for (const [minutes, levels] of [
      [3, ["B1"]],
      [10, ["A2", "B1"]],
      [15, ["A2", "B1", "B2"]],
      [20, ["A2", "B1", "B2", "C1"]],
      [25, ["A1", "A2", "B1", "B2", "C1"]],
      [60, ["A1", "A2", "B1", "B2", "C1", "C2"]],
    ] as const) {
      expect(cTestLevelsFor(["A2", "B1", "B2"], minutes), `${minutes} min`).toEqual(levels);
    }
  });

});

