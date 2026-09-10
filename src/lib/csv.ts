/**
 * CSV writing, as pure functions.
 *
 * This lives here rather than inside the export route because the three ways a
 * CSV export goes wrong are all escaping bugs, and escaping is only worth
 * trusting once it has tests: a comma or a newline inside a value that breaks
 * the column count, a quote that is not doubled, and a value that a spreadsheet
 * decides is a formula.
 *
 * The last one is not cosmetic. A cell whose text begins with `=`, `+`, `-` or
 * `@` is evaluated on open by Excel, Numbers and LibreOffice, and an audit log
 * carries text a stranger typed. So every such value is prefixed with an
 * apostrophe, which those programs read as "this is text".
 */

/**
 * Byte order mark. Excel on Windows reads a UTF-8 file without one as cp1252,
 * which turns every Turkish character into mojibake ("Aşama" -> "AÅŸama").
 */
export const CSV_BOM = "\uFEFF";

/** RFC 4180 line ending. Excel is the reason, not the specification. */
export const CSV_EOL = "\r\n";

/** Prefix marker for a value a spreadsheet would otherwise evaluate. */
const FORMULA_GUARD = "'";

const LEADS_A_FORMULA = /^[=+\-@]/;

/**
 * One field, always quoted. Quoting unconditionally costs a few bytes and
 * removes the entire class of "this particular value needed quotes" bugs.
 */
export function csvField(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const guarded = LEADS_A_FORMULA.test(text) ? FORMULA_GUARD + text : text;
  return `"${guarded.replaceAll('"', '""')}"`;
}

/** One line, without its line ending. */
export function csvRow(values: readonly unknown[]): string {
  return values.map(csvField).join(",");
}

/** A whole document: BOM, CRLF between rows and after the last one. */
export function csvDocument(rows: readonly (readonly unknown[])[]): string {
  return CSV_BOM + rows.map((row) => csvRow(row) + CSV_EOL).join("");
}

/**
 * A filename a browser and a mail gateway both accept: ASCII, no spaces, no
 * quotes. Anything else in the prefix is dropped rather than transliterated,
 * because a `Content-Disposition` filename is a header value, not display text.
 */
export function csvFilename(prefix: string, date: Date): string {
  const safe = prefix.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return `${safe || "export"}-${day}.csv`;
}
