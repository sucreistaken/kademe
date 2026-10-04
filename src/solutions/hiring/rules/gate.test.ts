import { PgDialect, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { hiringActivityCompetencies } from "@/db/schema";
import { MAX_COMPETENCIES_PER_ACTIVITY } from "./content";
import { ANCHOR_PROBLEMS, publishProblems, STRUCTURE_PROBLEMS, WEIGHT_PROBLEMS, type PublishProblem } from "./gate";
import { activity, content, facts, stage } from "./test-fixtures";

const two = () => new Map([["c1", facts("c1")], ["c2", facts("c2")]]);
const opt = (id: string, correct = false) => ({ id, label: { tr: id, en: "" }, correct });

describe("publish gate (hiring solution design 2.2, HIRING-UX R2)", () => {
  it("passes a complete draft", () => {
    expect(publishProblems(content([stage("s1", [activity("a1", { competencyIds: ["c1", "c2"] })])]), two())).toEqual([]);
  });

  it("needs at least one stage", () => {
    expect(publishProblems(content([]), two())).toEqual([{ code: "NO_STAGE" }]);
  });

  it("needs a named stage with at least one question", () => {
    expect(publishProblems(content([stage("s1", [], { name: { tr: " ", en: "" } })]), two())).toEqual([
      { code: "EMPTY_STAGE_NAME", stageId: "s1" },
      { code: "EMPTY_STAGE", stageId: "s1" },
    ]);
  });

  it("needs the question's text", () => {
    const draft = content([stage("s1", [activity("a1", { prompt: { tr: "", en: " " }, competencyIds: ["c1"] })])]);
    expect(publishProblems(draft, two())).toEqual([{ code: "EMPTY_PROMPT", activityId: "a1" }]);
  });

  it("needs one or two competencies on every question that is not a choice", () => {
    const draft = content([stage("s1", [activity("a1"), activity("a2", { competencyIds: ["c1", "c2", "c3"] })])]);
    expect(publishProblems(draft, new Map([...two(), ["c3", facts("c3")]]))).toEqual([
      { code: "NO_COMPETENCY", activityId: "a1" },
      { code: "TOO_MANY_COMPETENCIES", activityId: "a2" },
    ]);
  });

  it("agrees with the database: at most two competencies per question (hiring_at_most_two_competencies)", () => {
    const check = getTableConfig(hiringActivityCompetencies).checks.find((c) => c.name === "hiring_at_most_two_competencies");
    expect(check).toBeDefined();
    const sql = new PgDialect().sqlToQuery(check!.value).sql;
    // order_index may only be 0 or 1, so a third competency cannot be stored.
    expect(sql).toMatch(/in \(0, 1\)/i);
    expect(MAX_COMPETENCIES_PER_ACTIVITY).toBe(2);
    const stages = (ids: string[]) => content([stage("s1", [activity("a1", { competencyIds: ids })])]);
    const library = new Map([...two(), ["c3", facts("c3")]]);
    expect(publishProblems(stages(["c1", "c2"]), library)).toEqual([]);
    expect(publishProblems(stages(["c1", "c2", "c3"]), library)).toEqual([{ code: "TOO_MANY_COMPETENCIES", activityId: "a1" }]);
  });

  it("keeps choice questions out of competencies and needs options and a right answer", () => {
    const choice = (id: string, type: "SINGLE_CHOICE" | "MULTI_CHOICE", choices: ReturnType<typeof opt>[], competencyIds: string[] = []) =>
      activity(id, { type, config: { choices }, competencyIds });
    const draft = content([
      stage(
        "s1",
        [
          choice("single-none", "SINGLE_CHOICE", [opt("a"), opt("b")]),
          choice("single-two", "SINGLE_CHOICE", [opt("a", true), opt("b", true)]),
          choice("multi-none", "MULTI_CHOICE", [opt("a"), opt("b"), opt("c")]),
          choice("one-option", "SINGLE_CHOICE", [opt("a", true)]),
          choice("with-competency", "SINGLE_CHOICE", [opt("a", true), opt("b")], ["c1"]),
          choice("fine", "MULTI_CHOICE", [opt("a", true), opt("b", true), opt("c")]),
        ].map((a, i) => ({ ...a, orderIndex: i })),
      ),
    ]);
    expect(publishProblems(draft, two())).toEqual([
      { code: "CHOICE_NEEDS_ANSWER", activityId: "single-none" },
      { code: "CHOICE_NEEDS_ANSWER", activityId: "single-two" },
      { code: "CHOICE_NEEDS_ANSWER", activityId: "multi-none" },
      { code: "CHOICE_NEEDS_OPTIONS", activityId: "one-option" },
      { code: "CHOICE_WITH_COMPETENCY", activityId: "with-competency" },
    ]);
  });

  it("needs anchors 1, 3 and 5 of every measured competency", () => {
    const draft = content([stage("s1", [activity("a1", { competencyIds: ["c1"] })])]);
    const thin = new Map([["c1", facts("c1", { anchors: { 1: { tr: "x", en: "" }, 3: { tr: " ", en: "" } } })]]);
    expect(publishProblems(draft, thin)).toEqual([
      { code: "ANCHOR_MISSING", competencyId: "c1", level: 3 },
      { code: "ANCHOR_MISSING", competencyId: "c1", level: 5 },
    ]);
  });

  it("refuses an archived or unknown competency", () => {
    const draft = content([stage("s1", [activity("a1", { competencyIds: ["c1", "gone"] })])]);
    expect(publishProblems(draft, new Map([["c1", facts("c1", { archived: true })]]))).toEqual([
      { code: "COMPETENCY_ARCHIVED", competencyId: "c1" },
      { code: "COMPETENCY_MISSING", competencyId: "gone" },
    ]);
  });

  it("checks weights only when weighting is on", () => {
    const stages = [stage("s1", [activity("a1", { competencyIds: ["c1", "c2"] })])];
    expect(publishProblems(content(stages, { weightsEnabled: false, draftWeights: { c1: 10 } }), two())).toEqual([]);
    expect(publishProblems(content(stages, { weightsEnabled: true, draftWeights: { c1: 60, c2: 35 } }), two())).toEqual([
      { code: "WEIGHTS_NOT_100", total: 95 },
    ]);
    expect(publishProblems(content(stages, { weightsEnabled: true, draftWeights: { c1: 60, c2: 40 } }), two())).toEqual([]);
  });

  it("refuses weights the database would refuse (hiring_weight_percentage is 0-100)", () => {
    const stages = [stage("s1", [activity("a1", { competencyIds: ["c1", "c2"] })])];
    // 120 + -20 adds up to 100, but neither is a storable percentage.
    expect(publishProblems(content(stages, { weightsEnabled: true, draftWeights: { c1: 120, c2: -20 } }), two())).toEqual([
      { code: "WEIGHTS_NOT_100", total: 100 },
    ]);
  });

  it("refuses a choice option with no text and two options sharing an id", () => {
    const blank = { id: "b", label: { tr: " ", en: "" }, correct: false };
    const draft = content([
      stage(
        "s1",
        [
          activity("blank", { type: "SINGLE_CHOICE", config: { choices: [opt("a", true), blank, opt("c")] } }),
          activity("dup", { type: "MULTI_CHOICE", config: { choices: [opt("a", true), opt("a"), opt("c")] } }),
          activity("en-only", { type: "SINGLE_CHOICE", config: { choices: [{ id: "x", label: { tr: "", en: "Yes" }, correct: true }, opt("y")] } }),
        ].map((a, i) => ({ ...a, orderIndex: i })),
      ),
    ]);
    expect(publishProblems(draft, two())).toEqual([
      { code: "CHOICE_NEEDS_OPTIONS", activityId: "blank" },
      { code: "CHOICE_NEEDS_OPTIONS", activityId: "dup" },
    ]);
  });

  it("names a measured competency that has no weight (weights saved, then a competency added)", () => {
    const library = new Map([...two(), ["c3", facts("c3")]]);
    const stages = [stage("s1", [activity("a1", { competencyIds: ["c1", "c2"] }), activity("a2", { orderIndex: 1, competencyIds: ["c3"] })])];
    // 60 + 40 = 100 over the saved competencies, but c3 would be published at 0%.
    expect(publishProblems(content(stages, { weightsEnabled: true, draftWeights: { c1: 60, c2: 40 } }), library)).toEqual([
      { code: "WEIGHTS_MISSING", competencyId: "c3" },
    ]);
    expect(publishProblems(content(stages, { weightsEnabled: true, draftWeights: { c1: 50, c2: 30, c3: 20 } }), library)).toEqual([]);
    expect(publishProblems(content(stages, { weightsEnabled: true, draftWeights: null }), library)).toEqual([
      { code: "WEIGHTS_MISSING", competencyId: "c1" },
      { code: "WEIGHTS_MISSING", competencyId: "c2" },
      { code: "WEIGHTS_MISSING", competencyId: "c3" },
    ]);
    expect(publishProblems(content(stages, { weightsEnabled: false, draftWeights: { c1: 60, c2: 40 } }), library)).toEqual([]);
  });

  it("splits its problem codes into the three readiness groups, each code exactly once", () => {
    const all: Record<PublishProblem["code"], true> = {
      NO_STAGE: true,
      EMPTY_STAGE_NAME: true,
      EMPTY_STAGE: true,
      EMPTY_PROMPT: true,
      NO_COMPETENCY: true,
      TOO_MANY_COMPETENCIES: true,
      CHOICE_WITH_COMPETENCY: true,
      CHOICE_NEEDS_OPTIONS: true,
      CHOICE_NEEDS_ANSWER: true,
      COMPETENCY_MISSING: true,
      COMPETENCY_ARCHIVED: true,
      ANCHOR_MISSING: true,
      WEIGHTS_NOT_100: true,
      WEIGHTS_MISSING: true,
    };
    const grouped = [...STRUCTURE_PROBLEMS, ...ANCHOR_PROBLEMS, ...WEIGHT_PROBLEMS];
    expect([...grouped].sort()).toEqual(Object.keys(all).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...WEIGHT_PROBLEMS].sort()).toEqual(["WEIGHTS_MISSING", "WEIGHTS_NOT_100"]);
  });

  it("judges stages and questions by their order, not by the order they were loaded in", () => {
    const stages = [
      stage("s2", [activity("late", { orderIndex: 1 }), activity("early", { orderIndex: 0 })], { orderIndex: 1 }),
      stage("s1", [], { orderIndex: 0 }),
    ];
    const draft = content(stages);
    const reversed = content([...stages].reverse().map((s) => ({ ...s, activities: [...s.activities].reverse() })));
    const expected = [
      { code: "EMPTY_STAGE", stageId: "s1" },
      { code: "NO_COMPETENCY", activityId: "early" },
      { code: "NO_COMPETENCY", activityId: "late" },
    ];
    expect(publishProblems(draft, two())).toEqual(expected);
    expect(publishProblems(reversed, two())).toEqual(expected);
  });
});
