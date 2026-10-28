import type { FinalSkill } from "@/db/schema/exam";
import { sheetRows, type SheetRow } from "@/components/panel/course/model";
import { courseOutcomeOverrideOf, effectiveCourseOutcome } from "@/components/panel/course/outcome";
import type { StudentResult } from "@/lib/exam-flow";
import { COURSE_TESTS, defaultCourseRules } from "@/lib/exam/course/catalog";
import { COURSE_CRITERIA, resolveCourseTask, type CourseGradingView, type CourseProductiveSection } from "@/lib/exam/course/decisions";
import { courseMinPoints } from "@/lib/exam/course/result";
import { studentCourseResult } from "@/lib/exam/course/student-view";
import {
  COMMON_WRITING_ERRORS,
  CRITERION_LABEL_DE,
  CRITERION_MAX,
  SPEAKING_MAX,
  WRITING_MAX,
  type CommonWritingError,
  type CourseConfig,
  type CourseCriterion,
  type CourseForm,
  type CourseKey,
  type CourseOutcome,
  type CourseReason,
  type CourseResult,
} from "@/lib/exam/course/types";
import type { StudentAnalysis } from "@/lib/exam/student-analysis";
import type { StudentNote } from "@/lib/exam/student-feedback";
import { reportAllowed, verificationCode } from "./model";

/**
 * The printed teacher copy of a course test, as data (spec 2026-10-28,
 * "Teacher and student"): Halil Bey's Bewertungsbogen filled in. Pure: the
 * page loads the rows, this decides what the sheet may print. German only like
 * every teacher copy, and no CEFR level anywhere (a course test has none).
 *
 * Nothing is recomputed here. The section points, the total, the verdict and
 * the recommendation are `computed.course` as the engine stored it, and the
 * criteria are read with the engine's own precedence (`resolveCourseTask`: the
 * teacher's number, else the proposal's). A number nobody decided is never
 * printed as a zero: an AI number carries "vorgeschlagen", a missing one reads
 * "offen". A finalized result has neither; the sheet still says so honestly if
 * a row ever lacks its decision.
 */

/** DECIDED: a teacher confirmed or set it. PROPOSED: the AI's (or a rule's) number, nobody has decided. OPEN: no number yet. */
export type PointState = "DECIDED" | "PROPOSED" | "OPEN";
export type PointCell = { points: number | null; state: PointState };
const OPEN: PointCell = { points: null, state: "OPEN" };

/** A `response_gradings` row as the sheet reads it. */
export type CourseReportGrading = CourseGradingView & { itemResponseId: string; reason: string | null };

export type CourseReportSource = {
  /** `exam_results.status`: the sheet exists for a FINAL result only. */
  status: string | null | undefined;
  schoolName: string;
  studentName: string;
  examDate: Date | null;
  /** Who finalized the result. */
  teacherName: string | null;
  finalizedAt: Date | null;
  attemptId: string;
  /** The exam's enabled sections, in order. */
  sections: readonly string[];
  /** `blueprint_snapshot.course`: the test, the form and the cut scores it ran with. */
  config: CourseConfig | null | undefined;
  /** `exam_results.computed.course`. */
  course: CourseResult | null | undefined;
  /** `exam_results.final_outcome`, frozen when the teacher finalized. */
  finalOutcome: string | null | undefined;
  /** `exam_results.skill_overrides`: the teacher's PASS or FAIL is kept there (panel/course/outcome.ts). */
  skillOverrides: Record<string, FinalSkill> | null | undefined;
  /** User names by id. */
  nameOf: Record<string, string>;
  runs: ReadonlyArray<{ id: string; section: string }>;
  responses: ReadonlyArray<{ id: string; sectionRunId: string; sequence: number }>;
  gradings: ReadonlyArray<CourseReportGrading>;
};

// ---------------------------------------------------------------------------
// Writing and speaking criteria
// ---------------------------------------------------------------------------

export type RubricTask = {
  /** 1-based, in the order the tasks were asked. */
  n: number;
  cells: Partial<Record<CourseCriterion, PointCell>>;
  /** The criteria added up; OPEN while any criterion has no number. */
  total: PointCell;
};

