import { describe, expect, it } from "vitest";
import { PRESETS } from "@/lib/proctor/policy";
import { blueprintConfigSchema, defaultBlueprint, enabledSections, estimatedMinutes } from "../blueprint";
import { candidateExamName } from "../candidate-exam-name";
import { courseExamChoice, courseKeyOfChoice, examChoiceValue, parseExamChoice } from "../exam-choice";
import { EXAM_TEMPLATES, examTemplateByKey, readyTemplateByKey } from "../templates";
import { isObjectiveSection } from "../types";
import { COURSE_TESTS, courseSections, defaultCourseRules } from "./catalog";
import { courseBlueprint, courseMaxPoints, courseSpeakingTasks } from "./config";
import { courseKeyOfTemplate, courseTemplateKey } from "./template-keys";
import { COURSE_EXAM_TEMPLATES, courseExamTemplate, courseExamTemplateByKey, courseGermanNameOf } from "./templates";
import { COURSE_KEYS, SPEAKING_MAX, WRITING_MAX } from "./types";

const EM_DASH = "\u2014";

describe("course test templates", () => {
  it("has one ready template per course test, in catalog order, under the course template keys", () => {
    expect(COURSE_EXAM_TEMPLATES.map((t) => t.courseKey)).toEqual([...COURSE_KEYS]);
    expect(COURSE_EXAM_TEMPLATES.map((t) => t.key)).toEqual(COURSE_KEYS.map(courseTemplateKey));
    expect(COURSE_EXAM_TEMPLATES.map((t) => t.key)).toEqual(["course-a1-1", "course-a1", "course-a2-1", "course-a2", "course-b1-1", "course-b1", "course-b2-1", "course-b2"]);
    expect(new Set(COURSE_EXAM_TEMPLATES.map((t) => t.key)).size).toBe(8);
  });

  it.each(COURSE_KEYS)("%s validates with the blueprint schema", (key) => {
    const parsed = blueprintConfigSchema.safeParse(courseExamTemplate(key).config);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it.each(COURSE_KEYS)("%s has the catalog's sections in telc order with the catalog's minutes", (key) => {
    const config = courseExamTemplate(key).config;
    const plan = courseSections(key);
    expect(config.sections.map((s) => s.section)).toEqual(plan.map((p) => p.section));
    expect(config.sections.map((s) => s.durationMinutes)).toEqual(plan.map((p) => p.minutes));
    expect(config.sections.every((s) => s.enabled)).toBe(true);
    expect(estimatedMinutes(config)).toBe(plan.reduce((m, p) => m + p.minutes, 0));
  });

  it.each(COURSE_KEYS)("%s is all fixed forms: writing 1 task, speaking 2 (Zwischentest) or 3 (Abschlusstest) recorded once", (key) => {
    const config = courseExamTemplate(key).config;
    const tasks = COURSE_TESTS[key].kind === "INTERIM" ? 2 : 3;
    expect(courseSpeakingTasks(key)).toBe(tasks);
    for (const s of config.sections) {
      expect(s.adaptive, s.section).toBe(false);
      expect(s.thinkSeconds, s.section).toBeNull();
      expect(s.answerSeconds, s.section).toBeNull();
      if (s.section === "SPEAKING") {
        expect(s.tasks).toBe(tasks);
        expect(s.maxTakes).toBe(1);
      } else {
        expect(s.tasks).toBe(1);
        expect(s.maxTakes).toBeNull();
      }
      // The form is fixed, so nothing is drawn by level: no distribution and none of the gap-fill text plans.
      if (isObjectiveSection(s.section)) {
        expect(s.distribution).toEqual({ kind: "ABSOLUTE", perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } });
        expect(s.texts).toBeUndefined();
        expect(s.relativeTexts).toBeUndefined();
        expect(s.cTestLevels).toBeUndefined();
      }
    }
  });

  it.each(COURSE_KEYS)("%s is a COURSE_TEST that carries its course, no form yet and the default rules", (key) => {
    const t = courseExamTemplate(key);
    expect(t.mode).toBe("COURSE_TEST");
    expect(t.config.course).toEqual({ key, form: null, rules: defaultCourseRules(key) });
  });

  it.each(COURSE_KEYS)("%s is watched like the level check and shows the full result only after a teacher releases it", (key) => {
    const config = courseExamTemplate(key).config;
    expect(config.proctoring).toEqual(PRESETS.STRICT);
    expect(examTemplateByKey("level-check")!.config.proctoring).toEqual(config.proctoring);
    expect(config.resultVisibility).toBe("FULL");
    expect(config.autoRelease).toBe(false);
    expect(config.listening).toEqual({ maxPlays: 2 });
    // The course rules decide; the level engine's pass rules are all off.
    expect(config.passRules).toEqual({ overallAtLeastClaimed: false, minSkillOffset: null, requiredSkills: [], minHoldProbability: null });
  });

  it("is worth 56 points as a Zwischentest and 74 as an Abschlusstest, like the spec", () => {
    for (const key of COURSE_KEYS) expect(courseMaxPoints(key)).toBe(COURSE_TESTS[key].kind === "INTERIM" ? 56 : 74);
    for (const key of COURSE_KEYS) {
      const plan = courseSections(key);
      const objective = plan.filter((p) => isObjectiveSection(p.section)).reduce((n, p) => n + p.units, 0);
      expect(courseMaxPoints(key)).toBe(objective + WRITING_MAX + SPEAKING_MAX);
      expect(courseExamTemplate(key).points).toBe(courseMaxPoints(key));
    }
  });

  it("names every test for the panel in Turkish, English and German, and the student always reads the German name", () => {
    expect(courseExamTemplate("B1.1").name).toEqual({ tr: "Kurs ara sınavı B1.1", en: "Mid-course test B1.1", de: "Zwischentest B1.1" });
    expect(courseExamTemplate("B1").name).toEqual({ tr: "Kurs sonu sınavı B1", en: "End-of-course test B1", de: "Abschlusstest B1" });
    for (const t of COURSE_EXAM_TEMPLATES) {
      expect(t.germanName).toBe(COURSE_TESTS[t.courseKey].germanName);
      expect(t.name.de).toBe(t.germanName);
      expect(t.kind).toBe(COURSE_TESTS[t.courseKey].kind);
      expect(t.level).toBe(COURSE_TESTS[t.courseKey].level);
      for (const text of [t.name, t.summary]) {
        for (const lang of ["tr", "en", "de"] as const) {
          expect(text[lang].trim(), `${t.key} ${lang}`).not.toBe("");
          expect(text[lang].includes(EM_DASH), `${t.key} ${lang}`).toBe(false);
        }
      }
      // Every candidate language, every stored name: the German one.
      for (const stored of [t.name.tr, t.name.en, t.name.de]) {
        expect(courseGermanNameOf(stored)).toBe(t.germanName);
        for (const locale of ["tr", "en", "de", "es", "ar"] as const) expect(candidateExamName(stored, locale)).toBe(t.germanName);
      }
    }
  });

  it("does not turn another exam's name into a course name", () => {
    expect(courseGermanNameOf("Yerleştirme sınavı")).toBeNull();
    expect(courseGermanNameOf("Kurs ara sınavı B3.1")).toBeNull();
    expect(candidateExamName("Placement test", "de")).not.toMatch(/Zwischentest|Abschlusstest/);
    expect(candidateExamName("Ekim grubu Zwischentest", "en")).toBe("Ekim grubu Zwischentest");
  });

  it("is published through the ready-exam lookup, never through the exam wizard's list", () => {
    for (const t of COURSE_EXAM_TEMPLATES) {
      expect(readyTemplateByKey(t.key)).toMatchObject({ key: t.key, mode: "COURSE_TEST", config: t.config });
      expect(courseExamTemplateByKey(t.key)?.courseKey).toBe(t.courseKey);
      expect(examTemplateByKey(t.key)).toBeNull();
      expect(EXAM_TEMPLATES.some((x) => x.key === t.key)).toBe(false);
    }
    expect(readyTemplateByKey("placement")?.mode).toBe("PLACEMENT");
    expect(readyTemplateByKey("level-check")?.mode).toBe("LEVEL_VERIFICATION");
    expect(readyTemplateByKey("course-b3")).toBeNull();
    expect(readyTemplateByKey("")).toBeNull();
    expect(courseExamTemplateByKey("placement")).toBeNull();
  });

  it("hands out copies, so a caller that edits one never changes the template", () => {
    const a = courseExamTemplate("A1");
    a.config.sections[0].durationMinutes = 99;
    a.name.de = "x";
    expect(courseExamTemplate("A1").config.sections[0].durationMinutes).toBe(courseSections("A1")[0].minutes);
    expect(courseExamTemplate("A1").name.de).toBe("Abschlusstest A1");
    expect(COURSE_EXAM_TEMPLATES.find((t) => t.courseKey === "A1")!.config.sections[0].durationMinutes).toBe(courseSections("A1")[0].minutes);
  });

  it("round-trips the template key and the exam picker value", () => {
    for (const key of COURSE_KEYS) {
      expect(courseKeyOfTemplate(courseTemplateKey(key))).toBe(key);
      const choice = courseExamChoice(key);
      expect(examChoiceValue(choice)).toBe(`template:${courseTemplateKey(key)}`);
      expect(parseExamChoice(examChoiceValue(choice))).toEqual(choice);
      expect(courseKeyOfChoice(choice)).toBe(key);
    }
    expect(courseKeyOfChoice({ kind: "template", key: "placement" })).toBeNull();
    expect(courseKeyOfChoice({ kind: "blueprint", id: "course-b1" })).toBeNull();
  });

  it("starts a blank COURSE_TEST blueprint as the B1 Abschlusstest, and the same config object each time is a fresh one", () => {
    const blank = defaultBlueprint("COURSE_TEST");
    expect(blueprintConfigSchema.safeParse(blank).success).toBe(true);
    expect(blank).toEqual(courseBlueprint("B1"));
    expect(blank.course?.key).toBe("B1");
    expect(enabledSections(blank).map((s) => s.section)).toEqual(["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"]);
    expect(defaultBlueprint("COURSE_TEST")).not.toBe(blank);
  });
});
