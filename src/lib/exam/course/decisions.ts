import type { CourseTaskPoints } from "./result";
import {
  CRITERION_MAX,
  SPEAKING_CRITERIA,
  WRITING_CRITERIA,
  type CommonWritingError,
  type CourseCriterion,
  type CourseOutcome,
  type CoursePoints,
  type CourseResult,
  type CourseRubricProposal,
} from "./types";

/**
 * What the AI proposed and a teacher decided for the writing and speaking tasks
 * of a course test, read the same way by the result, the grading screens and the
 * actions. Pure.
 *
 * A grading row holds two things: `course_proposal` (the AI's, or a rule's, points)
 * and `course_points` (the teacher's, written when the row becomes CONFIRMED or
 * OVERRIDDEN). The points a task stands at are the teacher's where he set them and
 * the proposal's otherwise; a criterion with no number in either (AUSSPRACHE from a
 * transcript) has none yet and keeps its task, and so the section, pending.
 */

export type CourseProductiveSection = "WRITING" | "SPEAKING";

export const COURSE_CRITERIA: Record<CourseProductiveSection, readonly CourseCriterion[]> = {
  WRITING: WRITING_CRITERIA,
  SPEAKING: SPEAKING_CRITERIA,
};

/** The fields of a `response_gradings` row that the course result reads. */
export type CourseGradingView = {
  status: "PENDING" | "AI_PROPOSED" | "AI_FAILED" | "CONFIRMED" | "OVERRIDDEN";
  courseProposal: CourseRubricProposal | null;
  coursePoints: { points: CoursePoints; commonErrors?: CommonWritingError[] } | null;
};

export type ResolvedCourseTask = {
  /** Per criterion: the teacher's number, else the proposal's, else null. */
  points: CourseTaskPoints;
  /** Every criterion has a number. */
  complete: boolean;
  /**
   * The row has a proposal (the AI's or a rule's) or a teacher's decision, so a person can act on it,
   * even when a criterion still lacks its number. False while the AI is working, after it failed, or without a row.
   */
  proposed: boolean;
  /** A teacher confirmed or changed the task and nothing is left open. */
  decided: boolean;
};

const isTeacherStatus = (status: CourseGradingView["status"]): boolean => status === "CONFIRMED" || status === "OVERRIDDEN";

/** The proposal's points by criterion; a criterion the AI could not judge is null. */
export function proposalPoints(proposal: CourseRubricProposal | null | undefined): CourseTaskPoints {
  const out: CourseTaskPoints = {};
  for (const c of proposal?.criteria ?? []) out[c.id] = typeof c.points === "number" ? c.points : null;
  return out;
}

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function resolveCourseTask(section: CourseProductiveSection, grading: CourseGradingView | null | undefined): ResolvedCourseTask {
  const teacher = !!grading && isTeacherStatus(grading.status);
  // A proposal only counts once it exists as one: a pending or failed row has none.
  const standing = !!grading && (grading.status === "AI_PROPOSED" || teacher);
  const proposed = standing ? proposalPoints(grading?.courseProposal) : {};
  const decidedPoints = teacher ? (grading?.coursePoints?.points ?? {}) : {};
  const points: CourseTaskPoints = {};
  for (const id of COURSE_CRITERIA[section]) {
    const mine = decidedPoints[id];
    const ai = proposed[id];
    points[id] = isNumber(mine) ? mine : isNumber(ai) ? ai : null;
  }
  const complete = COURSE_CRITERIA[section].every((id) => isNumber(points[id]));
  return { points, complete, proposed: standing, decided: teacher && complete };
}

/** The points of a task, criterion by criterion, added up (null while any criterion has no number). */
export function taskTotal(section: CourseProductiveSection, points: CourseTaskPoints): number | null {
  let sum = 0;
  for (const id of COURSE_CRITERIA[section]) {
    const p = points[id];
    if (!isNumber(p)) return null;
    sum += p;
  }
  return sum;
}

