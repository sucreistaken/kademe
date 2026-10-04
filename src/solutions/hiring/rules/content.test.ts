import { describe, expect, it } from "vitest";
import { hiringActivityType, hiringStageTimeout } from "@/db/schema/enums";
import { ACTIVITY_TYPES, totalSeconds, usedCompetencyIds, type StageTimeout } from "./content";
import { activity, stage } from "./test-fixtures";

describe("hiring content", () => {
  it("knows exactly the database's activity types", () => {
    expect([...ACTIVITY_TYPES]).toEqual([...hiringActivityType.enumValues]);
  });

  it("knows exactly the database's stage timeout behaviours", () => {
    const known: Record<StageTimeout, true> = { AUTO_SUBMIT: true, AUTO_CLOSE: true, ALLOW_GRACE: true, ALLOW_LATE: true };
    expect(Object.keys(known).sort()).toEqual([...hiringStageTimeout.enumValues].sort());
  });

  it("lists measured competencies in first-appearance order and ignores choice questions", () => {
    const stages = [
      stage("s1", [activity("a1", { competencyIds: ["c2"] }), activity("q", { type: "MULTI_CHOICE", competencyIds: ["c9"] })]),
      stage("s2", [activity("a2", { competencyIds: ["c1", "c2"] })]),
    ];
    expect(usedCompetencyIds({ stages })).toEqual(["c2", "c1"]);
  });

  it("adds up the stage durations", () => {
    expect(totalSeconds({ stages: [stage("s1", [], { durationSeconds: 600 }), stage("s2", [], { durationSeconds: 300 })] })).toBe(900);
  });
});
