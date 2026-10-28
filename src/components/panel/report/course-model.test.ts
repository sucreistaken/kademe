import { describe, expect, it } from "vitest";
import type { FinalSkill } from "@/db/schema/exam";
import { defaultCourseRules } from "@/lib/exam/course/catalog";
import { resolveCourseTask } from "@/lib/exam/course/decisions";
import { computeCourseResult } from "@/lib/exam/course/result";
import {
  COMMON_WRITING_ERRORS,
  CRITERION_LABEL_DE,
  SPEAKING_CRITERIA,
  WRITING_CRITERIA,
  type CommonWritingError,
  type CourseKey,
  type CourseResult,
  type CourseRubricProposal,
} from "@/lib/exam/course/types";
import type { StudentAnalysis } from "@/lib/exam/student-analysis";
import { buildCourseReport, courseStudentResult, type CourseReportGrading, type CourseReportSource } from "./course-model";
import { verificationCode } from "./model";

/**
 * The printed Bewertungsbogen of a course test, as data (spec 2026-10-28,
 * "Teacher and student"). The course result comes from the engine's own
 * `computeCourseResult`, fed with the same grading rows the sheet reads, so a
 * fixture can never print one number and score another.
 */

type Status = CourseReportGrading["status"];
const SECTIONS = ["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"] as const;

function proposal(section: "WRITING" | "SPEAKING", points: Array<number | null>, commonErrors: CommonWritingError[] = []): CourseRubricProposal {
  const criteria = section === "WRITING" ? WRITING_CRITERIA : SPEAKING_CRITERIA;
  return {
    kind: "COURSE_RUBRIC",
    section,
    criteria: criteria.map((id, i) => ({ id, points: points[i] ?? null, max: section === "WRITING" ? 3 : 4, rationale: "Begründung." })),
    ...(section === "WRITING" ? { commonErrors } : {}),
    advice: section === "WRITING" ? "Nebensätze mit weil üben." : "Mehr Verbindungswörter verwenden.",
  };
}

/** A grading row: the AI's proposal and, once a teacher decided, the teacher's points. */
function grading(
  id: string,
  section: "WRITING" | "SPEAKING",
  status: Status,
  ai: Array<number | null> | null,
  teacher: number[] | null = null,
  opts: { aiErrors?: CommonWritingError[]; teacherErrors?: CommonWritingError[]; reason?: string } = {},
): CourseReportGrading {
  const criteria = section === "WRITING" ? WRITING_CRITERIA : SPEAKING_CRITERIA;
  return {
    itemResponseId: id,
    status,
    courseProposal: ai ? proposal(section, ai, opts.aiErrors) : null,
    coursePoints: teacher
      ? { points: Object.fromEntries(criteria.map((c, i) => [c, teacher[i]])), ...(section === "WRITING" ? { commonErrors: opts.teacherErrors ?? opts.aiErrors ?? [] } : {}) }
      : null,
    reason: opts.reason ?? null,
  };
}

type Fixture = {
  key?: CourseKey;
  objective?: [number | null, number | null, number | null];
  writing: CourseReportGrading[];
  speaking: CourseReportGrading[];
  finalOutcome?: string | null;
  skillOverrides?: Record<string, FinalSkill>;
  status?: string;
};

