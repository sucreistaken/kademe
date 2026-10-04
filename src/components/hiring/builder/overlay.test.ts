import { describe, expect, it } from "vitest";
import { activity, stage } from "@/solutions/hiring/rules/test-fixtures";
import { withUnsaved } from "./overlay";

/** A reload shows what was typed before the server has it (carry 7). */
describe("withUnsaved", () => {
  const stages = [stage("s1", [activity("a1"), activity("a2")])];

  it("lays unsaved values over the loaded stages and questions", () => {
    const shown = withUnsaved(stages, [
      { target: { kind: "stage", id: "s1" }, field: "name", value: { tr: "Yazılan", en: "" } },
      { target: { kind: "activity", id: "a2" }, field: "note", value: { tr: "Not", en: "" } },
      { target: { kind: "competencies", id: "a1" }, field: "ids", value: ["c1"] },
    ]);
    expect(shown[0].name).toEqual({ tr: "Yazılan", en: "" });
    expect(shown[0].activities[1].note).toEqual({ tr: "Not", en: "" });
    expect(shown[0].activities[0].competencyIds).toEqual(["c1"]);
    expect(stages[0].activities[1].note).toEqual(activity("a2").note);
  });

  it("ignores values for items that are gone and fields that do not exist", () => {
    const shown = withUnsaved(stages, [
      { target: { kind: "activity", id: "gone" }, field: "note", value: { tr: "x", en: "" } },
      { target: { kind: "activity", id: "a1" }, field: "id", value: "evil" },
      { target: { kind: "activity", id: "a1" }, field: "__proto__", value: { polluted: true } },
    ]);
    expect(shown[0].activities[0].id).toBe("a1");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("returns the loaded stages untouched when nothing is unsaved", () => {
    expect(withUnsaved(stages, [])).toBe(stages);
  });
});