export type RubricNote = { kind: "ADVICE" | "TEACHER"; task: number; text: string };

export type CommonErrorBox = { id: CommonWritingError; label: string; ticked: boolean };

export type RubricBlock = {
  section: CourseProductiveSection;
  criteria: Array<{ id: CourseCriterion; label: string; max: number }>;
  tasks: RubricTask[];
  /** The most one task can earn: 9 for writing, 20 for speaking. */
  taskMax: number;
  /** The section's points as the result counts them (over several tasks the mean, rounded down); null while pending. */
  points: number | null;
  max: number;
  /** Writing only: every "Häufigste Fehler" box of the sheet, ticked or not. */
  errors: { state: PointState; boxes: CommonErrorBox[] } | null;
  /**
   * The AI's one-sentence advice for a task the teacher confirmed as proposed, and
   * the reason of a teacher who changed the points. Nothing else the AI wrote.
   */
  notes: RubricNote[];
};

const isTeacherStatus = (status: CourseGradingView["status"]): boolean => status === "CONFIRMED" || status === "OVERRIDDEN";
const clampPoints = (n: number, max: number): number => Math.min(max, Math.max(0, Math.round(n)));
const TASK_MAX: Record<CourseProductiveSection, number> = { WRITING: WRITING_MAX, SPEAKING: SPEAKING_MAX };
const ERROR_IDS = Object.keys(COMMON_WRITING_ERRORS) as CommonWritingError[];

function taskOf(section: CourseProductiveSection, n: number, grading: CourseReportGrading | null): RubricTask {
  const { points } = resolveCourseTask(section, grading);
  const teacher = !!grading && isTeacherStatus(grading.status);
  const cap = CRITERION_MAX[section];
  const cells: RubricTask["cells"] = {};
  for (const id of COURSE_CRITERIA[section]) {
    const p = points[id];
    cells[id] = typeof p === "number" ? { points: clampPoints(p, cap), state: teacher ? "DECIDED" : "PROPOSED" } : OPEN;
  }
  const all = COURSE_CRITERIA[section].map((id) => cells[id] ?? OPEN);
  const total: PointCell = all.every((c) => c.points !== null)
    ? { points: all.reduce((sum, c) => sum + (c.points ?? 0), 0), state: all.every((c) => c.state === "DECIDED") ? "DECIDED" : "PROPOSED" }
    : OPEN;
  return { n, cells, total };
}

/** The ticked boxes: the teacher's once the task is decided, else the AI's pre-ticked proposal. */
function errorsOf(grading: CourseReportGrading | null): NonNullable<RubricBlock["errors"]> {
  let state: PointState = "OPEN";
  let ticked: readonly string[] = [];
  if (grading && isTeacherStatus(grading.status)) {
    state = "DECIDED";
    ticked = grading.coursePoints?.commonErrors ?? grading.courseProposal?.commonErrors ?? [];
  } else if (grading?.status === "AI_PROPOSED") {
    state = "PROPOSED";
    ticked = grading.courseProposal?.commonErrors ?? [];
  }
  return { state, boxes: ERROR_IDS.map((id) => ({ id, label: COMMON_WRITING_ERRORS[id], ticked: ticked.includes(id) })) };
}

function notesOf(gradings: ReadonlyArray<CourseReportGrading | null>): RubricNote[] {
  const notes: RubricNote[] = [];
  gradings.forEach((g, i) => {
    if (!g) return;
    // The AI's wording reaches the sheet only once a teacher adopted the proposal as it was (detail-model.ts does the same).
    const advice = g.status === "CONFIRMED" ? g.courseProposal?.advice?.trim() : "";
    if (advice) notes.push({ kind: "ADVICE", task: i + 1, text: advice });
    const reason = g.status === "OVERRIDDEN" ? g.reason?.trim() : "";
    if (reason) notes.push({ kind: "TEACHER", task: i + 1, text: reason });
  });
  return notes;
}

function gradingsOf(src: CourseReportSource, section: CourseProductiveSection): Array<CourseReportGrading | null> {
  const run = src.runs.find((r) => r.section === section);
  if (!run) return [];
  return src.responses
    .filter((r) => r.sectionRunId === run.id)
    .sort((a, b) => a.sequence - b.sequence)
    .map((r) => src.gradings.find((g) => g.itemResponseId === r.id) ?? null);
}