/** The source the page builds, with `computed.course` worked out by the engine from the same rows. */
function sourceOf(f: Fixture): CourseReportSource {
  const key = f.key ?? "B1";
  const final = !key.includes(".");
  const objectiveMax = final ? [10, 25, 10] : [6, 15, 6];
  const right = f.objective ?? (final ? [9, 22, 8] : [5, 12, 5]);
  const config = { key, form: "A" as const, rules: defaultCourseRules(key) };
  const course = computeCourseResult({
    config,
    objective: {
      READING: { right: right[0], max: objectiveMax[0] },
      GRAMMAR: { right: right[1], max: objectiveMax[1] },
      LISTENING: { right: right[2], max: objectiveMax[2] },
    },
    writing: f.writing.map((g) => resolveCourseTask("WRITING", g).points),
    speaking: f.speaking.map((g) => resolveCourseTask("SPEAKING", g).points),
  });
  const runs = SECTIONS.map((section) => ({ id: `run-${section}`, section }));
  const responses = [
    ...f.writing.map((g, i) => ({ id: g.itemResponseId, sectionRunId: "run-WRITING", sequence: 30 + i })),
    // Listed out of order: the sheet numbers the tasks by their sequence.
    ...f.speaking.map((g, i) => ({ id: g.itemResponseId, sectionRunId: "run-SPEAKING", sequence: 40 + i })).reverse(),
  ];
  return {
    status: f.status ?? "FINAL",
    schoolName: "Campus German",
    studentName: "Anna Muster",
    examDate: new Date("2026-10-23T09:00:00Z"),
    teacherName: "Frau Beispiel",
    finalizedAt: new Date("2026-10-24T09:00:00Z"),
    attemptId: "7f0c2c1e-1111-4222-8333-444455556666",
    sections: SECTIONS,
    config,
    course,
    finalOutcome: f.finalOutcome === undefined ? course.outcome : f.finalOutcome,
    skillOverrides: f.skillOverrides ?? {},
    nameOf: { u1: "Frau Beispiel", u2: "Herr Kontrolle" },
    runs,
    responses,
    gradings: [...f.writing, ...f.speaking],
  };
}

function modelOf(f: Fixture) {
  const r = buildCourseReport(sourceOf(f), "secret");
  if (!r.ok) throw new Error("expected a sheet");
  return r.model;
}

const writingDone = (points: [number, number, number] = [3, 2, 2]) =>
  grading("w1", "WRITING", "CONFIRMED", points, points, { aiErrors: ["VERB_POSITION", "SPELLING"] });
const speakingDone = (totals: number[][]) => totals.map((points, i) => grading(`s${i + 1}`, "SPEAKING", "CONFIRMED", points, points));

// 16, 15 and 17 points: the mean, rounded down, is 16.
const strongSpeaking = [
  [4, 3, 3, 3, 3],
  [3, 3, 3, 3, 3],
  [4, 4, 3, 3, 3],
];
// 10, 11 and 10 points: 10 of 20, under the speaking minimum of 12.
const weakSpeaking = [
  [2, 2, 2, 2, 2],
  [3, 2, 2, 2, 2],
  [2, 2, 2, 2, 2],
];