/**
 * Points a teacher entered, checked: every criterion of the section present, a
 * whole number from 0 to the criterion's maximum (3 in writing, 4 in speaking), and
 * nothing else. No half points.
 */
export function parseCoursePoints(
  section: CourseProductiveSection,
  raw: Partial<Record<string, unknown>>,
): { ok: true; points: CoursePoints } | { ok: false; error: string } {
  const max = CRITERION_MAX[section];
  const points: CoursePoints = {};
  for (const id of COURSE_CRITERIA[section]) {
    const value = raw[id];
    const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (!isNumber(n) || !Number.isInteger(n) || n < 0 || n > max) return { ok: false, error: `${id} must be a whole number from 0 to ${max}` };
    points[id] = n;
  }
  const unknown = Object.keys(raw).filter((k) => !(COURSE_CRITERIA[section] as readonly string[]).includes(k) && raw[k] !== undefined && raw[k] !== null && raw[k] !== "");
  if (unknown.length) return { ok: false, error: `unknown criteria: ${unknown.join(", ")}` };
  return { ok: true, points };
}

/**
 * What "confirm" decides on: the proposal's points as they stand. Null when the
 * proposal has no number for some criterion (AUSSPRACHE from a transcript); the
 * teacher has to set that one before the task can be confirmed.
 */
export function confirmablePoints(section: CourseProductiveSection, proposal: CourseRubricProposal | null | undefined): CoursePoints | null {
  const points = proposalPoints(proposal);
  const out: CoursePoints = {};
  for (const id of COURSE_CRITERIA[section]) {
    const p = points[id];
    if (!isNumber(p)) return null;
    out[id] = p;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The teacher's pass / fail override
// ---------------------------------------------------------------------------

/**
 * Where a teacher's PASS / FAIL override of a course test is kept: the result's
 * `skill_overrides` (a `FinalSkill`, `level` holding "PASS" or "FAIL"), under this
 * key. The map holds teacher overrides with a reason and a name; a course test has
 * no skill levels, so nothing else shares it, and no column or migration is needed.
 * It is a separate value from `computed.course.outcome` (the points' verdict), so
 * the screen can show both and finalize freezes the override's.
 */
export const COURSE_OUTCOME_OVERRIDE_KEY = "COURSE_OUTCOME";

/** The shape of `FinalSkill` (db/schema/exam.ts), spelled out so this module stays free of the schema. */
export type OverrideEntry = { level: string; decider: "ENGINE" | "AI" | "TEACHER"; userId: string | null; reason: string | null; at: string };

export type CourseOutcomeOverride = { outcome: CourseOutcome; reason: string | null; userId: string | null; at: string };

export function courseOutcomeOverride(skillOverrides: Record<string, OverrideEntry> | null | undefined): CourseOutcomeOverride | null {
  const entry = skillOverrides?.[COURSE_OUTCOME_OVERRIDE_KEY];
  if (!entry || (entry.level !== "PASS" && entry.level !== "FAIL")) return null;
  return { outcome: entry.level, reason: entry.reason, userId: entry.userId, at: entry.at };
}

/** The `skill_overrides` entry to write for an override. */
export function courseOutcomeOverrideEntry(input: { outcome: CourseOutcome; reason: string; userId: string; at?: Date }): OverrideEntry {
  return { level: input.outcome, decider: "TEACHER", userId: input.userId, reason: input.reason, at: (input.at ?? new Date()).toISOString() };
}

/** The outcome that counts: the teacher's override where there is one, else the points' verdict. Null while pending. */
export function effectiveCourseOutcome(
  course: Pick<CourseResult, "outcome"> | null | undefined,
  skillOverrides: Record<string, OverrideEntry> | null | undefined,
): CourseOutcome | null {
  return courseOutcomeOverride(skillOverrides)?.outcome ?? course?.outcome ?? null;
}
