import { describe, expect, it } from "vitest";
import { publishProblems } from "@/solutions/hiring/rules/gate";
import { activity, content, stage } from "@/solutions/hiring/rules/test-fixtures";
import { readinessRows } from "./readiness";

const COMP = "77777777-7777-4777-8777-777777777777";
const measured = content([stage("s1", [activity("a1", { competencyIds: [COMP] })])]);
const choiceOnly = content([
  stage("s1", [
    activity("a1", {
      type: "SINGLE_CHOICE",
      config: { choices: [{ id: "x", label: { tr: "Evet", en: "" }, correct: true }, { id: "y", label: { tr: "Hayır", en: "" }, correct: false }] },
    }),
  ]),
]);
const base = { memberCount: 0, previewed: false };

describe("readinessRows", () => {
  it("lists assessment, anchors, team and preview in screen order; weights only with weighting on", () => {
    expect(readinessRows({ ...base, problems: [], content: measured }).map((r) => r.key)).toEqual(["assessment", "anchors", "team", "preview"]);
    const weighted = { ...measured, weightsEnabled: true };
    expect(readinessRows({ ...base, problems: [], content: weighted }).map((r) => r.key)).toEqual(["assessment", "anchors", "weights", "team", "preview"]);
  });

  it("shows the weights row whenever the gate names a weights problem", () => {
    const rows = readinessRows({ ...base, problems: [{ code: "WEIGHTS_NOT_100", total: 90 }], content: measured });
    expect(rows.find((r) => r.key === "weights")).toEqual({ key: "weights", state: "missing", problem: { code: "WEIGHTS_NOT_100", total: 90 }, reason: null });
  });

  it("an empty draft: assessment missing with its first problem, anchors missing because nothing is measured yet", () => {
    const rows = readinessRows({ ...base, problems: [{ code: "NO_STAGE" }], content: content([]) });
    expect(rows[0]).toEqual({ key: "assessment", state: "missing", problem: { code: "NO_STAGE" }, reason: null });
    expect(rows[1]).toEqual({ key: "anchors", state: "missing", problem: null, reason: "NO_COMPETENCIES" });
  });

  it("a choice-only draft: the gate refuses it with NO_MEASURED_COMPETENCY and the anchors row says so", () => {
    const problems = publishProblems(choiceOnly, new Map());
    expect(problems).toEqual([{ code: "NO_MEASURED_COMPETENCY" }]);
    expect(readinessRows({ ...base, problems, content: choiceOnly })[1]).toEqual({
      key: "anchors",
      state: "missing",
      problem: { code: "NO_MEASURED_COMPETENCY" },
      reason: null,
    });
  });

  it("anchors are done when every measured competency is complete, missing with the first anchor problem otherwise", () => {
    expect(readinessRows({ ...base, problems: [], content: measured })[1]).toMatchObject({ key: "anchors", state: "done" });
    const problem = { code: "ANCHOR_MISSING" as const, competencyId: COMP, level: 3 };
    expect(readinessRows({ ...base, problems: [problem], content: measured })[1]).toEqual({ key: "anchors", state: "missing", problem, reason: null });
  });

  it("team and preview are advisory until done", () => {
    const open = readinessRows({ ...base, problems: [], content: measured });
    expect(open.slice(-2).map((r) => [r.key, r.state])).toEqual([
      ["team", "advisory"],
      ["preview", "advisory"],
    ]);
    const done = readinessRows({ memberCount: 2, previewed: true, problems: [], content: measured });
    expect(done.slice(-2).map((r) => r.state)).toEqual(["done", "done"]);
  });
});
