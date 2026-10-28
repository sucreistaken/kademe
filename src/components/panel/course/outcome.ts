import type { FinalSkill } from "@/db/schema/exam";
import type { CourseOutcome, CourseResult } from "@/lib/exam/course/types";

/**
 * A teacher's PASS or FAIL on a course test. `exam_results` has a column for an
 * overall level override but none for an outcome, and a course test has no
 * overall level, so the decision is kept where the other teacher overrides
 * are: `skill_overrides`, under a name no section has. Same shape as a skill
 * override (who, why, when), written together with a revision row and an audit
 * row by `overrideCourseOutcome`.
 */
export const COURSE_OUTCOME_OVERRIDE_KEY = "COURSE_OUTCOME";

export type CourseOutcomeOverride = { outcome: CourseOutcome; reason: string | null; userId: string | null; at: string };

/** The stored override as a decision, or null when there is none (or the stored value is not PASS or FAIL). */
export function courseOutcomeOverrideOf(overrides: Record<string, FinalSkill> | null | undefined): CourseOutcomeOverride | null {
  const stored = overrides?.[COURSE_OUTCOME_OVERRIDE_KEY];
  if (!stored || (stored.level !== "PASS" && stored.level !== "FAIL")) return null;
  return { outcome: stored.level, reason: stored.reason, userId: stored.userId, at: stored.at };
}

/** What the result stands at now: the teacher's decision when there is one, else the engine's outcome (null while a section is pending). */
export function effectiveCourseOutcome(course: Pick<CourseResult, "outcome"> | null | undefined, override: CourseOutcomeOverride | null): CourseOutcome | null {
  return override?.outcome ?? course?.outcome ?? null;
}

/** The decision as the stored `FinalSkill` entry. */
export function courseOutcomeOverrideEntry(outcome: CourseOutcome, userId: string, reason: string, at: Date): FinalSkill {
  return { level: outcome, decider: "TEACHER", userId, reason, at: at.toISOString() };
}
