/**
 * The two integrity columns of the student results file: the number of
 * serious flags and the teacher's integrity decision. Blank when the exam was
 * not proctored or the student has not started, so an empty cell never reads
 * as "no flags".
 */
export type IntegrityColumnSource = {
  integrity: string;
  brief: { serious: number; outcome: "VALID" | "RETAKE" | "INVALID" | null } | undefined;
};

export function integrityCells(
  src: IntegrityColumnSource,
  outcomeLabel: (o: "VALID" | "RETAKE" | "INVALID") => string,
  undecided: string,
): [string, string] {
  if (src.integrity === "NONE" || src.integrity === "PENDING" || !src.brief) return ["", ""];
  return [String(src.brief.serious), src.brief.outcome ? outcomeLabel(src.brief.outcome) : undecided];
}
