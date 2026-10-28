import { describe, expect, it } from "vitest";
import { defaultCourseRules } from "@/lib/exam/course/catalog";
import type { CourseResult } from "@/lib/exam/course/types";
import { courseBlockers, courseChecklist, courseHistory, courseThresholds, sheetRows, taskTotals, wordCount } from "./model";
import { courseTotals, sectionMaxOf } from "./totals";

const result = (over: Partial<CourseResult> = {}): CourseResult => ({
  key: "B1",
  form: "A",
  sections: {
    READING: { points: 8, max: 10, pending: false },
    GRAMMAR: { points: 21, max: 25, pending: false },
    LISTENING: { points: 7, max: 10, pending: false },
    WRITING: { points: 6, max: 9, pending: false },
    SPEAKING: { points: null, max: 20, pending: true },
  },
  total: null,
  max: 74,
  pct: null,
  outcome: null,
  reasons: [],
  recommendation: null,
  focus: null,
  ...over,
});

const ORDER = ["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"];

describe("what a course test is worth", () => {
  it("counts the points of each section from the catalog", () => {
    expect(["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"].map((s) => sectionMaxOf("B1", s as "READING"))).toEqual([10, 25, 10, 9, 20]);
    expect(["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"].map((s) => sectionMaxOf("B1.1", s as "READING"))).toEqual([6, 15, 6, 9, 20]);
  });

  it("adds them up to 56 for a Zwischentest and 74 for an Abschlusstest, with the sum of the section minutes", () => {
    expect(courseTotals("A2.1")).toEqual({ points: 56, minutes: 59 });
    expect(courseTotals("B2")).toEqual({ points: 74, minutes: 95 });
  });
});

describe("sheetRows: the section table", () => {
  it("lists the sections in the exam's order with the engine's points, pending marked", () => {
    const rows = sheetRows(ORDER, result(), "B1");
    expect(rows.map((r) => [r.section, r.points, r.max, r.pending])).toEqual([
      ["READING", 8, 10, false],
      ["GRAMMAR", 21, 25, false],
      ["LISTENING", 7, 10, false],
      ["WRITING", 6, 9, false],
      ["SPEAKING", null, 20, true],
    ]);
  });

  it("is all pending, with the catalog's maxima, before the engine has said anything", () => {
    for (const course of [null, undefined]) {
      expect(sheetRows(ORDER, course, "B1.1").map((r) => [r.points, r.max, r.pending])).toEqual([
        [null, 6, true],
        [null, 15, true],
        [null, 6, true],
        [null, 9, true],
        [null, 20, true],
      ]);
    }
  });
});

describe("courseThresholds: the cut scores in points", () => {
  it("turns Halil Bey's B1 table into 42 of 64: pass 65%, to the second half 38, to the first half 28, speaking 12", () => {
    expect(courseThresholds(defaultCourseRules("B1"), 64, 20)).toEqual({
      pass: 42,
      passPct: 65,
      speakingMin: 12,
      speakingMinPct: 60,
      contentZeroFails: true,
      secondHalf: 38,
      firstHalf: 28,
    });
  });

  it("scales them to a form of 74 points", () => {
    expect(courseThresholds(defaultCourseRules("B1"), 74, 20)).toMatchObject({ pass: 49, speakingMin: 12, secondHalf: 44, firstHalf: 33 });
  });

  it("has only a pass mark and the INHALT rule at a Zwischentest (60% of 56 is 34)", () => {
    expect(courseThresholds(defaultCourseRules("B1.1"), 56, 20)).toEqual({
      pass: 34,
      passPct: 60,
      speakingMin: null,
      speakingMinPct: null,
      contentZeroFails: true,
      secondHalf: null,
      firstHalf: null,
    });
  });
});

