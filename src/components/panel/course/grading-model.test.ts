import { describe, expect, it } from "vitest";
import { COMMON_WRITING_ERRORS, SPEAKING_CRITERIA, WRITING_CRITERIA, type CourseRubricProposal } from "@/lib/exam/course/types";
import {
  COMMON_ERROR_IDS,
  confirmCoursePoints,
  criteriaOf,
  editorAction,
  needsReason,
  pointsField,
  pointsTotal,
  proposalPoints,
  readCommonErrors,
  readCoursePoints,
  reasonOk,
  rubricMax,
  samePoints,
  sameErrors,
  startingErrors,
  startingPoints,
  wholePoints,
  type EditorState,
} from "./grading-model";

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const one of Array.isArray(v) ? v : [v]) data.append(k, one);
  return data;
};

const writing = (points: [number, number, number], commonErrors: CourseRubricProposal["commonErrors"] = []): CourseRubricProposal => ({
  kind: "COURSE_RUBRIC",
  section: "WRITING",
  criteria: WRITING_CRITERIA.map((id, i) => ({ id, points: points[i], max: 3, rationale: "ok" })),
  commonErrors,
  advice: "Nebensätze üben.",
});

const speaking = (points: Array<number | null>): CourseRubricProposal => ({
  kind: "COURSE_RUBRIC",
  section: "SPEAKING",
  criteria: SPEAKING_CRITERIA.map((id, i) => ({ id, points: points[i], max: 4, rationale: "ok" })),
  advice: "Mehr Verbindungswörter.",
});

describe("the rubric of each section", () => {
  it("is three criteria to 3 for writing and five to 4 for one speaking task", () => {
    expect(criteriaOf("WRITING")).toEqual(["INHALT", "WORTSCHATZ", "GRAMMATIK"]);
    expect(criteriaOf("SPEAKING")).toEqual(["KOMMUNIKATION", "WORTSCHATZ", "GRAMMATIK", "AUSSPRACHE", "KOHAERENZ"]);
    expect(rubricMax("WRITING")).toBe(9);
    expect(rubricMax("SPEAKING")).toBe(20);
  });
});

describe("wholePoints", () => {
  it("reads a whole number from 0 to the maximum", () => {
    expect(wholePoints("0", 3)).toBe(0);
    expect(wholePoints("3", 3)).toBe(3);
    expect(wholePoints("4", 4)).toBe(4);
  });

  it("refuses everything else: no half points, no negatives, nothing above the maximum, no text", () => {
    for (const raw of ["4", "2.5", "2,5", "-1", "", " 2", "1e1", "abc", "03x", "100"]) expect(wholePoints(raw, 3), raw).toBeNull();
    expect(wholePoints(null, 3)).toBeNull();
    expect(wholePoints(new File([], "x"), 3)).toBeNull();
  });
});

