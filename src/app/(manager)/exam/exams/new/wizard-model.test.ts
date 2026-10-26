import { describe, expect, it } from "vitest";
import { defaultBlueprint, section, type BlueprintConfig } from "@/lib/exam/blueprint";
import { EXAM_TEMPLATES } from "@/lib/exam/templates";
import { PRESETS } from "@/lib/proctor/policy";
import {
  clampMinutes,
  levelShiftScope,
  orderTemplates,
  RECOMMENDED_TEMPLATE,
  sectionChoices,
  sectionKind,
  sectionsWait,
  startDraft,
  textCount,
  totalMinutes,
  withProctoring,
  withSections,
  wizardConfig,
} from "./wizard-model";

const templates = EXAM_TEMPLATES.map((t) => ({ key: t.key, mode: t.mode, name: t.name.tr, config: t.config }));

describe("the start step", () => {
  it("puts the recommended placement test first and keeps the others in order", () => {
    expect(RECOMMENDED_TEMPLATE).toBe("placement");
    const keys = orderTemplates(templates).map((t) => t.key);
    expect(keys[0]).toBe("placement");
    expect(keys.slice(1)).toEqual(templates.map((t) => t.key).filter((k) => k !== "placement"));
  });

  it("a template gives its mode and a copy of its config; blank gives the mode's default", () => {
    const d = startDraft({ kind: "template", key: "level-check" }, templates)!;
    expect(d.mode).toBe("LEVEL_VERIFICATION");
    expect(d.config).toEqual(templates.find((t) => t.key === "level-check")!.config);
    d.config.sections[0].durationMinutes = 1;
    expect(templates.find((t) => t.key === "level-check")!.config.sections[0].durationMinutes).not.toBe(1);
    expect(startDraft({ kind: "blank", mode: "PLACEMENT" }, templates)).toEqual({ mode: "PLACEMENT", config: defaultBlueprint("PLACEMENT") });
    expect(startDraft({ kind: "template", key: "toefl" }, templates)).toBeNull();
  });
});

describe("the sections step", () => {
  const base = defaultBlueprint("PLACEMENT");

  it("changes only on/off and minutes, keeps the order and the rest of each section", () => {
    const choices = sectionChoices(base).map((c) => (c.section === "WRITING" ? { ...c, enabled: false } : c.section === "READING" ? { ...c, minutes: 30 } : c));
    const out = withSections(base, choices);
    expect(out.sections.map((s) => s.section)).toEqual(base.sections.map((s) => s.section));
    expect(out.sections.find((s) => s.section === "WRITING")?.enabled).toBe(false);
    expect(out.sections.find((s) => s.section === "READING")).toEqual({ ...base.sections.find((s) => s.section === "READING"), durationMinutes: 30 });
  });

  it("holds minutes to 1..180 and counts only sections that are on", () => {
    expect(clampMinutes(0)).toBe(1);
    expect(clampMinutes(400)).toBe(180);
    expect(clampMinutes(Number.NaN)).toBe(1);
    expect(clampMinutes(12.6)).toBe(13);
    expect(totalMinutes([{ section: "GRAMMAR", enabled: true, minutes: 20 }, { section: "READING", enabled: false, minutes: 25 }, { section: "WRITING", enabled: true, minutes: 10 }])).toBe(30);
  });

  it("waits while no section is on", () => {
    expect(sectionsWait(sectionChoices(base))).toBeNull();
    expect(sectionsWait(sectionChoices(base).map((c) => ({ ...c, enabled: false })))).toBe("NO_SECTION");
  });

  it("names how each section asks", () => {
    expect(sectionKind({ section: "GRAMMAR", adaptive: true })).toBe("adaptive");
    expect(sectionKind({ section: "READING", adaptive: false })).toBe("fixed");
    expect(sectionKind({ section: "SPEAKING", adaptive: false })).toBe("tasks");
    expect(sectionKind({ section: "GRAMMAR", adaptive: false, cTestLevels: ["A2", "B1"] })).toBe("texts");
    expect(sectionKind({ section: "GRAMMAR", adaptive: false, texts: [{ level: "A2", kind: "CLOZE" }] })).toBe("texts");
  });
});

