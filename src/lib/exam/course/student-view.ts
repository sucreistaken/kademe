import type { Section } from "../types";
import { COURSE_TESTS, courseSections } from "./catalog";
import type { CourseConfig, CourseOutcome, CourseResult } from "./types";

/**
 * What a course test shows its student (spec 2026-10-28, "Teacher and
 * student"). Pure and safe for client code: the candidate screens and the
 * server both use it.
 */

/**
 * The name on the student's screens: a course test is called by its German
 * name ("Abschlusstest B1") in every interface language, whatever the stored
 * exam is named; any other exam keeps its stored name. Takes the exam's frozen
 * blueprint config (`ctx.assessment.config`), which has `course` for a course
 * test only.
 */
export function candidateTestName(stored: string, config: { course?: Pick<CourseConfig, "key"> } | null | undefined): string {
  const course = config?.course;
  return (course ? COURSE_TESTS[course.key]?.germanName : undefined) ?? stored;
}

/**
 * A released course result as the student gets it: the outcome, the points per
 * section, the course to continue in and, when it applies, the skill to
 * practise. No question, no key, no CEFR level and no percentage; the field
 * names avoid the ones `candidateSafe` strips from a student body.
 */
export type StudentCourseResult = {
  outcome: CourseOutcome;
  /** In the order of the test (Lesen, Sprachbausteine, Hören, Schreiben, Sprechen). */
  sections: Array<{ section: Section; points: number; max: number }>;
  total: number;
  max: number;
  /** The course to continue in, e.g. "B1.2". Null when the teacher changed the outcome the course was worked out for. */
  recommendation: string | null;
  /** Not passed only for speaking or writing: practise that skill. Null otherwise. */
  focus: "SPEAKING" | "WRITING" | null;
};

/**
 * `computed.course` of a finished result, shaped for the student, or null while
 * any section is still undecided. `finalOutcome` is the teacher's final word
 * when it is PASS or FAIL (the override path); the recommendation and the
 * focus were worked out for the computed outcome, so they are left out when the
 * teacher's outcome is a different one (the teacher then tells the student).
 */
export function studentCourseResult(course: CourseResult | null | undefined, finalOutcome?: string | null): StudentCourseResult | null {
  if (!course || course.total === null || course.outcome === null) return null;
  const sections: StudentCourseResult["sections"] = [];
  for (const plan of courseSections(course.key)) {
    const s = course.sections[plan.section];
    if (!s) continue;
    if (s.pending || s.points === null) return null;
    sections.push({ section: plan.section, points: s.points, max: s.max });
  }
  if (sections.length === 0) return null;
  const outcome: CourseOutcome = finalOutcome === "PASS" || finalOutcome === "FAIL" ? finalOutcome : course.outcome;
  const agrees = outcome === course.outcome;
  return {
    outcome,
    sections,
    total: course.total,
    max: course.max,
    recommendation: agrees ? course.recommendation : null,
    focus: agrees ? course.focus : null,
  };
}
