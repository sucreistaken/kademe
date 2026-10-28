import { COURSE_FORMS, type CourseForm } from "./types";

/**
 * Which of a course test's two parallel forms an invitation gets (spec
 * 2026-10-28, "Teacher and student"). Pure, so the invite action, the single
 * invite and the exam flow's fallback share one rule and one test.
 *
 * "Seen" means the student already sat that form of the same course test in
 * this school (server/exam-exposure.ts: courseFormsSeenBy).
 */

export const isCourseForm = (v: unknown): v is CourseForm => v === "A" || v === "B";

/**
 * The form a student has not sat yet, when they sat exactly one of the two.
 * Null when they sat none or both: then nothing speaks for either form.
 */
export function unseenForm(seen: ReadonlySet<CourseForm>): CourseForm | null {
  const open = COURSE_FORMS.filter((f) => !seen.has(f));
  return open.length === 1 ? open[0] : null;
}

/** One invitation outside a list, and the exam flow's fallback for an invitation without a form: the unseen form, else A. */
export const singleInviteForm = (seen: ReadonlySet<CourseForm>): CourseForm => unseenForm(seen) ?? "A";

/**
 * The form of every row of a pasted list, in list order. `forced` (the
 * teacher chose A or B) wins for every row. Otherwise row 1, 2, 3, 4 ... get
 * A, B, A, B ..., except a student who sat exactly one form before, who gets
 * the other (one who sat both is alternated as usual). The alternation
 * follows the row's position, so the same list always splits the same way
 * and a returning student never shifts anyone else's form.
 */
export function assignCourseForms(seen: ReadonlyArray<ReadonlySet<CourseForm>>, forced: CourseForm | null): CourseForm[] {
  return seen.map((s, i) => forced ?? unseenForm(s) ?? COURSE_FORMS[i % COURSE_FORMS.length]);
}