describe("readCoursePoints (set course points)", () => {
  it("reads every criterion of a writing grading", () => {
    expect(readCoursePoints("WRITING", form({ "points.INHALT": "3", "points.WORTSCHATZ": "2", "points.GRAMMATIK": "0" }))).toEqual({
      ok: true,
      points: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 0 },
    });
  });

  it("reads the five criteria of a speaking task, each to 4", () => {
    const fields = Object.fromEntries(SPEAKING_CRITERIA.map((c, i) => [pointsField(c), String(i)]));
    expect(readCoursePoints("SPEAKING", form(fields))).toEqual({ ok: true, points: { KOMMUNIKATION: 0, WORTSCHATZ: 1, GRAMMATIK: 2, AUSSPRACHE: 3, KOHAERENZ: 4 } });
  });

  it("refuses a form with a criterion missing", () => {
    expect(readCoursePoints("WRITING", form({ "points.INHALT": "3", "points.WORTSCHATZ": "2" }))).toEqual({ ok: false, code: "MISSING" });
    expect(readCoursePoints("WRITING", form({ "points.INHALT": "3", "points.WORTSCHATZ": "2", "points.GRAMMATIK": "" }))).toEqual({ ok: false, code: "MISSING" });
  });

  it("refuses points above the criterion's maximum (a writing criterion stops at 3) and half points", () => {
    expect(readCoursePoints("WRITING", form({ "points.INHALT": "4", "points.WORTSCHATZ": "2", "points.GRAMMATIK": "1" }))).toEqual({ ok: false, code: "RANGE" });
    expect(readCoursePoints("WRITING", form({ "points.INHALT": "2.5", "points.WORTSCHATZ": "2", "points.GRAMMATIK": "1" }))).toEqual({ ok: false, code: "RANGE" });
    expect(readCoursePoints("WRITING", form({ "points.INHALT": "-1", "points.WORTSCHATZ": "2", "points.GRAMMATIK": "1" }))).toEqual({ ok: false, code: "RANGE" });
  });

  it("refuses a criterion the section does not have", () => {
    expect(readCoursePoints("WRITING", form({ "points.INHALT": "3", "points.WORTSCHATZ": "2", "points.GRAMMATIK": "1", "points.AUSSPRACHE": "2" }))).toEqual({ ok: false, code: "UNKNOWN_CRITERION" });
    expect(readCoursePoints("WRITING", form({ "points.INHALT": "3", "points.WORTSCHATZ": "2", "points.GRAMMATIK": "1", "points.NONSENSE": "1" }))).toEqual({ ok: false, code: "UNKNOWN_CRITERION" });
    const speakingFields = Object.fromEntries(SPEAKING_CRITERIA.map((c) => [pointsField(c), "2"]));
    expect(readCoursePoints("SPEAKING", form({ ...speakingFields, "points.INHALT": "2" }))).toEqual({ ok: false, code: "UNKNOWN_CRITERION" });
  });
});

describe("readCommonErrors (the ticked Häufigste Fehler)", () => {
  it("reads known ids once each, in the sheet's order", () => {
    const r = readCommonErrors(form({ commonErrors: ["SPELLING", "POINTS_MISSING", "SPELLING"] }));
    expect(r).toEqual({ ok: true, errors: ["POINTS_MISSING", "SPELLING"] });
  });

  it("is an empty list when nothing is ticked", () => {
    expect(readCommonErrors(form({}))).toEqual({ ok: true, errors: [] });
  });

  it("refuses an id the sheet does not have", () => {
    expect(readCommonErrors(form({ commonErrors: ["POINTS_MISSING", "MADE_UP"] }))).toEqual({ ok: false });
    expect(readCommonErrors(form({ commonErrors: ["toString"] }))).toEqual({ ok: false });
  });

  it("knows all sixteen boxes of the sheet", () => {
    expect(COMMON_ERROR_IDS).toHaveLength(16);
    expect(COMMON_ERROR_IDS).toEqual(Object.keys(COMMON_WRITING_ERRORS));
  });
});

describe("proposalPoints", () => {
  it("takes the AI's points per criterion", () => {
    expect(proposalPoints(writing([3, 2, 1]), "WRITING")).toEqual({ points: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 }, open: [] });
  });

  it("leaves a criterion open when the AI could not judge it (AUSSPRACHE from a transcript)", () => {
    const r = proposalPoints(speaking([3, 3, 2, null, 3]), "SPEAKING");
    expect(r.open).toEqual(["AUSSPRACHE"]);
    expect(r.points).toEqual({ KOMMUNIKATION: 3, WORTSCHATZ: 3, GRAMMATIK: 2, KOHAERENZ: 3 });
  });

  it("leaves a criterion open when the proposal is out of range, fractional or missing, and everything open without a proposal", () => {
    expect(proposalPoints(writing([5, 2, 1]), "WRITING").open).toEqual(["INHALT"]);
    expect(proposalPoints(writing([2.5, 2, 1]), "WRITING").open).toEqual(["INHALT"]);
    expect(proposalPoints({ ...writing([3, 2, 1]), criteria: [] }, "WRITING").open).toEqual(["INHALT", "WORTSCHATZ", "GRAMMATIK"]);
    expect(proposalPoints(null, "WRITING").open).toEqual(["INHALT", "WORTSCHATZ", "GRAMMATIK"]);
  });
});

