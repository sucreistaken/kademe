import type { ItemContent, ItemKey } from "../types";

/**
 * The scored units of one course test item, one point each (spec 2026-10-28,
 * "one point per scored unit, no half points"): a gap, a Richtig/Falsch
 * statement, a matching row, otherwise the item itself. Writing and speaking
 * tasks have none: they are scored by the rubric. Counted like the teacher
 * screens' answer tally, so the panel and the result agree.
 */
export function courseUnits(item: { content: ItemContent; key: ItemKey }): number {
  const c = item.content;
  if (c.kind === "WRITING" || c.kind === "SPEAKING") return 0;
  if (c.kind === "GAP") return c.gaps.length;
  if (c.kind === "TFNG") return c.statements.length;
  if (c.kind === "MATCHING") return c.left.length;
  return 1;
}
