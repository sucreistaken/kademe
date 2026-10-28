import { describe, expect, it } from "vitest";
import {
  COURSE_OUTCOME_OVERRIDE_KEY,
  confirmablePoints,
  courseOutcomeOverride,
  courseOutcomeOverrideEntry,
  effectiveCourseOutcome,
  parseCoursePoints,
  proposalPoints,
  resolveCourseTask,
  taskTotal,
  type CourseGradingView,
} from "./decisions";
import type { CourseRubricProposal } from "./types";

const writing = (points: Record<string, number | null>): CourseRubricProposal => ({
  kind: "COURSE_RUBRIC",
  section: "WRITING",
  criteria: Object.entries(points).map(([id, p]) => ({ id: id as never, points: p, max: 3, rationale: "x" })),
  advice: "x",
});
const speaking = (points: Record<string, number | null>): CourseRubricProposal => ({
  kind: "COURSE_RUBRIC",
  section: "SPEAKING",
  criteria: Object.entries(points).map(([id, p]) => ({ id: id as never, points: p, max: 4, rationale: "x" })),
  advice: "x",
});

const proposed = (p: CourseRubricProposal | null): CourseGradingView => ({ status: "AI_PROPOSED", courseProposal: p, coursePoints: null });

describe("resolveCourseTask", () => {
  it("takes the AI's points while nobody decided", () => {
    const r = resolveCourseTask("WRITING", proposed(writing({ INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 })));
    expect(r).toEqual({ points: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 }, complete: true, decided: false });
  });

  it("takes the teacher's points where he set them and the AI's for the rest", () => {
    const r = resolveCourseTask("WRITING", {
      status: "OVERRIDDEN",
      courseProposal: writing({ INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 }),
      coursePoints: { points: { INHALT: 1, GRAMMATIK: 0 } },
    });
    expect(r).toEqual({ points: { INHALT: 1, WORTSCHATZ: 2, GRAMMATIK: 0 }, complete: true, decided: true });
  });

  it("counts a confirmation without stored points as the proposal confirmed", () => {
    const r = resolveCourseTask("WRITING", { status: "CONFIRMED", courseProposal: writing({ INHALT: 2, WORTSCHATZ: 2, GRAMMATIK: 2 }), coursePoints: null });
    expect(r).toMatchObject({ complete: true, decided: true });
  });

  it("has nothing for a pending or failed grading, or for none at all", () => {
    for (const g of [{ status: "PENDING", courseProposal: null, coursePoints: null }, { status: "AI_FAILED", courseProposal: null, coursePoints: null }, null, undefined] as const) {
      const r = resolveCourseTask("SPEAKING", g);
      expect(r.complete).toBe(false);
      expect(r.decided).toBe(false);
      expect(Object.values(r.points)).toEqual([null, null, null, null, null]);
    }
  });

  it("ignores a proposal that a failed or pending row still carries", () => {
    const r = resolveCourseTask("WRITING", { status: "PENDING", courseProposal: writing({ INHALT: 3, WORTSCHATZ: 3, GRAMMATIK: 3 }), coursePoints: null });
    expect(r.complete).toBe(false);
  });

  it("is incomplete while AUSSPRACHE has no number, confirmed or not", () => {
    const p = speaking({ KOMMUNIKATION: 3, WORTSCHATZ: 3, GRAMMATIK: 2, AUSSPRACHE: null, KOHAERENZ: 3 });
    expect(resolveCourseTask("SPEAKING", proposed(p))).toMatchObject({ complete: false, decided: false });
    expect(resolveCourseTask("SPEAKING", { status: "CONFIRMED", courseProposal: p, coursePoints: null })).toMatchObject({ complete: false, decided: false });
    const set = resolveCourseTask("SPEAKING", { status: "OVERRIDDEN", courseProposal: p, coursePoints: { points: { AUSSPRACHE: 2 } } });
    expect(set).toMatchObject({ complete: true, decided: true });
    expect(set.points.AUSSPRACHE).toBe(2);
  });

  it("does not read points off a row the teacher has not decided", () => {
    const r = resolveCourseTask("WRITING", { status: "AI_PROPOSED", courseProposal: writing({ INHALT: 1, WORTSCHATZ: 1, GRAMMATIK: 1 }), coursePoints: { points: { INHALT: 3 } } });
    expect(r.points.INHALT).toBe(1);
  });
});

