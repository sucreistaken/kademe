/**
 * The student results file, pure. Excel on a Turkish machine splits on ";"
 * (the comma is its decimal mark), the English one on ","; a byte order mark
 * first makes Excel read UTF-8. A cell is never allowed to run as a formula
 * (OWASP CSV injection): text a student typed, like a name, is written as text.
 */

export const CSV_BOM = "﻿";
export type Delimiter = ";" | ",";

/** A cell starting with = + - @ or a tab/CR is prefixed with an apostrophe so it stays text. */
export function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** One cell: line breaks flattened, formula guard, quoted when it holds the delimiter, a quote or a break. */
export function csvCell(value: string | null | undefined, delimiter: Delimiter): string {
  const v = safeCell((value ?? "").replace(/\r\n|[\r\n\u2028\u2029]/g, " "));
  return v.includes(delimiter) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
}

/** The whole file: BOM, the titles, one line per row, CRLF after every line. An empty value is an empty cell. */
export function resultsCsv(headers: readonly string[], rows: readonly (readonly (string | null | undefined)[])[], delimiter: Delimiter): string {
  const line = (cells: readonly (string | null | undefined)[]) => cells.map((c) => csvCell(c, delimiter)).join(delimiter);
  return `${CSV_BOM}${[headers, ...rows].map(line).join("\r\n")}\r\n`;
}

/** The downloaded file's name, plain ASCII: "ogrenci-sonuclari-2026-10-14.csv". */
export const resultsFileName = (day: string): string => `ogrenci-sonuclari-${day}.csv`;
