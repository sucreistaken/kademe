/**
 * The choices one matching row (or one text-insertion gap) offers. Pure, so
 * the ordering and the keyboard rules are tested without a browser.
 *
 * A target already chosen for another row sinks to the bottom of the list
 * (it stays pickable: picking it moves it, because some formats do fit more
 * than one row) and says where it is used. The "0 / fits nobody" target is
 * never "used": several rows may rightly choose it.
 */

export type MatchChoice<T> = {
  target: T;
  /** This row's own current pick. */
  selected: boolean;
  /** Row ids (other than this one) that hold this target, in row order. */
  usedBy: string[];
};

/** The row ids that hold each target, in row order. */
export function holders(rowOrder: readonly string[], matches: Readonly<Record<string, string>>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const rowId of rowOrder) {
    const target = matches[rowId];
    if (!target) continue;
    out.set(target, [...(out.get(target) ?? []), rowId]);
  }
  return out;
}

/**
 * The targets in the order the row's list shows them: free ones first (in their
 * own order), then those another row holds, dimmed.
 */
export function matchChoices<T extends { id: string; badge: string }>(
  targets: readonly T[],
  matches: Readonly<Record<string, string>>,
  rowId: string,
  rowOrder: readonly string[],
): MatchChoice<T>[] {
  const held = holders(rowOrder, matches);
  const entries = targets.map((target): MatchChoice<T> => {
    const others = target.badge === "0" ? [] : (held.get(target.id) ?? []).filter((id) => id !== rowId);
    return { target, selected: matches[rowId] === target.id, usedBy: others };
  });
  return [...entries.filter((e) => e.usedBy.length === 0), ...entries.filter((e) => e.usedBy.length > 0)];
}

/** The index the arrow, Home and End keys move to in a list of `count` options, or null for any other key. Arrows wrap. */
export function moveIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  const step = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
  if (!step) return null;
  if (current < 0) return step > 0 ? 0 : count - 1;
  return (current + step + count) % count;
}

/** Typing a letter jumps to the next option wearing it (A, B, ... or 0), after `from`, wrapping; -1 when none does. */
export function typeaheadIndex(badges: readonly string[], key: string, from: number): number {
  if (key.length !== 1) return -1;
  const wanted = key.toLocaleUpperCase("de");
  for (let k = 1; k <= badges.length; k += 1) {
    const i = (from + k + badges.length) % badges.length;
    if (badges[i].toLocaleUpperCase("de") === wanted) return i;
  }
  return -1;
}
