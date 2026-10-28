import { courseSections } from "@/lib/exam/course/catalog";
import { SPEAKING_MAX, WRITING_MAX, type CourseKey } from "@/lib/exam/course/types";
import { isObjectiveSection, type Section } from "@/lib/exam/types";

/**
 * What a course test is worth and takes, from the catalog (spec 2026-10-28):
 * one point per objective unit, the writing rubric (9) and the speaking
 * rubric (20), and the sum of the section minutes.
 */

/** The most a section of this course test can earn: its units, 9 for writing, 20 for speaking. */
export function sectionMaxOf(key: CourseKey, section: Section): number {
  if (section === "WRITING") return WRITING_MAX;
  if (section === "SPEAKING") return SPEAKING_MAX;
  return isObjectiveSection(section) ? (courseSections(key).find((p) => p.section === section)?.units ?? 0) : 0;
}

/** What one form is worth and takes: 56 points for a Zwischentest, 74 for an Abschlusstest. */
export function courseTotals(key: CourseKey): { points: number; minutes: number } {
  const plan = courseSections(key);
  return {
    points: plan.reduce((sum, p) => sum + sectionMaxOf(key, p.section), 0),
    minutes: plan.reduce((sum, p) => sum + p.minutes, 0),
  };
}
