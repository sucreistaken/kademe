/**
 * Text insertion (Goethe / ÖSD "Welcher Satz passt in welche Lücke?"): a reading
 * passage with numbered gaps and a MATCHING item whose rows are those gaps.
 * The bank writes the gaps in a few ways, so linking looks for all of them:
 *
 *   passage            row text
 *   "(1) ________"     "Lücke (1)"
 *   "[1] ___"          "Lücke [1]"
 *   "[Lücke 1]"        "Lücke 1"
 *
 * `linkInsertion` pairs every row with exactly one marker in the passage, so
 * the screen can draw the marker itself as the gap's button. It is all or
 * nothing: when a single row cannot be found (or is ambiguous) it returns
 * null and the item falls back to one drop-down per row. Pure text work, no
 * markup in the stored passage.
 */

import type { PassageBlock } from "./passage-blocks";

export type GapPiece ={ kind: "text"; text: string } | { kind: "gap"; rowId: string; number: number };

export type InsertionLink = {
  /** The gap number of each row id ("Lücke (2)" gives 2). */
  numbers: ReadonlyMap<string, number>;
  /** One entry per input text: its pieces in reading order. A text with no gap is a single text piece. */
  pieces: GapPiece[][];
};

/** "Lücke 3", "Lücke (3)", "Lücke [3]:", "[3]", "(3)" or "3": the gap number a row names, or null for any other row text. */
const ROW_LABEL = /^\s*(?:Lücke|Luecke|Stelle|Position)?\s*[[(]?\s*(\d{1,2})\s*[\])]?\s*[:.]?\s*$/iu;

export function gapRowNumber(text: string): number | null {
  const m = ROW_LABEL.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 ? n : null;
}

const FILL = "(?:_{2,}|…|\\.{3,})";
const NUM = "(\\d{1,2})";
/** "[1]", "[Lücke 1]", "(1)" or "(Lücke 1)", with an optional blank before or after; or a bare number between two blanks. */
const MARKER = new RegExp(
  `(?:${FILL}\\s*)?(?:\\[\\s*(?:Lücke\\s*)?${NUM}\\s*\\]|\\(\\s*(?:Lücke\\s*)?${NUM}\\s*\\))(?:\\s*${FILL})?|${FILL}\\s*${NUM}\\s*${FILL}`,
  "gu",
);
/** A marker with a blank next to it, or the word Lücke inside, is surely a gap; a bare "(1)" could be a list number. */
const STRONG = /Lücke|_{2,}|…|\.{3,}/u;

type Found = { text: number; start: number; end: number; n: number; strong: boolean };

/**
 * Pairs each row with its marker in `texts` (the passage's text blocks, in
 * order). Every row must be a gap label with its own number, and every number
 * must be found exactly once, preferring blank-marked ("(1) ____") over bare
 * ("(1)") occurrences, or the result is null.
 */
export function linkInsertion(texts: readonly string[], rows: ReadonlyArray<{ id: string; text: string }>): InsertionLink | null {
  if (rows.length === 0) return null;
  const numbers = new Map<string, number>();
  const rowOf = new Map<number, string>();
  for (const row of rows) {
    const n = gapRowNumber(row.text);
    if (n === null || rowOf.has(n)) return null;
    numbers.set(row.id, n);
    rowOf.set(n, row.id);
  }

  const found: Found[] = [];
  texts.forEach((text, ti) => {
    for (const m of text.matchAll(MARKER)) {
      const n = Number(m[1] ?? m[2] ?? m[3]);
      if (!rowOf.has(n)) continue;
      found.push({ text: ti, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, n, strong: STRONG.test(m[0]) });
    }
  });

  const chosen: Found[] = [];
  for (const n of rowOf.keys()) {
    const all = found.filter((f) => f.n === n);
    const strong = all.filter((f) => f.strong);
    const pool = strong.length > 0 ? strong : all;
    if (pool.length !== 1) return null;
    chosen.push(pool[0]);
  }

  const pieces = texts.map((text, ti): GapPiece[] => {
    const mine = chosen.filter((f) => f.text === ti).sort((a, b) => a.start - b.start);
    const out: GapPiece[] = [];
    let at = 0;
    for (const f of mine) {
      if (f.start > at) out.push({ kind: "text", text: text.slice(at, f.start) });
      out.push({ kind: "gap", rowId: rowOf.get(f.n) as string, number: f.n });
      at = f.end;
    }
    if (at < text.length || out.length === 0) out.push({ kind: "text", text: text.slice(at) });
    return out;
  });
  return { numbers, pieces };
}

/**
 * `linkInsertion` over the blocks of a passage as the screen draws them: the
 * text blocks are searched, a card block counts as an empty text. `pieces[i]`
 * belongs to `blocks[i]`.
 */
export function linkPassage(blocks: readonly PassageBlock[], rows: ReadonlyArray<{ id: string; text: string }>): InsertionLink | null {
  return linkInsertion(
    blocks.map((b) => (b.kind === "text" ? b.lines.join("\n") : "")),
    rows,
  );
}
