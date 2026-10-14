import { describe, expect, it } from "vitest";
import { CSV_BOM, csvCell, resultsCsv, resultsFileName, safeCell } from "./csv";
import { filterStudents, parseTab } from "./filter";

describe("results CSV", () => {
  it("starts with a byte order mark and ends every line with CRLF", () => {
    const out = resultsCsv(["a", "b"], [["1", "2"]], ";");
    expect(out.startsWith(CSV_BOM)).toBe(true);
    expect(out).toBe(`${CSV_BOM}a;b\r\n1;2\r\n`);
  });

  it("separates with ; in Turkish and , in English", () => {
    expect(resultsCsv(["a", "b"], [["x", "y"]], ";")).toContain("x;y");
    expect(resultsCsv(["a", "b"], [["x", "y"]], ",")).toContain("x,y");
  });

  it("quotes a cell that holds the delimiter or a quote, and doubles the quote", () => {
    expect(csvCell("a;b", ";")).toBe('"a;b"');
    expect(csvCell("a,b", ";")).toBe("a,b");
    expect(csvCell("a,b", ",")).toBe('"a,b"');
    expect(csvCell('say "hi"', ";")).toBe('"say ""hi"""');
  });

  it("flattens line breaks inside a cell", () => {
    expect(csvCell("a\r\nb\nc", ";")).toBe("a b c");
  });

  it("keeps a formula from running", () => {
    for (const bad of ["=1+1", "+49", "-2", "@SUM(A1)", "\tx", "\rx"]) expect(safeCell(bad).startsWith("'")).toBe(true);
    expect(csvCell('=HYPERLINK("http://x";"y")', ";")).toBe(`"'=HYPERLINK(""http://x"";""y"")"`);
    expect(safeCell("Ayşe")).toBe("Ayşe");
  });

  it("writes empty cells for missing values and keeps Turkish characters", () => {
    const out = resultsCsv(["Ad", "Seviye", "Okuma"], [["Şükrü Çağlar", null, undefined]], ";");
    expect(out).toBe(`${CSV_BOM}Ad;Seviye;Okuma\r\nŞükrü Çağlar;;\r\n`);
  });

  it("names the file in plain ASCII", () => {
    expect(resultsFileName("2026-10-14")).toBe("ogrenci-sonuclari-2026-10-14.csv");
  });
});

describe("list filter shared with the page", () => {
  const all = [
    { status: "NOT_STARTED", name: "Ali Veli", email: "ali@x.de" },
    { status: "FINAL", name: "Işık Şen", email: "isik@x.de" },
    { status: "AWAITING_REVIEW", name: "Can", email: "can@x.de" },
  ] as const;

  it("reads a tab, falling back to all", () => {
    expect(parseTab("final")).toBe("final");
    expect(parseTab("nope")).toBe("all");
    expect(parseTab(null)).toBe("all");
  });

  it("filters by tab and by name or e-mail with the Turkish locale", () => {
    expect(filterStudents(all, "final", "", "tr").map((r) => r.name)).toEqual(["Işık Şen"]);
    expect(filterStudents(all, "all", "IŞIK", "tr").map((r) => r.name)).toEqual(["Işık Şen"]);
    expect(filterStudents(all, "review", "", "tr").map((r) => r.name)).toEqual(["Can"]);
    expect(filterStudents(all, "all", "@x.de", "tr")).toHaveLength(3);
  });
});