describe("confirmCoursePoints (confirm a course grading)", () => {
  it("copies the proposal when the form sends nothing", () => {
    expect(confirmCoursePoints("WRITING", writing([3, 2, 1]), form({}))).toEqual({ ok: true, points: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 }, filled: [] });
  });

  it("accepts a form that repeats the proposal's own points", () => {
    expect(confirmCoursePoints("WRITING", writing([3, 2, 1]), form({ "points.INHALT": "3", "points.WORTSCHATZ": "2", "points.GRAMMATIK": "1" }))).toMatchObject({ ok: true });
  });

  it("refuses a form that changes a point the AI judged: that is a change, with a reason", () => {
    expect(confirmCoursePoints("WRITING", writing([3, 2, 1]), form({ "points.INHALT": "2" }))).toEqual({ ok: false, code: "CHANGED" });
  });

  it("needs the teacher's value for a criterion the AI left open, and takes it", () => {
    const proposal = speaking([3, 3, 2, null, 3]);
    expect(confirmCoursePoints("SPEAKING", proposal, form({}))).toEqual({ ok: false, code: "OPEN" });
    expect(confirmCoursePoints("SPEAKING", proposal, form({ "points.AUSSPRACHE": "5" }))).toEqual({ ok: false, code: "OPEN" });
    expect(confirmCoursePoints("SPEAKING", proposal, form({ "points.AUSSPRACHE": "3" }))).toEqual({
      ok: true,
      points: { KOMMUNIKATION: 3, WORTSCHATZ: 3, GRAMMATIK: 2, AUSSPRACHE: 3, KOHAERENZ: 3 },
      filled: ["AUSSPRACHE"],
    });
  });

  it("has nothing to confirm without a proposal", () => {
    expect(confirmCoursePoints("WRITING", null, form({}))).toEqual({ ok: false, code: "OPEN" });
  });
});

describe("totals and comparisons", () => {
  it("adds the points", () => {
    expect(pointsTotal({ INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 })).toBe(6);
    expect(pointsTotal({})).toBe(0);
    expect(pointsTotal(null)).toBe(0);
  });

  it("compares point sets and error sets without regard to order", () => {
    expect(samePoints("WRITING", { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 }, { GRAMMATIK: 1, WORTSCHATZ: 2, INHALT: 3 })).toBe(true);
    expect(samePoints("WRITING", { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 }, { INHALT: 3, WORTSCHATZ: 2 })).toBe(false);
    expect(sameErrors(["SPELLING", "CASE"], ["CASE", "SPELLING"])).toBe(true);
    expect(sameErrors(["CASE"], [])).toBe(false);
    expect(sameErrors(null, [])).toBe(true);
  });

  it("wants a reason of three characters", () => {
    expect(reasonOk("ab")).toBe(false);
    expect(reasonOk("  a  ")).toBe(false);
    expect(reasonOk("abc")).toBe(true);
  });
});