function rubricOf(section: CourseProductiveSection, src: CourseReportSource, row: SheetRow): RubricBlock {
  const gradings = gradingsOf(src, section);
  const cap = CRITERION_MAX[section];
  return {
    section,
    criteria: COURSE_CRITERIA[section].map((id) => ({ id, label: CRITERION_LABEL_DE[id], max: cap })),
    tasks: gradings.map((g, i) => taskOf(section, i + 1, g)),
    taskMax: TASK_MAX[section],
    points: row.pending ? null : row.points,
    max: row.max,
    errors: section === "WRITING" ? errorsOf(gradings[0] ?? null) : null,
    notes: notesOf(gradings),
  };
}

// ---------------------------------------------------------------------------
// Gesamtauswertung
// ---------------------------------------------------------------------------

export type ReasonLine = { code: CourseReason; points: number; max: number; need: number };

export type CourseLimits = {
  pass: { pct: number; points: number; max: number };
  /** FINAL only: the speaking minimum. */
  speaking: { pct: number; points: number; max: number } | null;
  writingContentZeroFails: boolean;
};

export type CourseEvaluation = {
  total: number | null;
  max: number;
  /** Share of the maximum, one decimal; null while pending. */
  pct: number | null;
  /** The outcome that counts: the frozen one, else the teacher's, else the points'. Null while pending. */
  outcome: CourseOutcome | null;
  /** Set when the teacher's outcome differs from what the points say. */
  changed: { computed: CourseOutcome; reason: string | null; by: string | null } | null;
  /** The course to continue in. Null while pending and after a changed outcome: the course was worked out for the other one. */
  recommendation: string | null;
  focus: "SPEAKING" | "WRITING" | null;
  /** Why the points did not pass, with the numbers; empty for a pass and after a changed outcome. */
  reasons: ReasonLine[];
  limits: CourseLimits;
};

function evaluationOf(src: CourseReportSource, course: CourseResult, rows: SheetRow[]): CourseEvaluation {
  // The cut scores the test ran with; the catalog's for a snapshot that has none.
  const rules = src.config?.rules ?? defaultCourseRules(course.key);
  const speakingRow = rows.find((r) => r.section === "SPEAKING");
  const speakingMax = speakingRow?.max ?? SPEAKING_MAX;
  const limits: CourseLimits = {
    pass: { pct: rules.passPct, points: courseMinPoints(rules.passPct, course.max), max: course.max },
    speaking:
      rules.speakingMinPct !== null && speakingRow
        ? { pct: rules.speakingMinPct, points: courseMinPoints(rules.speakingMinPct, speakingMax), max: speakingMax }
        : null,
    writingContentZeroFails: rules.writingContentZeroFails,
  };

  const frozen = src.finalOutcome === "PASS" || src.finalOutcome === "FAIL" ? src.finalOutcome : null;
  const override = courseOutcomeOverrideOf(src.skillOverrides);
  const outcome = frozen ?? effectiveCourseOutcome(course, override);
  const changed =
    outcome !== null && course.outcome !== null && outcome !== course.outcome
      ? {
          computed: course.outcome,
          reason: override?.outcome === outcome ? override.reason : null,
          by: override?.outcome === outcome && override.userId ? (src.nameOf[override.userId] ?? null) : null,
        }
      : null;

  const reasons: ReasonLine[] =
    changed || outcome !== "FAIL"
      ? []
      : course.reasons.map((code) => {
          if (code === "SPEAKING_BELOW_MIN") return { code, points: speakingRow?.points ?? 0, max: speakingMax, need: limits.speaking?.points ?? 0 };
          if (code === "BELOW_PASS") return { code, points: course.total ?? 0, max: course.max, need: limits.pass.points };
          return { code, points: 0, max: CRITERION_MAX.WRITING, need: 1 };
        });

  return {
    total: course.total,
    max: course.max,
    pct: course.pct,
    outcome,
    changed,
    recommendation: changed ? null : course.recommendation,
    focus: changed ? null : course.focus,
    reasons,
    limits,
  };
}

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

