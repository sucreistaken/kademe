/**
 * Which gap of a multiple-choice cloze is open, and what a pick does. Pure, so
 * the rules (first empty gap by default, a pick moves on to the next empty one,
 * keys 1-4) are tested without a browser.
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

/** Index of the option a key picks ("1" is the first), or null when the key is not an option of this gap. */
export function optionOfKey(key: string, count: number): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const at = Number(key) - 1;
  return at < count ? at : null;
}