describe("editorAction: which action the one button takes", () => {
  const base = (over: Partial<EditorState>): EditorState => ({
    section: "WRITING",
    status: "AI_PROPOSED",
    proposal: writing([3, 2, 1], ["SPELLING"]),
    decided: null,
    picks: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 },
    ticks: ["SPELLING"],
    reason: "",
    ...over,
  });

  it("confirms when the pickers still hold the AI's points, with no reason", () => {
    expect(editorAction(base({}))).toEqual({ kind: "confirm" });
    expect(needsReason(base({}))).toBe(false);
  });

  it("still confirms when only the ticked boxes differ from the AI's", () => {
    expect(editorAction(base({ ticks: ["SPELLING", "CASE"] }))).toEqual({ kind: "confirm" });
  });

  it("changes, and asks for a reason, when a judged criterion differs", () => {
    const state = base({ picks: { INHALT: 2, WORTSCHATZ: 2, GRAMMATIK: 1 } });
    expect(needsReason(state)).toBe(true);
    expect(editorAction(state)).toEqual({ kind: "none", why: "REASON" });
    expect(editorAction({ ...state, reason: "Leitpunkt 2 fehlt" })).toEqual({ kind: "change" });
    expect(editorAction({ ...state, reason: "ja" })).toEqual({ kind: "none", why: "REASON" });
  });

  it("waits for a pick on every criterion", () => {
    expect(editorAction(base({ picks: { INHALT: 3, WORTSCHATZ: 2 } }))).toEqual({ kind: "none", why: "INCOMPLETE" });
  });

  it("confirms a speaking task once the teacher has filled in the criterion the AI left open", () => {
    const state: EditorState = {
      section: "SPEAKING",
      status: "AI_PROPOSED",
      proposal: speaking([3, 3, 2, null, 3]),
      decided: null,
      picks: { KOMMUNIKATION: 3, WORTSCHATZ: 3, GRAMMATIK: 2, KOHAERENZ: 3 },
      ticks: [],
      reason: "",
    };
    expect(editorAction(state)).toEqual({ kind: "none", why: "INCOMPLETE" });
    expect(editorAction({ ...state, picks: { ...state.picks, AUSSPRACHE: 2 } })).toEqual({ kind: "confirm" });
    expect(needsReason({ ...state, picks: { ...state.picks, AUSSPRACHE: 2 } })).toBe(false);
  });

  it("grades from scratch, with a reason, when there is no proposal (still pending, or the AI failed)", () => {
    for (const status of ["PENDING", "AI_FAILED"] as const) {
      const state = base({ status, proposal: null, ticks: [], picks: { INHALT: 2, WORTSCHATZ: 2, GRAMMATIK: 2 } });
      expect(needsReason(state)).toBe(true);
      expect(editorAction(state)).toEqual({ kind: "none", why: "REASON" });
      expect(editorAction({ ...state, reason: "Text gelesen" })).toEqual({ kind: "change" });
    }
  });

  it("changes a decided grading with a reason, and saves ticked boxes alone without one", () => {
    const decided = { points: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 }, commonErrors: ["SPELLING" as const] };
    const state = base({ status: "CONFIRMED", decided });
    expect(editorAction(state)).toEqual({ kind: "none", why: "NO_CHANGE" });
    expect(editorAction({ ...state, ticks: ["SPELLING", "CASE"] })).toEqual({ kind: "errors" });
    const moved = { ...state, picks: { INHALT: 3, WORTSCHATZ: 3, GRAMMATIK: 1 } };
    expect(editorAction(moved)).toEqual({ kind: "none", why: "REASON" });
    expect(editorAction({ ...moved, reason: "besser als gedacht" })).toEqual({ kind: "change" });
    expect(needsReason(moved)).toBe(true);
    expect(needsReason(state)).toBe(false);
  });

  it("starts from the decided points and boxes, else the AI's", () => {
    const decided = { points: { INHALT: 1, WORTSCHATZ: 1, GRAMMATIK: 1 }, commonErrors: ["CASE" as const] };
    expect(startingPoints({ section: "WRITING", decided, proposal: writing([3, 2, 1]) })).toEqual(decided.points);
    expect(startingErrors({ section: "WRITING", decided, proposal: writing([3, 2, 1], ["SPELLING"]) })).toEqual(["CASE"]);
    expect(startingPoints({ section: "WRITING", decided: null, proposal: writing([3, 2, 1]) })).toEqual({ INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 });
    expect(startingErrors({ section: "WRITING", decided: null, proposal: writing([3, 2, 1], ["SPELLING"]) })).toEqual(["SPELLING"]);
    expect(startingErrors({ section: "SPEAKING", decided: null, proposal: speaking([1, 1, 1, 1, 1]) })).toEqual([]);
  });
});
