/**
 * Which gap of a multiple-choice cloze is open, and what a pick does. Pure, so
 * the rules (first empty gap by default, a pick moves on to the next empty one,
 * the number keys) are tested without a browser.
 */

const MARKER = /^\{\{([A-Za-z0-9_-]+)\}\}$/;

/** The text split into plain pieces and gap markers; a marker piece carries its gap id. */
export function clozeParts(passage: string): Array<{ text: string } | { gapId: string }> {
  return passage
    .split(/(\{\{[A-Za-z0-9_-]+\}\})/g)
    .filter((p) => p !== "")
    .map((p) => {
      const m = p.match(MARKER);
      return m ? { gapId: m[1] } : { text: p };
    });
}

/** Gap ids in the order they stand in the text; a gap the text does not mention is left out. */
export function gapOrder(parts: ReturnType<typeof clozeParts>, known: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const p of parts) {
    if ("gapId" in p && known.has(p.gapId) && !seen.has(p.gapId)) {
      seen.add(p.gapId);
      order.push(p.gapId);
    }
  }
  return order;
}

/** The gap id the student clicked, tagged with the question it was clicked on. */
export type ClickedGap = { sequence: number; gapId: string } | null;

/** A click on another question is not this question's click: a new text opens on its first empty gap. */
export function clickedFor(clicked: ClickedGap, sequence: number): string | null {
  return clicked && clicked.sequence === sequence ? clicked.gapId : null;
}

/** "Gap 3 of 12": the open gap's place in the text. 0 when the gap is not in the text. */
export function gapPosition(order: readonly string[], id: string | null): { n: number; total: number } {
  return { n: id ? order.indexOf(id) + 1 : 0, total: order.length };
}

/**
 * Where an arrow key moves focus among the options of the open gap, or null for
 * any other key. Arrows only move focus; they never pick (Enter, Space, a click
 * or a number key pick), so browsing the words cannot answer a gap.
 */
export function focusTarget(key: string, at: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return (at + 1) % count;
    case "ArrowUp":
    case "ArrowLeft":
      return (at - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** The option that takes the Tab stop: the picked word, or the first when the saved word is not one of the options. */
export function tabStop(options: readonly string[], chosen: string): number {
  const at = options.indexOf(chosen);
  return at >= 0 ? at : 0;
}

const isFilled = (gaps: Record<string, string> | undefined, id: string) => !!gaps?.[id]?.trim();

/**
 * The open gap: the one the student clicked, else the first empty gap, else the
 * first gap (everything is filled, the student is looking things over).
 */
export function activeGap(order: readonly string[], gaps: Record<string, string> | undefined, clicked: string | null): string | null {
  if (clicked && order.includes(clicked)) return clicked;
  return order.find((id) => !isFilled(gaps, id)) ?? order[0] ?? null;
}

/**
 * Where a pick moves on to: the next empty gap after `from` (wrapping round to
 * the start), or `from` itself when no other gap is empty.
 */
export function nextAfterPick(order: readonly string[], gaps: Record<string, string> | undefined, from: string): string {
  const at = order.indexOf(from);
  for (let step = 1; step < order.length; step++) {
    const id = order[(at + step) % order.length];
    if (!isFilled(gaps, id)) return id;
  }
  return from;
}

/**
 * Index of the option a key picks ("1" is the first), or null when the key is not an option of this gap.
 * `count` is the open gap's own number of words (four in the bank's texts, three in a course test's a/b/c gaps):
 * with three words "4" is no option key, so it is left alone.
 */
export function optionOfKey(key: string, count: number): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const at = Number(key) - 1;
  return at < count ? at : null;
}

/**
 * Whether the number keys belong to the cloze item. They act when focus is inside the
 * item (a gap, an option), on the page body or on a heading the screen moved
 * focus to; a button or link outside the item (the bottom bar, Mark, the
 * strip) keeps its own key presses, so a pick never pulls focus off it.
 */
export function clozeKeyApplies(focus: { insideItem: boolean; onOutsideControl: boolean }): boolean {
  return focus.insideItem || !focus.onOutsideControl;
}
