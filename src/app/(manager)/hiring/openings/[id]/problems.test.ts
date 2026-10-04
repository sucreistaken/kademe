import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/locale";
import { managerT } from "@/i18n/manager";
import type { PublishProblem } from "@/solutions/hiring/rules/gate";
import { ANCHOR_PROBLEMS, STRUCTURE_PROBLEMS, WEIGHT_PROBLEMS } from "@/solutions/hiring/rules/gate";
import { activity, content, facts, stage } from "@/solutions/hiring/rules/test-fixtures";
import { describeProblem } from "./problems";

const OPENING = "33333333-3333-4333-8333-333333333333";
const COMP = "77777777-7777-4777-8777-777777777777";

/**
 * One sample per code. Typed as a record over every code, so a new
 * PublishProblem code is a type error here until it has a sample (and the
 * switch in describeProblem is exhaustive the same way).
 */
const SAMPLES: { [C in PublishProblem["code"]]: Extract<PublishProblem, { code: C }> } = {
  NO_STAGE: { code: "NO_STAGE" },
  EMPTY_STAGE_NAME: { code: "EMPTY_STAGE_NAME", stageId: "s2" },
  EMPTY_STAGE: { code: "EMPTY_STAGE", stageId: "s2" },
  EMPTY_PROMPT: { code: "EMPTY_PROMPT", activityId: "a2" },
  NO_COMPETENCY: { code: "NO_COMPETENCY", activityId: "a2" },
  TOO_MANY_COMPETENCIES: { code: "TOO_MANY_COMPETENCIES", activityId: "a2" },
  CHOICE_WITH_COMPETENCY: { code: "CHOICE_WITH_COMPETENCY", activityId: "a2" },
  CHOICE_NEEDS_OPTIONS: { code: "CHOICE_NEEDS_OPTIONS", activityId: "a2" },
  CHOICE_NEEDS_ANSWER: { code: "CHOICE_NEEDS_ANSWER", activityId: "a2" },
  COMPETENCY_MISSING: { code: "COMPETENCY_MISSING", competencyId: COMP },
  COMPETENCY_ARCHIVED: { code: "COMPETENCY_ARCHIVED", competencyId: COMP },
  ANCHOR_MISSING: { code: "ANCHOR_MISSING", competencyId: COMP, level: 3 },
  WEIGHTS_NOT_100: { code: "WEIGHTS_NOT_100", total: 80 },
  WEIGHTS_MISSING: { code: "WEIGHTS_MISSING", competencyId: COMP },
};

// Stored out of screen order on purpose: labels follow orderIndex, not array order.
const CONTENT = content([
  stage("s2", [activity("a2", { orderIndex: 1 }), activity("a1", { orderIndex: 0 })], { orderIndex: 1 }),
  stage("s1", [activity("a0")], { orderIndex: 0 }),
]);
const FACTS = new Map([[COMP, facts(COMP, { name: { tr: "İletişim", en: "Communication" } })]]);

const describe_ = (problem: PublishProblem, locale: Locale) =>
  describeProblem(problem, { content: CONTENT, facts: FACTS, locale, openingId: OPENING }, managerT(locale));

describe("describeProblem", () => {
  it("the samples cover every code of the readiness groups", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...STRUCTURE_PROBLEMS, ...ANCHOR_PROBLEMS, ...WEIGHT_PROBLEMS].sort());
  });

  it.each(["tr", "en"] as const)("gives every code a sentence in %s, never a raw key or a placeholder", (locale) => {
    for (const problem of Object.values(SAMPLES)) {
      const { text } = describe_(problem, locale);
      expect(text.trim(), problem.code).not.toBe("");
      expect(text, problem.code).not.toMatch(/hiringGate|[{}]/);
      expect(text, problem.code).not.toContain("\u2014");
    }
  });

  it("names stages and questions by their place on screen", () => {
    expect(describe_(SAMPLES.EMPTY_STAGE, "tr").text).toBe("Aşama 2 boş; en az bir soru ekle.");
    expect(describe_(SAMPLES.EMPTY_PROMPT, "en").text).toBe("Stage 2, question 2: the question text is empty.");
  });

  it("names competencies in the viewer's language", () => {
    expect(describe_(SAMPLES.ANCHOR_MISSING, "tr").text).toBe("Puan kartında İletişim için 3. seviye çapası eksik.");
    expect(describe_(SAMPLES.WEIGHTS_MISSING, "tr").text).toBe("İletişim için ağırlık girilmemiş; ağırlıkların toplamı %100 olmalı.");
    expect(describe_(SAMPLES.WEIGHTS_MISSING, "en").text).toBe("Communication has no weight; the weights must add up to 100%.");
    expect(describe_(SAMPLES.WEIGHTS_NOT_100, "en").text).toBe("Weights add up to 80%; they must add up to 100%.");
  });

  // Ruling C7: a link only to a page that exists. The builder (Task 15) and the
  // scorecard (Task 16) are not built yet, so those problems carry no link; a
  // missing anchor is fixed on the library competency page, which exists.
  it("links only to pages that exist", () => {
    for (const problem of Object.values(SAMPLES)) {
      const { href } = describe_(problem, "tr");
      if (problem.code === "ANCHOR_MISSING") expect(href).toBe(`/library/competencies/${COMP}`);
      else expect(href, problem.code).toBeNull();
    }
  });
});
