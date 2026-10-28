import { courseSections } from "@/lib/exam/course/catalog";
import { SPEAKING_MAX, WRITING_MAX, type CourseKey } from "@/lib/exam/course/types";

/**
 * What one form of a course test is worth and takes: the catalog's points (one
 * per objective unit, the writing and speaking rubrics) and the sum of its
 * section minutes. 56 points for a Zwischentest, 74 for an Abschlusstest.
 */
export function courseTotals(key: CourseKey): { points: number; minutes: number } {
  const plan = courseSections(key);
  return {
    points: plan.reduce((sum, p) => sum + (p.section === "WRITING" ? WRITING_MAX : p.section === "SPEAKING" ? SPEAKING_MAX : p.units), 0),
    minutes: plan.reduce((sum, p) => sum + p.minutes, 0),
  };
}
