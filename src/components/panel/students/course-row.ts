import { courseOutcomeOverrideOf, effectiveCourseOutcome } from "@/components/panel/course/outcome";
import { courseTotals } from "@/components/panel/course/totals";
import type { FinalSkill } from "@/db/schema/exam";
import type { BlueprintConfig } from "@/lib/exam/blueprint";
import type { CourseForm, CourseKey } from "@/lib/exam/course/types";
import type { ComputedResult } from "@/lib/exam/result";

/**
 * What the student list shows for a course test instead of a CEFR level (spec
 * 2026-10-28): which course, which form, and once the result can say, the
 * outcome and the points ("Bestanden", 52 of 74). Pure, so the list, the
 * search and the CSV agree.
 */
export type StudentCourse = {
  key: CourseKey;
  form: CourseForm | null;
  /** The points once every section is decided; null while any is pending. */
  points: number | null;
  max: number;
  outcome: "PASS" | "FAIL" | null;
  /** The outcome is the frozen one (the teacher finalized), not a draft. */
  final: boolean;
  /** The recommended course ("B1.2"), once the result can say. */
  recommendation: string | null;
};

export function studentCourseOf(input: {
  /** `blueprintSnapshot.course` of the invitation. */
  course: BlueprintConfig["course"] | undefined;
  computed: ComputedResult | null | undefined;
  skillOverrides?: Record<string, FinalSkill> | null;
  /** `exam_results.final_outcome` once finalized. */
  finalOutcome: string | null | undefined;
  final: boolean;
}): StudentCourse | null {
  const config = input.course;
  if (!config) return null;
  const computed = input.computed?.course ?? null;
  // The frozen outcome wins once the result is final; a final result that carries none falls back to what the engine and the teacher say.
  const frozen = input.finalOutcome === "PASS" || input.finalOutcome === "FAIL" ? input.finalOutcome : null;
  const outcome = (input.final ? frozen : null) ?? effectiveCourseOutcome(computed, courseOutcomeOverrideOf(input.skillOverrides));
  return {
    key: config.key,
    form: computed?.form ?? config.form,
    points: computed?.total ?? null,
    max: computed?.max ?? courseTotals(config.key).points,
    outcome,
    final: input.final,
    recommendation: computed?.recommendation ?? null,
  };
}

/** What the list's search also looks through for a course test, so typing "B1.1" or "form a" finds it: "B1.1 form A". */
export function courseSearchText(course: StudentCourse | null | undefined): string {
  return course ? `${course.key}${course.form ? ` form ${course.form}` : ""}` : "";
}
