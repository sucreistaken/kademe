/**
 * A small CSV / TSV reader for the bank's question file. Pure, no dependency.
 *
 * It reads what spreadsheets write: a file saved as CSV (comma, or semicolon
 * from a Turkish or German Excel), and cells copied from Excel or Google
 * Sheets and pasted (tab separated). Quoted cells may hold the separator, a
 * doubled quote and line breaks, so a reading text can sit in one cell. A
 * leading byte order mark and Excel's `sep=;` line are understood.
 */

export type Delimiter = "," | ";" | "\t";

export type ParsedTable = {
  delimiter: Delimiter;
  /** Every non-empty record, each with the 1-based line it starts on. */
  rows: Array<{ line: number; cells: string[] }>;
  /** A quote was opened and never closed: the rest of the text was read as one cell. */
  unterminated: boolean;
};

const SEP_LINE = /^sep=(.)\r?\n/i;

/** The separator of the first record: tab when there is one (a paste), else the more frequent of `;` and `,`. */
export function detectDelimiter(text: string): Delimiter {
  let tabs = 0;
  let semis = 0;
  let commas = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (ch === "\n" || ch === "\r") break;
      if (ch === "\t") tabs++;
      else if (ch === ";") semis++;
      else if (ch === ",") commas++;
    }
  }
  if (tabs > 0) return "\t";
  return semis > commas ? ";" : ",";
}

export function parseDelimited(input: string, forced?: Delimiter): ParsedTable {
  let text = input.replace(/^﻿/, "");
  let lineOffset = 0;
  let delimiter: Delimiter | undefined = forced;
  const sep = SEP_LINE.exec(text);
  if (sep) {
    const ch = sep[1];
    if (!delimiter && (ch === "," || ch === ";" || ch === "\t")) delimiter = ch;
    text = text.slice(sep[0].length);
    lineOffset = 1;
  }
  const d = delimiter ?? detectDelimiter(text);

  const rows: ParsedTable["rows"] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1 + lineOffset;
  let startLine = line;
  const endCell = () => {
    cells.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (cells.some((c) => c.trim() !== "")) rows.push({ line: startLine, cells });
    cells = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else {
        if (ch === "\r") {
          // A line break inside a cell is kept as \n, whatever the file used.
          if (text[i + 1] === "\n") i++;
          cell += "\n";
          line++;
        } else {
          if (ch === "\n") line++;
          cell += ch;
        }
      }
      continue;
    }
    if (ch === '"' && cell.trim() === "") {
      // A quote opens a quoted cell only at its start (spaces before it are dropped).
      cell = "";
      quoted = true;
    } else if (ch === d) {
      endCell();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
      startLine = line;
    } else {
      cell += ch;
    }
  }
  const unterminated = quoted;
  if (cell !== "" || cells.length > 0) endRow();
  return { delimiter: d, rows, unterminated };
}

/** One cell for a CSV file: quoted when it holds the separator, a quote or a line break. */
export function csvCell(value: string, delimiter: Delimiter): string {
  return value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A whole CSV file, with CRLF line ends and a byte order mark so Excel reads it as UTF-8. */
export function toCsv(rows: string[][], delimiter: Delimiter): string {
  return "﻿" + rows.map((r) => r.map((c) => csvCell(c, delimiter)).join(delimiter)).join("\r\n") + "\r\n";
}