describe("a passed Abschlusstest", () => {
  const m = modelOf({ writing: [writingDone()], speaking: speakingDone(strongSpeaking) });

  it("has the sheet's header: school, German test name, form, maximum and the people", () => {
    expect(m.header).toEqual({
      schoolName: "Campus German",
      testName: "Abschlusstest B1",
      key: "B1",
      form: "A",
      studentName: "Anna Muster",
      examDate: new Date("2026-10-23T09:00:00Z"),
      teacherName: "Frau Beispiel",
      maxPoints: 74,
      writtenPoints: 54,
      oralPoints: 20,
    });
    expect(m.verificationCode).toBe(verificationCode("7f0c2c1e-1111-4222-8333-444455556666", "secret"));
  });

  it("lists every part in telc order with the engine's points", () => {
    const decided = (points: number) => ({ points, state: "DECIDED" });
    expect(m.sections).toEqual([
      { section: "READING", points: 9, max: 10, pending: false, cell: decided(9) },
      { section: "GRAMMAR", points: 22, max: 25, pending: false, cell: decided(22) },
      { section: "LISTENING", points: 8, max: 10, pending: false, cell: decided(8) },
      { section: "WRITING", points: 7, max: 9, pending: false, cell: decided(7) },
      { section: "SPEAKING", points: 16, max: 20, pending: false, cell: decided(16) },
    ]);
    expect(m.total).toEqual(decided(62));
  });

  it("prints the decided writing criteria and the ticked boxes, all sixteen of them", () => {
    const w = m.writing!;
    expect(w.criteria.map((c) => c.label)).toEqual(WRITING_CRITERIA.map((c) => CRITERION_LABEL_DE[c]));
    expect(w.tasks).toEqual([
      {
        n: 1,
        cells: { INHALT: { points: 3, state: "DECIDED" }, WORTSCHATZ: { points: 2, state: "DECIDED" }, GRAMMATIK: { points: 2, state: "DECIDED" } },
        total: { points: 7, state: "DECIDED" },
      },
    ]);
    expect(w.points).toBe(7);
    expect(w.errors?.state).toBe("DECIDED");
    expect(w.errors?.boxes).toHaveLength(Object.keys(COMMON_WRITING_ERRORS).length);
    expect(w.errors?.boxes.filter((b) => b.ticked).map((b) => b.label)).toEqual([COMMON_WRITING_ERRORS.VERB_POSITION, COMMON_WRITING_ERRORS.SPELLING]);
  });

  it("prints the speaking criteria per task in the order they were asked, and the section's floored mean", () => {
    const s = m.speaking!;
    expect(s.criteria.map((c) => c.id)).toEqual([...SPEAKING_CRITERIA]);
    expect(s.tasks.map((t) => [t.n, t.total.points])).toEqual([
      [1, 16],
      [2, 15],
      [3, 17],
    ]);
    expect(s.taskMax).toBe(20);
    expect(s.points).toBe(16);
    expect(s.errors).toBeNull();
  });

  it("evaluates to Bestanden with the next level's first course and the cut scores in points", () => {
    expect(m.evaluation).toEqual({
      total: 62,
      max: 74,
      pct: 83.8,
      outcome: "PASS",
      changed: null,
      recommendation: "B2.1",
      focus: null,
      reasons: [],
      limits: { pass: { pct: 65, points: 49, max: 74 }, speaking: { pct: 60, points: 12, max: 20 }, writingContentZeroFails: true },
    });
    expect(m.hasOpen).toBe(false);
    expect(m.hasProposal).toBe(false);
  });

  it("keeps the AI's advice once the teacher confirmed the proposal as it was", () => {
    expect(m.writing!.notes).toEqual([{ kind: "ADVICE", task: 1, text: "Nebensätze mit weil üben." }]);
  });
});

describe("a Zwischentest", () => {
  it("passes into the second half of the level and has no speaking minimum", () => {
    const m = modelOf({ key: "A2.1", writing: [writingDone()], speaking: speakingDone(strongSpeaking.slice(0, 2)) });
    expect(m.header).toMatchObject({ testName: "Zwischentest A2.1", maxPoints: 56, writtenPoints: 36, oralPoints: 20 });
    expect(m.evaluation).toMatchObject({ outcome: "PASS", recommendation: "A2.2", limits: { pass: { pct: 60, points: 34, max: 56 }, speaking: null } });
  });
});

describe("a failed Abschlusstest", () => {
  it("fails on speaking alone with a pass total: B1.2 with the speaking focus, and why", () => {
    const m = modelOf({ writing: [writingDone()], speaking: speakingDone(weakSpeaking) });
    expect(m.sections.find((r) => r.section === "SPEAKING")?.points).toBe(10);
    expect(m.evaluation).toMatchObject({
      total: 56,
      outcome: "FAIL",
      changed: null,
      recommendation: "B1.2",
      focus: "SPEAKING",
      reasons: [{ code: "SPEAKING_BELOW_MIN", points: 10, max: 20, need: 12 }],
    });
  });

  it("fails below the pass mark into the band's course, with the points it lacked", () => {
    // 4 + 10 + 4 + 5 + 10 = 33 of 74: from 33 (43.75 %) the first half of B1, under 44 (59 %).
    const m = modelOf({ objective: [4, 10, 4], writing: [writingDone([2, 2, 1])], speaking: speakingDone(weakSpeaking) });
    expect(m.evaluation).toMatchObject({
      total: 33,
      outcome: "FAIL",
      recommendation: "B1.1",
      focus: null,
      reasons: [
        { code: "BELOW_PASS", points: 33, max: 74, need: 49 },
        { code: "SPEAKING_BELOW_MIN", points: 10, max: 20, need: 12 },
      ],
    });
  });

  it("fails on writing content 0 with a pass total: B1.2 with the writing focus", () => {
    const m = modelOf({ objective: [10, 25, 10], writing: [writingDone([0, 3, 3])], speaking: speakingDone(strongSpeaking) });
    expect(m.evaluation).toMatchObject({ outcome: "FAIL", recommendation: "B1.2", focus: "WRITING", reasons: [{ code: "WRITING_CONTENT_ZERO" }] });
  });

  it("prints the teacher's reason, not the AI's advice, for points the teacher changed", () => {
    const changed = grading("w1", "WRITING", "OVERRIDDEN", [3, 3, 3], [2, 2, 1], { reason: "Leitpunkt 3 fehlt." });
    const m = modelOf({ writing: [changed], speaking: speakingDone(strongSpeaking) });
    expect(m.writing!.tasks[0].total).toEqual({ points: 5, state: "DECIDED" });
    expect(m.writing!.notes).toEqual([{ kind: "TEACHER", task: 1, text: "Leitpunkt 3 fehlt." }]);
  });
});