describe("taskTotal and proposalPoints", () => {
  it("adds the criteria of the section and is null while one is missing", () => {
    expect(taskTotal("WRITING", { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 })).toBe(6);
    expect(taskTotal("WRITING", { INHALT: 3, WORTSCHATZ: 2 })).toBeNull();
    expect(taskTotal("SPEAKING", { KOMMUNIKATION: 4, WORTSCHATZ: 4, GRAMMATIK: 4, AUSSPRACHE: null, KOHAERENZ: 4 })).toBeNull();
  });
  it("lists a criterion the AI could not judge as null", () => {
    expect(proposalPoints(speaking({ KOMMUNIKATION: 2, AUSSPRACHE: null }))).toEqual({ KOMMUNIKATION: 2, AUSSPRACHE: null });
    expect(proposalPoints(null)).toEqual({});
  });
});

describe("parseCoursePoints", () => {
  it("accepts a whole number from 0 to the criterion's maximum for every criterion", () => {
    expect(parseCoursePoints("WRITING", { INHALT: 3, WORTSCHATZ: "2", GRAMMATIK: 0 })).toEqual({ ok: true, points: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 0 } });
    expect(parseCoursePoints("SPEAKING", { KOMMUNIKATION: 4, WORTSCHATZ: 0, GRAMMATIK: 1, AUSSPRACHE: 2, KOHAERENZ: 3 })).toMatchObject({ ok: true });
  });
  it("refuses a missing criterion, a half point, a number out of range and a stray key", () => {
    expect(parseCoursePoints("WRITING", { INHALT: 3, WORTSCHATZ: 2 })).toMatchObject({ ok: false });
    expect(parseCoursePoints("WRITING", { INHALT: 2.5, WORTSCHATZ: 2, GRAMMATIK: 1 })).toMatchObject({ ok: false });
    expect(parseCoursePoints("WRITING", { INHALT: 4, WORTSCHATZ: 2, GRAMMATIK: 1 })).toMatchObject({ ok: false });
    expect(parseCoursePoints("SPEAKING", { KOMMUNIKATION: 5, WORTSCHATZ: 0, GRAMMATIK: 1, AUSSPRACHE: 2, KOHAERENZ: 3 })).toMatchObject({ ok: false });
    expect(parseCoursePoints("WRITING", { INHALT: -1, WORTSCHATZ: 2, GRAMMATIK: 1 })).toMatchObject({ ok: false });
    expect(parseCoursePoints("WRITING", { INHALT: "", WORTSCHATZ: 2, GRAMMATIK: 1 })).toMatchObject({ ok: false });
    expect(parseCoursePoints("WRITING", { INHALT: 1, WORTSCHATZ: 2, GRAMMATIK: 1, AUSSPRACHE: 3 })).toMatchObject({ ok: false });
  });
});

describe("confirmablePoints", () => {
  it("is the proposal's points as numbers", () => {
    expect(confirmablePoints("WRITING", writing({ INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 }))).toEqual({ INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 });
  });
  it("is null when the teacher still has to set a criterion", () => {
    expect(confirmablePoints("SPEAKING", speaking({ KOMMUNIKATION: 3, WORTSCHATZ: 3, GRAMMATIK: 2, AUSSPRACHE: null, KOHAERENZ: 3 }))).toBeNull();
    expect(confirmablePoints("SPEAKING", null)).toBeNull();
  });
});

describe("the teacher's pass / fail override", () => {
  const at = new Date("2026-10-28T12:00:00Z");
  it("is a skill-override entry holding PASS or FAIL with the reason and the teacher", () => {
    const entry = courseOutcomeOverrideEntry({ outcome: "PASS", reason: "Oral exam retaken", userId: "u1", at });
    expect(entry).toEqual({ level: "PASS", decider: "TEACHER", userId: "u1", reason: "Oral exam retaken", at: at.toISOString() });
    const overrides = { [COURSE_OUTCOME_OVERRIDE_KEY]: entry };
    expect(courseOutcomeOverride(overrides)).toEqual({ outcome: "PASS", reason: "Oral exam retaken", userId: "u1", at: at.toISOString() });
  });
  it("is absent without the key, and anything but PASS or FAIL is not an override", () => {
    expect(courseOutcomeOverride({})).toBeNull();
    expect(courseOutcomeOverride(null)).toBeNull();
    expect(courseOutcomeOverride({ [COURSE_OUTCOME_OVERRIDE_KEY]: { level: "B1", decider: "TEACHER", userId: null, reason: null, at: "x" } })).toBeNull();
  });
  it("decides the outcome that counts: the override over the points' verdict, none while pending", () => {
    const fail = { outcome: "FAIL" } as const;
    const overrides = { [COURSE_OUTCOME_OVERRIDE_KEY]: courseOutcomeOverrideEntry({ outcome: "PASS", reason: "reason", userId: "u1", at }) };
    expect(effectiveCourseOutcome(fail, {})).toBe("FAIL");
    expect(effectiveCourseOutcome(fail, overrides)).toBe("PASS");
    expect(effectiveCourseOutcome({ outcome: null }, {})).toBeNull();
    expect(effectiveCourseOutcome(null, null)).toBeNull();
  });
});