describe("the proctoring step", () => {
  it("takes the preset whole and keeps the termination setting", () => {
    const base = defaultBlueprint("PLACEMENT");
    const on = { ...base, proctoring: { ...base.proctoring, termination: { enabled: true, screenShareGoneSeconds: 90, fullscreenExitMax: 3 } } };
    expect(withProctoring(on, "STANDARD").proctoring).toEqual({ ...PRESETS.STANDARD, termination: { enabled: true, screenShareGoneSeconds: 90, fullscreenExitMax: 3 } });
    expect(withProctoring(base, "OFF").proctoring).toEqual(PRESETS.OFF);
  });

  it("the whole draft is the start, then the sections, then the level", () => {
    const base = templates.find((t) => t.key === "placement")!.config;
    const choices = sectionChoices(base).map((c) => (c.section === "SPEAKING" ? { ...c, enabled: false } : c));
    const out = wizardConfig(base, choices, "OFF");
    expect(out.sections.find((s) => s.section === "SPEAKING")?.enabled).toBe(false);
    expect(out.proctoring.preset).toBe("OFF");
  });
});

describe("levelShiftScope (the editor's level shift)", () => {
  const cfg = (sections: BlueprintConfig["sections"]): BlueprintConfig => ({ ...defaultBlueprint("PLACEMENT"), sections });

  it("is off when every enabled question section is adaptive", () => {
    expect(levelShiftScope(cfg([section("GRAMMAR", 10, { adaptive: true }), section("READING", 10, { adaptive: true }), section("WRITING", 10)]))).toEqual({
      applies: false,
      fixed: [],
      adaptive: ["GRAMMAR", "READING"],
    });
  });

  it("applies to the fixed ones and names the adaptive ones it does not touch", () => {
    expect(levelShiftScope(cfg([section("GRAMMAR", 10, { adaptive: true }), section("READING", 10), section("LISTENING", 10, { enabled: false })]))).toEqual({
      applies: true,
      fixed: ["READING"],
      adaptive: ["GRAMMAR"],
    });
  });

  it("ignores writing and speaking, which have no levels to shift", () => {
    expect(levelShiftScope(cfg([section("WRITING", 10), section("SPEAKING", 10)])).applies).toBe(false);
  });

  it("leaves a C-test-only section out of the shift, which cTestLevels ignores", () => {
    const cTests = section("GRAMMAR", 15, {
      cTestLevels: ["A2", "B1", "B2"],
      distribution: { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } },
    });
    expect(levelShiftScope(cfg([cTests, section("READING", 10)]))).toEqual({ applies: true, fixed: ["READING"], adaptive: [] });
    expect(levelShiftScope(cfg([cTests])).applies).toBe(false);
  });

  it("leaves the level check's relative texts out of the shift: only reading and listening move", () => {
    const levelCheck = templates.find((t) => t.key === "level-check")!.config;
    expect(levelShiftScope(levelCheck)).toEqual({ applies: true, fixed: ["READING", "LISTENING"], adaptive: [] });
  });
});

describe("relative texts in the wizard (spec 2026-10-26)", () => {
  const NONE = { kind: "ABSOLUTE" as const, perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } };
  const relative = [{ offset: 0, kind: "CLOZE" as const }, { offset: 1, kind: "CLOZE" as const }];

  it("names a section of relative texts only as texts, and one with ordinary items as fixed", () => {
    expect(sectionKind({ section: "GRAMMAR", adaptive: false, relativeTexts: relative })).toBe("texts");
    expect(sectionKind({ section: "GRAMMAR", adaptive: false, relativeTexts: relative, distribution: NONE })).toBe("texts");
    expect(sectionKind({ section: "GRAMMAR", adaptive: false, relativeTexts: relative, distribution: { kind: "RELATIVE", below: 0, at: 2, above: 0 } })).toBe("fixed");
    expect(sectionKind({ section: "GRAMMAR", adaptive: true, relativeTexts: relative })).toBe("adaptive");
  });

  it("the level check's grammar shows as texts and counts the texts around B1 (a claim at either end has one fewer)", () => {
    const check = templates.find((t) => t.key === "level-check")!;
    const grammar = check.config.sections.find((s) => s.section === "GRAMMAR")!;
    expect(sectionKind(grammar)).toBe("texts");
    expect(textCount(grammar, check.mode)).toBe(4);
    // The other templates count the texts they list.
    const placement = templates.find((t) => t.key === "placement")!;
    expect(textCount(placement.config.sections.find((s) => s.section === "GRAMMAR")!, placement.mode)).toBe(9);
    const quick = templates.find((t) => t.key === "quick-screen")!;
    expect(textCount(quick.config.sections.find((s) => s.section === "GRAMMAR")!, quick.mode)).toBe(7);
  });
});