describe("courseChecklist", () => {
  const submitted = new Set(ORDER);

  it("counts the objective sections as done and a writing or speaking section by its decided tasks", () => {
    const c = courseChecklist({
      sections: ORDER,
      submitted,
      tasks: {
        WRITING: [{ id: "w1", status: "CONFIRMED" }],
        SPEAKING: [
          { id: "s1", status: "OVERRIDDEN" },
          { id: "s2", status: "AI_PROPOSED" },
          { id: "s3", status: "PENDING" },
        ],
      },
    });
    expect(c.rows.map((r) => [r.section, r.kind, r.state, r.open, r.total])).toEqual([
      ["READING", "AUTO", "done", 0, 0],
      ["GRAMMAR", "AUTO", "done", 0, 0],
      ["LISTENING", "AUTO", "done", 0, 0],
      ["WRITING", "TEACHER", "done", 0, 1],
      ["SPEAKING", "TEACHER", "todo", 2, 3],
    ]);
    expect(c.done).toBe(4);
    expect(c.total).toBe(5);
    // The link goes to a task whose proposal has arrived before one still pending.
    expect(c.rows[4].firstOpenResponseId).toBe("s2");
  });

  it("sends the teacher to a pending task when it is the only one open", () => {
    const c = courseChecklist({ sections: ["SPEAKING"], submitted, tasks: { SPEAKING: [{ id: "s1", status: "PENDING" }] } });
    expect(c.rows[0]).toMatchObject({ state: "todo", firstOpenResponseId: "s1" });
  });

  it("is running while a section is open and waiting for the AI while no task exists yet", () => {
    expect(courseChecklist({ sections: ["READING", "WRITING"], submitted: new Set(), tasks: {} }).rows.map((r) => r.state)).toEqual(["running", "running"]);
    expect(courseChecklist({ sections: ["WRITING"], submitted, tasks: {} }).rows[0].state).toBe("aiPending");
  });

  it("treats a confirmed or changed task as decided and an AI failure as open", () => {
    const rows = (status: "CONFIRMED" | "OVERRIDDEN" | "AI_FAILED") => courseChecklist({ sections: ["WRITING"], submitted, tasks: { WRITING: [{ id: "w1", status }] } }).rows[0];
    expect(rows("CONFIRMED").state).toBe("done");
    expect(rows("OVERRIDDEN").state).toBe("done");
    expect(rows("AI_FAILED").state).toBe("todo");
  });
});

describe("courseBlockers: what stands between the result and Finalize", () => {
  const ready = { ended: true, hasResult: true, open: 0, outcome: "PASS" as const };

  it("is empty when every task is decided and the outcome is known", () => {
    expect(courseBlockers(ready)).toEqual([]);
    expect(courseBlockers({ ...ready, outcome: "FAIL" })).toEqual([]);
  });

  it("waits for the student, then the result, then the teacher's decisions, then the engine", () => {
    expect(courseBlockers({ ...ready, ended: false, open: 2 })).toEqual(["RUNNING"]);
    expect(courseBlockers({ ...ready, hasResult: false })).toEqual(["NO_RESULT"]);
    expect(courseBlockers({ ...ready, open: 2 })).toEqual(["UNDECIDED"]);
    expect(courseBlockers({ ...ready, outcome: null })).toEqual(["NOT_READY"]);
  });
});

describe("taskTotals", () => {
  it("adds a decided task's points and leaves an undecided one empty", () => {
    expect(
      taskTotals([
        { status: "CONFIRMED", points: { KOMMUNIKATION: 3, WORTSCHATZ: 3, GRAMMATIK: 2, AUSSPRACHE: 3, KOHAERENZ: 3 } },
        { status: "AI_PROPOSED", points: null },
        { status: "OVERRIDDEN", points: { KOMMUNIKATION: 4, WORTSCHATZ: 4, GRAMMATIK: 4, AUSSPRACHE: 4, KOHAERENZ: 4 } },
      ]),
    ).toEqual([14, null, 20]);
  });
});

describe("wordCount", () => {
  it("counts runs of non-space characters", () => {
    expect(wordCount("  Sehr geehrte Frau Neumann,\nich  möchte ")).toBe(6);
    expect(wordCount("")).toBe(0);
  });
});

describe("courseHistory", () => {
  const at = (h: number) => new Date(`2026-10-28T${String(h).padStart(2, "0")}:00:00Z`);

  it("reads rubric decisions, the outcome decision and the other steps, newest first", () => {
    const entries = courseHistory(
      [
        { at: at(9), changedBy: "u1", before: { status: "AI_PROPOSED", total: 6 }, after: { status: "CONFIRMED", total: 6 }, reason: "AI proposal confirmed" },
        { at: at(11), changedBy: "u1", before: { commonErrors: [] }, after: { commonErrors: ["CASE", "SPELLING"] }, reason: "Common errors updated" },
        { at: at(10), changedBy: "u2", before: { total: 6 }, after: { status: "OVERRIDDEN", total: 7 }, reason: "Leitpunkt 3 fehlt" },
      ],
      [
        { at: at(12), changedBy: "u1", field: "course_outcome", before: "PASS", after: "FAIL", reason: "Anwesenheit" },
        { at: at(13), changedBy: "u1", field: "finalize", before: null, after: true, reason: null },
      ],
    );
    expect(entries.map((e) => e.kind)).toEqual(["other", "outcome", "errors", "points", "points"]);
    expect(entries[1]).toMatchObject({ from: "PASS", to: "FAIL", reason: "Anwesenheit" });
    expect(entries[2]).toMatchObject({ count: 2 });
    expect(entries[3]).toMatchObject({ from: 6, to: 7, reason: "Leitpunkt 3 fehlt", who: "u2" });
    expect(entries[4]).toMatchObject({ from: 6, to: 6 });
    expect(entries[0]).toMatchObject({ text: "finalize: true" });
  });

  it("has nothing to say when nothing changed", () => {
    expect(courseHistory([], [])).toEqual([]);
  });
});
