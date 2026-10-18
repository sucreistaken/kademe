/** Days of reports the dashboard counts. */
export const PROBLEM_WINDOW_DAYS = 7;

/** The areas the exam's own screens send; any other value is shown as it came. */
export const PROBLEM_AREAS = ["EXAM_END", "SYSTEM_CHECK", "LINK"] as const;
export type ProblemArea = (typeof PROBLEM_AREAS)[number];
export const isProblemArea = (area: string): area is ProblemArea => (PROBLEM_AREAS as readonly string[]).includes(area);

/**
 * Takes a PROBLEM request's message ("EXAM_END: the audio stopped", or just the
 * area when the student wrote nothing; see problemMessage) apart again. A
 * message with no "AREA: " head (older or odd rows) is all note, area null.
 */
export function splitProblemMessage(message: string | null): { area: string | null; note: string } {
  const text = (message ?? "").trim();
  const head = /^([A-Z][A-Z0-9_]{1,39})(?:: ([\s\S]*))?$/.exec(text);
  if (!head) return { area: null, note: text };
  return { area: head[1], note: (head[2] ?? "").trim() };
}

/** The start of the dashboard's window ending at `now`. */
export const problemWindowStart = (now: Date) => new Date(now.getTime() - PROBLEM_WINDOW_DAYS * 86_400_000);
