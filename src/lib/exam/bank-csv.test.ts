import { describe, expect, it } from "vitest";
import { csvCell, detectDelimiter, parseDelimited, toCsv } from "./bank-csv";

const cells = (text: string) => parseDelimited(text).rows.map((r) => r.cells);

describe("parseDelimited", () => {
  it("reads a plain comma file", () => {
    expect(cells("type,question\nSINGLE_CHOICE,Wie geht's?\n")).toEqual([
      ["type", "question"],
      ["SINGLE_CHOICE", "Wie geht's?"],
    ]);
  });

  it("keeps separators, doubled quotes and line breaks inside a quoted cell", () => {
    const text = 'a,b,c\n"eins, zwei","er sagte ""hallo""","Zeile 1\nZeile 2"\n';
    expect(cells(text)).toEqual([
      ["a", "b", "c"],
      ["eins, zwei", 'er sagte "hallo"', "Zeile 1\nZeile 2"],
    ]);
  });

  it("numbers each record by the line it starts on, across multiline cells", () => {
    const parsed = parseDelimited('h1,h2\n"x\ny\nz",1\nlast,2');
    expect(parsed.rows.map((r) => r.line)).toEqual([1, 2, 5]);
  });

  it("reads CRLF and a lone CR, and turns a CRLF inside a cell into \\n", () => {
    expect(cells('a;b\r\n"1\r\n2";3\r4;5')).toEqual([
      ["a", "b"],
      ["1\n2", "3"],
      ["4", "5"],
    ]);
  });

  it("reads a paste from a spreadsheet (tab separated, quoted multiline cell)", () => {
    const paste = 'tip\tsoru\tmetin\nTRUE_FALSE_NG\tRichtig oder falsch?\t"Absatz eins\nAbsatz ""zwei"""\n';
    const parsed = parseDelimited(paste);
    expect(parsed.delimiter).toBe("\t");
    expect(parsed.rows[1].cells).toEqual(["TRUE_FALSE_NG", "Richtig oder falsch?", 'Absatz eins\nAbsatz "zwei"']);
  });

  it("detects a semicolon file (Turkish or German Excel) and skips the BOM and a sep= line", () => {
    const parsed = parseDelimited('﻿sep=;\ntip;soru\nGAP_FILL;"Ich ___ müde; sehr."\n');
    expect(parsed.delimiter).toBe(";");
    expect(parsed.rows.map((r) => r.cells)).toEqual([
      ["tip", "soru"],
      ["GAP_FILL", "Ich ___ müde; sehr."],
    ]);
    expect(parsed.rows[0].line).toBe(2);
  });

  it("skips empty records and keeps empty cells", () => {
    expect(cells("a,b,c\n\n,,\n1,,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
    ]);
  });

  it("reports an unterminated quote", () => {
    expect(parseDelimited('a,b\n"open,1\n2').unterminated).toBe(true);
    expect(parseDelimited('a,b\n"closed",1').unterminated).toBe(false);
  });

  it("detects the separator from the first record only, ignoring quoted ones", () => {
    expect(detectDelimiter('"a;b;c",d,e\nx;y;z;w')).toBe(",");
    expect(detectDelimiter("a;b,c;d")).toBe(";");
    expect(detectDelimiter("a,b\tc")).toBe("\t");
  });
});

describe("toCsv", () => {
  it("quotes only what needs it and round-trips through the parser", () => {
    expect(csvCell("plain", ",")).toBe("plain");
    expect(csvCell("a;b", ";")).toBe('"a;b"');
    expect(csvCell('say "hi"', ",")).toBe('"say ""hi"""');
    const rows = [
      ["tip", "metin"],
      ["MATCHING", 'Zeile 1\nZeile; 2 "zitiert"'],
    ];
    const text = toCsv(rows, ";");
    expect(text.startsWith("﻿")).toBe(true);
    expect(parseDelimited(text).rows.map((r) => r.cells)).toEqual(rows);
  });
});
