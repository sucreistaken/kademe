import { describe, expect, it } from "vitest";
import { publishProblems } from "../rules/gate";
import { isChoice, type CompetencyFacts, type VersionContent } from "../rules/content";
import { activityPayloadSchema, stagePayloadSchema } from "../rules/patches";
import { templateCompetency } from "./competencies";
import { TEMPLATES, matchTemplate, templateByKey } from "./index";
import { materialise, templateCompetencyKeys, templateMinutes } from "./materialise";

/** A stable fake uuid per competency key, so the payload schemas accept it. */
const idOf = (key: string) => {
  const hex = [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${hex}`;
};

const EM_DASH = String.fromCharCode(0x2014);
const TEACHER_KEYS = new Set(["german-teacher-adult", "exam-prep-teacher", "german-teacher-young-learners", "online-german-teacher"]);
const BANNED = ["kaç yaşında", "yaşınız", "evli mi", "çocuğun var", "dinin", "hamile", "engelin var", "sağlık sorunun", "nerelisin", "how old", "married", "religion", "pregnan", "disabilit", "where are you from", "siyasi görüş", "hangi partiye", "political view", "which party"];

function contentOf(template: (typeof TEMPLATES)[number]): VersionContent {
  const { stages, weights } = materialise(template, idOf);
  return {
    id: "v",
    number: 1,
    status: "DRAFT",
    defaultLocale: "tr",
    localeSet: ["tr", "en"],
    weightsEnabled: true,
    draftWeights: weights,
    previewedAt: null,
    stages: stages.map((s, si) => ({ ...s, id: `s${si}`, orderIndex: si, activities: s.activities.map((a, ai) => ({ ...a, id: `s${si}a${ai}`, orderIndex: ai })) })),
  } as VersionContent;
}

function factsOf(template: (typeof TEMPLATES)[number]): Map<string, CompetencyFacts> {
  return new Map(
    templateCompetencyKeys(template).map((key) => {
      const c = templateCompetency(key)!;
      return [idOf(key), { id: idOf(key), name: c.name, description: c.description, archived: false, anchors: c.anchors, tags: [] }];
    }),
  );
}

describe("ready templates", () => {
  it("are the 20 roles of the plan, in gallery order", () => {
    expect(TEMPLATES).toHaveLength(20);
    expect(TEMPLATES.map((x) => x.group)).toEqual([...Array(8).fill("GENERIC"), ...Array(8).fill("LANGUAGE_SCHOOL"), ...Array(4).fill("EXTRA")]);
  });

  it("have unique keys and are found by key and by name", () => {
    expect(new Set(TEMPLATES.map((x) => x.key)).size).toBe(TEMPLATES.length);
    for (const x of TEMPLATES) {
      expect(templateByKey(x.key)).toBe(x);
      expect(matchTemplate(` ${x.name.tr.toLocaleUpperCase("tr")} `)).toBe(x);
    }
    expect(templateByKey("nope")).toBeNull();
  });

  for (const template of TEMPLATES) {
    describe(template.key, () => {
      it("passes every publish gate", () => {
        expect(publishProblems(contentOf(template), factsOf(template))).toEqual([]);
      });

      it("validates as builder payloads", () => {
        for (const s of materialise(template, idOf).stages) {
          expect(stagePayloadSchema.safeParse(s).success).toBe(true);
          for (const a of s.activities) expect(activityPayloadSchema.safeParse(a).success).toBe(true);
        }
      });

      it("weights exactly its 3 measured competencies with whole numbers adding up to 100", () => {
        const measured = new Set(template.stages.flatMap((s) => s.activities.flatMap((a) => a.competencyKeys)));
        expect(Object.keys(template.weights).sort()).toEqual([...measured].sort());
        expect(measured.size).toBe(3);
        expect(Object.values(template.weights).every((w) => Number.isInteger(w) && w > 0)).toBe(true);
        expect(Object.values(template.weights).reduce((a, b) => a + b, 0)).toBe(100);
        for (const key of measured) expect(templateCompetency(key), key).toBeDefined();
      });

      it("meets the content bar", () => {
        const teacher = TEACHER_KEYS.has(template.key);
        expect(template.stages.length).toBe(teacher ? 3 : 2);
        const minutes = templateMinutes(template);
        expect(minutes).toBeGreaterThanOrEqual(15);
        expect(minutes).toBeLessThanOrEqual(teacher ? 45 : 35);
        // Stage minutes are an AUTO_SUBMIT hard cap: they must fit the worst case
        // (every take of every recording used in full, 60 s per other question).
        for (const s of template.stages) {
          const worst = s.activities.reduce(
            (sum, a) => sum + (a.type === "VIDEO" || a.type === "AUDIO" ? (a.thinkSeconds + (a.answerSeconds ?? 0)) * a.maxTakes : 60),
            0,
          );
          expect(worst, s.name.en).toBeLessThanOrEqual(s.durationSeconds);
        }
        for (const s of template.stages) {
          expect(s.name.tr && s.name.en && s.description.tr && s.description.en).toBeTruthy();
          for (const a of s.activities) {
            expect(a.prompt.tr.trim() && a.prompt.en.trim()).toBeTruthy();
            if (isChoice(a.type)) {
              expect(a.config.choices!.length).toBeGreaterThanOrEqual(3);
              expect(a.config.choices!.filter((c) => c.correct)).toHaveLength(1);
              expect(a.config.choices!.every((c) => c.label.tr && c.label.en)).toBe(true);
            } else {
              expect(a.competencyKeys.length).toBeGreaterThanOrEqual(1);
              expect(a.competencyKeys.length).toBeLessThanOrEqual(2);
              expect(a.expectedBehaviours.length).toBeGreaterThanOrEqual(2);
              expect(a.expectedBehaviours.length).toBeLessThanOrEqual(4);
              expect(a.redFlags.length).toBeGreaterThanOrEqual(1);
              expect(a.redFlags.length).toBeLessThanOrEqual(3);
              expect(a.answerExamples[1] && a.answerExamples[3] && a.answerExamples[5]).toBeTruthy();
            }
          }
          expect(s.activities.some((a) => !isChoice(a.type))).toBe(true);
        }
      });

      it("has no em-dash and no question a hiring law forbids", () => {
        const text = JSON.stringify(template);
        expect(text.includes(EM_DASH)).toBe(false);
        const lower = text.toLocaleLowerCase("tr");
        for (const word of BANNED) expect(lower.includes(word), word).toBe(false);
      });
    });
  }

  it("every template competency has anchors 1, 3 and 5 in both languages and no em-dash", async () => {
    const { TEMPLATE_COMPETENCIES } = await import("./competencies");
    expect(new Set(TEMPLATE_COMPETENCIES.map((c) => c.key)).size).toBe(TEMPLATE_COMPETENCIES.length);
    for (const c of TEMPLATE_COMPETENCIES) {
      for (const level of [1, 3, 5] as const) expect(c.anchors[level].tr && c.anchors[level].en, `${c.key} ${level}`).toBeTruthy();
      expect(JSON.stringify(c).includes(EM_DASH)).toBe(false);
    }
  });
});
