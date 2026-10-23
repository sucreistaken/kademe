/**
 * The date a student result sheet carries. The panel's student copy and the
 * student's own print page both use it, so the two always show the same day:
 * the day a teacher finalized the result, else the day the exam was finished
 * (or started). Never the day the sheet is printed.
 */
export function studentSheetDate(r: { finalizedAt?: Date | null; examDate?: Date | null }): Date | null {
  return r.finalizedAt ?? r.examDate ?? null;
}

/** The exam day of an attempt, as the panel report prints it. */
export function examDateOf(attempt: { completedAt?: Date | null; startedAt?: Date | null }): Date | null {
  return attempt.completedAt ?? attempt.startedAt ?? null;
}
