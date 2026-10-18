/**
 * What the finish dialog says is left in the section. Only the kinds with a
 * count above zero are named; an empty list means everything is answered.
 * Pure, so the choice of parts can be tested apart from the wording.
 */
export type FinishPart = "empty" | "partial" | "flagged";

export function finishSummaryParts(counts: { empty: number; partial: number; flagged: number }): Array<{ part: FinishPart; count: number }> {
  const all: Array<{ part: FinishPart; count: number }> = [
    { part: "empty", count: counts.empty },
    { part: "partial", count: counts.partial },
    { part: "flagged", count: counts.flagged },
  ];
  return all.filter((p) => p.count > 0);
}