export type CourseReportModel = {
  header: {
    schoolName: string;
    /** "Zwischentest B1.1" / "Abschlusstest B1". */
    testName: string;
    key: CourseKey;
    form: CourseForm | null;
    studentName: string;
    examDate: Date | null;
    teacherName: string | null;
    /** The form's maximum, e.g. 74, and how it splits into the written part and speaking. */
    maxPoints: number;
    writtenPoints: number;
    oralPoints: number;
  };
  /** One row per section of the exam, in its order. */
  sections: SheetRow[];
  writing: RubricBlock | null;
  speaking: RubricBlock | null;
  evaluation: CourseEvaluation;
  finalizedAt: Date | null;
  verificationCode: string;
  /** Some number is still open: the sheet says what "offen" means. */
  hasOpen: boolean;
  /** Some number is the AI's proposal: the sheet says what "vorgeschlagen" means. */
  hasProposal: boolean;
};

export function buildCourseReport(src: CourseReportSource, secret: string): { ok: true; model: CourseReportModel } | { ok: false; reason: "NOT_FINAL" } {
  const course = src.course;
  const key = src.config?.key ?? course?.key;
  if (!reportAllowed(src.status) || !course || !key) return { ok: false, reason: "NOT_FINAL" };

  const sections = sheetRows(src.sections, course, key);
  const rowOf = (section: CourseProductiveSection) => sections.find((r) => r.section === section);
  const writingRow = rowOf("WRITING");
  const speakingRow = rowOf("SPEAKING");
  const writing = writingRow ? rubricOf("WRITING", src, writingRow) : null;
  const speaking = speakingRow ? rubricOf("SPEAKING", src, speakingRow) : null;
  const evaluation = evaluationOf(src, course, sections);

  const blocks = [writing, speaking].filter((b): b is RubricBlock => b !== null);
  const cells = blocks.flatMap((b) => b.tasks.flatMap((t) => [...Object.values(t.cells), t.total]));
  const errorStates = blocks.flatMap((b) => (b.errors ? [b.errors.state] : []));
  const max = course.max;
  const oralPoints = speakingRow?.max ?? 0;

  return {
    ok: true,
    model: {
      header: {
        schoolName: src.schoolName,
        testName: COURSE_TESTS[key].germanName,
        key,
        form: course.form ?? src.config?.form ?? null,
        studentName: src.studentName,
        examDate: src.examDate,
        teacherName: src.teacherName,
        maxPoints: max,
        writtenPoints: max - oralPoints,
        oralPoints,
      },
      sections,
      writing,
      speaking,
      evaluation,
      finalizedAt: src.finalizedAt,
      verificationCode: verificationCode(src.attemptId, secret),
      hasOpen: sections.some((s) => s.pending) || evaluation.outcome === null || cells.some((c) => c.state === "OPEN") || errorStates.includes("OPEN"),
      hasProposal: cells.some((c) => c.state === "PROPOSED") || errorStates.includes("PROPOSED"),
    },
  };
}

// ---------------------------------------------------------------------------
// The student's copy
// ---------------------------------------------------------------------------

/**
 * The student copy of a course test, printed from the panel (`?copy=student`):
 * the same result the student's own finish screen and print page get
 * (`finishedState` in exam-flow.ts), so the two sheets agree. Passed or not,
 * the points per section, the course to continue in, the skill to practise and
 * the topics from the analysis; never a level (`levelShown` is false, no
 * overall, no skills), never a criterion, never a question.
 */
export function courseStudentResult(input: {
  visibility: StudentResult["visibility"];
  course: CourseResult | null | undefined;
  finalOutcome: string | null | undefined;
  analysis: StudentAnalysis | null | undefined;
  feedback: StudentNote | null | undefined;
}): StudentResult {
  return {
    visibility: input.visibility,
    released: true,
    awaitingTeacher: false,
    levelShown: false,
    analysis: input.analysis ?? undefined,
    feedback: input.feedback ?? null,
    course: studentCourseResult(input.course, input.finalOutcome) ?? undefined,
  };
}
