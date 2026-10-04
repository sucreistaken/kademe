import { describe, expect, it } from "vitest";
import { publishProblems } from "@/solutions/hiring/rules/gate";
import { activity, content, stage } from "@/solutions/hiring/rules/test-fixtures";
import { readinessRows, rowAction, rowHref } from "./readiness";

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
const base = { memberCount: 0, previewed: false, decisionMakerActive: true };

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

  // Fix round 1, Minor 3: reviewers alone are not a team; someone active must be able to decide.
  it("keeps the team row advisory, saying why, while there is no active decision maker", () => {
    const rows = readinessRows({ memberCount: 2, previewed: false, decisionMakerActive: false, problems: [], content: measured });
    expect(rows.find((r) => r.key === "team")).toEqual({ key: "team", state: "advisory", problem: null, reason: "NO_DECISION_MAKER" });
  });

  it("team and preview are advisory until done", () => {
    const open = readinessRows({ ...base, problems: [], content: measured });
    expect(open.slice(-2).map((r) => [r.key, r.state])).toEqual([
      ["team", "advisory"],
      ["preview", "advisory"],
    ]);
    const done = readinessRows({ memberCount: 2, previewed: true, decisionMakerActive: true, problems: [], content: measured });
    expect(done.slice(-2).map((r) => r.state)).toEqual(["done", "done"]);
  });
});

describe("rowHref and rowAction (ruling C7: a link only to a page that exists)", () => {
  const OPENING = "33333333-3333-4333-8333-333333333333";
  const base = `/hiring/openings/${OPENING}`;
  const rowsOf = (memberCount: number) => readinessRows({ memberCount, previewed: false, decisionMakerActive: true, problems: [], content: measured });

  it("sends the team row to team and rules (Task 20), worded as 'Ekibi ata'", () => {
    const team = rowsOf(0).find((r) => r.key === "team")!;
    expect(rowHref(team, null, OPENING)).toBe(`${base}/settings`);
    expect(rowAction(`${base}/settings`)).toBe("goTeam");
  });

  it("keeps the other targets: the gate's own fix, the builder when nothing is measured, the preview", () => {
    const empty = readinessRows({ memberCount: 0, previewed: false, decisionMakerActive: true, problems: [], content: content([]) });
    expect(rowHref(empty.find((r) => r.key === "anchors")!, null, OPENING)).toBe(`${base}/assessment/edit`);
    expect(rowHref(rowsOf(0).find((r) => r.key === "preview")!, null, OPENING)).toBe(`${base}/assessment/preview`);
    expect(rowHref(rowsOf(0).find((r) => r.key === "assessment")!, `${base}/assessment/scorecard`, OPENING)).toBe(`${base}/assessment/scorecard`);
    expect(rowAction(`${base}/assessment/edit`)).toBe("goBuilder");
    expect(rowAction(`${base}/assessment/scorecard`)).toBe("goScorecard");
    expect(rowAction(`${base}/assessment/preview`)).toBe("goPreview");
    expect(rowAction("/library/competencies/x")).toBe("goLibrary");
  });
});
