import { describe, expect, it } from "vitest";
import { candidateSafe, INTERNAL_FIELDS } from "@/lib/candidate-safe";
import { activity, content, stage } from "./test-fixtures";

/**
 * candidateSafe is the last line of defence on every candidate response. The
 * hiring builder's team-only fields must be on its list too, so a hiring
 * query that forgets toCandidateVersion still cannot ship them.
 */
const TEAM_ONLY = [
  "internalQuestion",
  "expectedBehaviours",
  "redFlags",
  "managerNotes",
  "answerExamples",
  "internalPurpose",
  "competencyIds",
  "scorecard",
  "draftWeights",
  "weights",
  "anchors",
] as const;

const full = activity("a1", {
  type: "SINGLE_CHOICE",
  prompt: { tr: "VISIBLE_PROMPT", en: "" },
  internalQuestion: "TEAMSECRET_internal_question",
  expectedBehaviours: ["TEAMSECRET_behaviour"],
  redFlags: ["TEAMSECRET_red_flag"],
  managerNotes: "TEAMSECRET_manager_notes",
  answerExamples: { 1: "TEAMSECRET_example" },
  competencyIds: ["TEAMSECRET_competency"],
  config: { choices: [{ id: "c1", label: { tr: "VISIBLE_CHOICE", en: "" }, correct: true }] },
});
const fullStage = stage("s1", [full], { internalPurpose: "TEAMSECRET_purpose", name: { tr: "VISIBLE_STAGE", en: "" } });

describe("candidateSafe and hiring content", () => {
  it("lists every hiring team-only field name", () => {
    expect(INTERNAL_FIELDS).toEqual(expect.arrayContaining([...TEAM_ONLY]));
  });

  it("a full activity and stage lose every team-only field and keep what the candidate sees", () => {
    const version = {
      ...content([fullStage], { weightsEnabled: true, draftWeights: { c1: 100 } }),
      scorecard: { competencies: [{ anchors: { 3: "TEAMSECRET_anchor" } }] },
      weights: { c1: 100 },
    };
    const safe = candidateSafe(version);
    const json = JSON.stringify(safe);
    expect(json).not.toContain("TEAMSECRET");
    for (const key of TEAM_ONLY) expect(json).not.toContain(`"${key}"`);
    expect(json).not.toContain('"correct"');
    expect(json).toContain("VISIBLE_PROMPT");
    expect(json).toContain("VISIBLE_STAGE");
    expect(json).toContain("VISIBLE_CHOICE");
  });
});

describe("candidateSafe and hiring scoring", () => {
  it("strips a choice question's automatic score in either spelling (decision 10: never shown to the candidate)", () => {
    expect(INTERNAL_FIELDS).toEqual(expect.arrayContaining(["autoScore", "auto_score"]));
    const row = { id: "r1", payload: { choiceIds: ["c1"] }, autoScore: 1, nested: [{ auto_score: 0, answeredAt: "VISIBLE" }] };
    expect(candidateSafe(row)).toEqual({ id: "r1", payload: { choiceIds: ["c1"] }, nested: [{ answeredAt: "VISIBLE" }] });
  });
});