describe("an outcome the teacher changed", () => {
  const override: Record<string, FinalSkill> = {
    COURSE_OUTCOME: { level: "PASS", decider: "TEACHER", userId: "u2", reason: "Krank am Prüfungstag, mündlich nachgeholt.", at: "2026-10-24T08:00:00.000Z" },
  };

  it("prints the teacher's outcome, what the points said and why, and leaves the course to the teacher", () => {
    const m = modelOf({ writing: [writingDone()], speaking: speakingDone(weakSpeaking), finalOutcome: "PASS", skillOverrides: override });
    expect(m.evaluation).toMatchObject({
      outcome: "PASS",
      changed: { computed: "FAIL", reason: "Krank am Prüfungstag, mündlich nachgeholt.", by: "Herr Kontrolle" },
      recommendation: null,
      focus: null,
      reasons: [],
    });
  });

  it("reads the frozen outcome even when no override entry is stored", () => {
    const m = modelOf({ writing: [writingDone()], speaking: speakingDone(weakSpeaking), finalOutcome: "PASS" });
    expect(m.evaluation).toMatchObject({ outcome: "PASS", changed: { computed: "FAIL", reason: null, by: null }, recommendation: null });
  });
});

describe("writing that is still pending", () => {
  it("never prints a zero for a number nobody has: the part, the criteria and the outcome are open", () => {
    // The AI is still working on the text: the row has no proposal yet.
    const m = modelOf({ writing: [grading("w1", "WRITING", "PENDING", null)], speaking: speakingDone(strongSpeaking), status: "FINAL" });
    expect(m.sections.find((r) => r.section === "WRITING")).toEqual({ section: "WRITING", points: null, max: 9, pending: true, cell: { points: null, state: "OPEN" } });
    expect(m.total).toEqual({ points: null, state: "OPEN" });
    expect(m.writing!.points).toBeNull();
    expect(Object.values(m.writing!.tasks[0].cells)).toEqual([
      { points: null, state: "OPEN" },
      { points: null, state: "OPEN" },
      { points: null, state: "OPEN" },
    ]);
    expect(m.writing!.tasks[0].total).toEqual({ points: null, state: "OPEN" });
    expect(m.writing!.errors?.state).toBe("OPEN");
    expect(m.writing!.errors?.boxes.some((b) => b.ticked)).toBe(false);
    expect(m.evaluation).toMatchObject({ total: null, pct: null, outcome: null, recommendation: null, focus: null, reasons: [] });
    expect(m.hasOpen).toBe(true);
  });

  it("marks the AI's numbers and boxes as proposed until a teacher decides, and keeps its advice off the sheet", () => {
    const m = modelOf({
      writing: [grading("w1", "WRITING", "AI_PROPOSED", [2, 2, 1], null, { aiErrors: ["TOO_SHORT"] })],
      speaking: speakingDone(strongSpeaking),
    });
    expect(m.writing!.tasks[0].cells.INHALT).toEqual({ points: 2, state: "PROPOSED" });
    expect(m.writing!.tasks[0].total).toEqual({ points: 5, state: "PROPOSED" });
    expect(m.writing!.errors).toMatchObject({ state: "PROPOSED" });
    expect(m.writing!.errors?.boxes.filter((b) => b.ticked).map((b) => b.id)).toEqual(["TOO_SHORT"]);
    expect(m.writing!.notes).toEqual([]);
    // The part and the total rest on the AI's numbers, so they are marked too.
    expect(m.sections.find((r) => r.section === "WRITING")?.cell).toEqual({ points: 5, state: "PROPOSED" });
    expect(m.sections.find((r) => r.section === "READING")?.cell.state).toBe("DECIDED");
    expect(m.total).toEqual({ points: 60, state: "PROPOSED" });
    expect(m.hasProposal).toBe(true);
  });

  it("leaves AUSSPRACHE open when the AI could not judge it from the transcript", () => {
    const speaking = [grading("s1", "SPEAKING", "AI_PROPOSED", [3, 3, 3, null, 3]), ...speakingDone(strongSpeaking.slice(1))];
    const m = modelOf({ writing: [writingDone()], speaking });
    expect(m.speaking!.tasks[0].cells.AUSSPRACHE).toEqual({ points: null, state: "OPEN" });
    expect(m.speaking!.tasks[0].total.state).toBe("OPEN");
    expect(m.speaking!.points).toBeNull();
    expect(m.evaluation.outcome).toBeNull();
  });
});

