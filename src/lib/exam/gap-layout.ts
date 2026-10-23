/**
 * Splits a typed gap prompt into display blocks: prose, a table or a form.
 *
 * Display only. Nothing is stored; the prompt text stays the single source and
 * the {{gN}} markers inside the blocks are left for the renderer to turn into inputs.
 *
 * Table: a header row, a separator row ("|---|---|") and rows with the same number of cells.
 * Bank authors who write a table as bare lines ("Fund | Angabe | Weiteres", two or more
 * consecutive lines with the same number of " | " cells and no separator) get the same
 * table, with the first line as the header.
 * Form: two or more consecutive "Label: ... {{gN}} ..." lines.
 * Anything else stays prose.
 */

export type GapBlock =
  | { kind: "prose"; text: string }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "form"; rows: { label: string; rest: string }[] };

const FORM_LINE = /^([^:{}]{1,40}):\s*(.*\{\{g\d+\}\}.*)$/;
const SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function cellsOf(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const hasPipe = (line: string) => line.includes("|");
/** A bare table line separates its cells with a pipe that has a space on both sides. */
const hasBareCells = (line: string) => / \| /.test(line);

/** The table starting at `lines[i]`, with the index after its last line, or null. */
function tableAt(lines: string[], i: number): { header: string[]; rows: string[][]; end: number } | null {
  if (!hasPipe(lines[i]) || i + 1 >= lines.length) return null;
  const header = cellsOf(lines[i]);
  if (header.length < 2) return null;
  if (SEPARATOR.test(lines[i + 1]) && hasPipe(lines[i + 1])) {
    if (cellsOf(lines[i + 1]).length !== header.length) return null;
    const rows: string[][] = [];
    let j = i + 2;
    while (j < lines.length && hasPipe(lines[j]) && cellsOf(lines[j]).length === header.length) {
      rows.push(cellsOf(lines[j]));
      j++;
    }
    return rows.length ? { header, rows, end: j } : null;
  }
  if (!hasBareCells(lines[i])) return null;
  const rows: string[][] = [];
  let j = i + 1;
  while (j < lines.length && hasBareCells(lines[j]) && cellsOf(lines[j]).length === header.length) {
    rows.push(cellsOf(lines[j]));
    j++;
  }
  return rows.length ? { header, rows, end: j } : null;
}

export function splitGapLayout(text: string): GapBlock[] {
  const lines = text.split("\n");
  const blocks: GapBlock[] = [];
  let prose: string[] = [];
  const flush = () => {
    const joined = prose.join("\n").replace(/^\n+|\n+$/g, "");
    if (joined.trim()) blocks.push({ kind: "prose", text: joined });
    prose = [];
  };
  let i = 0;
  while (i < lines.length) {
    const table = tableAt(lines, i);
    if (table) {
      flush();
      blocks.push({ kind: "table", header: table.header, rows: table.rows });
      i = table.end;
      continue;
    }
    if (FORM_LINE.test(lines[i])) {
      let j = i;
      const rows: { label: string; rest: string }[] = [];
      while (j < lines.length) {
        const m = lines[j].match(FORM_LINE);
        if (!m) break;
        rows.push({ label: m[1].trim(), rest: m[2] });
        j++;
      }
      if (rows.length >= 2) {
        flush();
        blocks.push({ kind: "form", rows });
        i = j;
        continue;
      }
    }
    prose.push(lines[i]);
    i++;
  }
  flush();
  return blocks;
}

/** True when the prompt has a table or a form block, so the plain prose path can stay untouched otherwise. */
export function hasGapLayout(text: string): boolean {
  return splitGapLayout(text).some((b) => b.kind !== "prose");
}