describe("buildCourseReport refuses", () => {
  it("a result that is not final, and a final one without a course result", () => {
    const src = sourceOf({ writing: [writingDone()], speaking: speakingDone(strongSpeaking) });
    for (const status of ["READY", "AWAITING_REVIEW", null, undefined]) expect(buildCourseReport({ ...src, status }, "s")).toEqual({ ok: false, reason: "NOT_FINAL" });
    expect(buildCourseReport({ ...src, course: null, config: null }, "s")).toEqual({ ok: false, reason: "NOT_FINAL" });
  });
});

describe("the student copy of a course result", () => {
  const course: CourseResult = sourceOf({ writing: [writingDone()], speaking: speakingDone(weakSpeaking) }).course!;
  const analysis: StudentAnalysis = {
    sections: [{ section: "GRAMMAR", right: 22, wrong: 2, blank: 1 }],
    missedTopics: [{ topic: "relative-clause", label: "Relativsätze", missed: 2, asked: 3 }],
    strongTopics: [],
  };

  it("carries the outcome, the points, the next course and the focus, and never a level", () => {
    const r = courseStudentResult({ visibility: "FULL", course, finalOutcome: "FAIL", analysis, feedback: null });
    expect(r).toEqual({
      visibility: "FULL",
      released: true,
      awaitingTeacher: false,
      levelShown: false,
      analysis,
      feedback: null,
      course: {
        outcome: "FAIL",
        sections: [
          { section: "READING", points: 9, max: 10 },
          { section: "GRAMMAR", points: 22, max: 25 },
          { section: "LISTENING", points: 8, max: 10 },
          { section: "WRITING", points: 7, max: 9 },
          { section: "SPEAKING", points: 10, max: 20 },
        ],
        total: 56,
        max: 74,
        recommendation: "B1.2",
        focus: "SPEAKING",
      },
    });
    expect(r).not.toHaveProperty("overall");
    expect(r).not.toHaveProperty("skills");
    expect(r).not.toHaveProperty("outcome");
  });

  it("leaves the course to the teacher when the teacher changed the outcome", () => {
    const r = courseStudentResult({ visibility: "NONE", course, finalOutcome: "PASS", analysis: null, feedback: undefined });
    expect(r.course).toMatchObject({ outcome: "PASS", recommendation: null, focus: null });
    expect(r.analysis).toBeUndefined();
  });
});
