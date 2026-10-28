import { describe, expect, it } from "vitest";
import {
  alreadyInvited,
  claimFor,
  cleanStudentName,
  COURSE_FORM_CHOICES,
  COURSE_KINDS,
  courseChoiceValue,
  courseFormOf,
  courseKeyOfChoice,
  courseKeysOfKind,
  courseTotals,
  csvFileName,
  decodeCsv,
  examWait,
  inviteFirstInvalid,
  listWait,
  MAX_STUDENT_ROWS,
  parseStudentRows,
  readyStudents,
  studentsCsv,
  studentsTsv,
  tidyStudentName,
} from "./rows";

const one = (text: string) => parseStudentRows(text).rows;

describe("tidyStudentName: a name typed all in lower case gets its capitals", () => {
  it("capitalises every word, Turkish letters by Turkish rules", () => {
    expect(tidyStudentName("kadir ay", "tr")).toBe("Kadir Ay");
    expect(tidyStudentName("ilker şahin", "tr")).toBe("İlker Şahin");
    expect(tidyStudentName("ayşe-nur yılmaz", "tr")).toBe("Ayşe-Nur Yılmaz");
  });

  it("uses the manager's language for the dotted i", () => {
    expect(tidyStudentName("ingrid weber", "en")).toBe("Ingrid Weber");
  });

  it("keeps a name with any capital letter exactly as typed", () => {
    expect(tidyStudentName("van der Berg", "tr")).toBe("van der Berg");
    expect(tidyStudentName("KADİR AY", "tr")).toBe("KADİR AY");
    expect(tidyStudentName("Mary-Ann McDonald", "en")).toBe("Mary-Ann McDonald");
  });

  it("is what the preview and the invitation both get", () => {
    expect(parseStudentRows("kadir ay , selamlar@gmail.com", "tr").rows[0]).toMatchObject({ fullName: "Kadir Ay", email: "selamlar@gmail.com", problem: null });
  });
});

describe("parseStudentRows: names and e-mails", () => {
  it("reads 'Ad Soyad, e-posta' lines, with Turkish letters", () => {
    expect(one("Ayşe Yılmaz, ayse@ornek.com\nŞule Çağlar, sule@ornek.com")).toEqual([
      { line: 1, fullName: "Ayşe Yılmaz", email: "ayse@ornek.com", claimed: null, problem: null },
      { line: 2, fullName: "Şule Çağlar", email: "sule@ornek.com", claimed: null, problem: null },
    ]);
  });

  it("splits on semicolon and tab as well, and accepts the e-mail first", () => {
    expect(one("Can Demir; can@ornek.com")[0]).toMatchObject({ fullName: "Can Demir", email: "can@ornek.com", problem: null });
    expect(one("Can\tDemir\tcan@ornek.com")[0]).toMatchObject({ fullName: "Can Demir", email: "can@ornek.com" });
    expect(one("can@ornek.com, Can Demir")[0]).toMatchObject({ fullName: "Can Demir", email: "can@ornek.com" });
  });

  it("reads the 'Name <mail>' form a mail program copies, and mailto:", () => {
    expect(one("Deniz Kaya <deniz@ornek.com>")[0]).toMatchObject({ fullName: "Deniz Kaya", email: "deniz@ornek.com", problem: null });
    expect(one("Deniz Kaya, mailto:deniz@ornek.com")[0]).toMatchObject({ email: "deniz@ornek.com", problem: null });
  });

  it("keeps quoted CSV cells whole and leaves other columns after the e-mail out of the name", () => {
    expect(one('"Yılmaz, Ayşe",ayse@ornek.com,0555 111 22 33,Kurs A')[0]).toMatchObject({ fullName: "Yılmaz, Ayşe", email: "ayse@ornek.com", problem: null });
  });

  it("skips blank lines but keeps the real line numbers", () => {
    expect(one("\n\nAyşe Yılmaz, ayse@ornek.com\n\n  \nCan Demir, can@ornek.com").map((r) => r.line)).toEqual([3, 6]);
  });

  it("skips a spreadsheet's column titles on the first line", () => {
    const parsed = parseStudentRows("Ad Soyad;E-posta\nAyşe Yılmaz;ayse@ornek.com");
    expect(parsed.header).toBe(true);
    expect(parsed.rows).toEqual([{ line: 2, fullName: "Ayşe Yılmaz", email: "ayse@ornek.com", claimed: null, problem: null }]);
    expect(parseStudentRows("Name,Email\nAda Lovelace,ada@example.com").rows).toHaveLength(1);
  });

  it("does not take a real first student for a header", () => {
    const parsed = parseStudentRows("Ad Soyad Yok\nAyşe Yılmaz, ayse@ornek.com");
    expect(parsed.header).toBe(false);
    expect(parsed.rows[0]).toMatchObject({ line: 1, problem: "EMAIL" });
  });

  it("strips a byte order mark from an uploaded file", () => {
    expect(one("﻿Ayşe Yılmaz, ayse@ornek.com")[0]).toMatchObject({ fullName: "Ayşe Yılmaz", problem: null });
  });

  it("reads a CEFR level on the line as that student's claim", () => {
    expect(one("Ayşe Yılmaz, ayse@ornek.com, b1")[0]).toMatchObject({ fullName: "Ayşe Yılmaz", claimed: "B1", problem: null });
    expect(one("A2, Can Demir, can@ornek.com")[0]).toMatchObject({ fullName: "Can Demir", claimed: "A2" });
  });
});

describe("parseStudentRows: problems are marked, never dropped", () => {
  it("marks an invalid or missing e-mail", () => {
    expect(one("Ayşe Yılmaz, ayse@ornek")[0].problem).toBe("EMAIL");
    expect(one("Ayşe Yılmaz, ayse ornek.com")[0].problem).toBe("EMAIL");
    expect(one("Ayşe Yılmaz")[0].problem).toBe("EMAIL");
    expect(one("Ayşe Yılmaz, a@b@c.com")[0].problem).toBe("EMAIL");
  });

  it("marks a missing or too short name", () => {
    expect(one("ayse@ornek.com")[0]).toMatchObject({ fullName: "", problem: "NAME" });
    expect(one("A, ayse@ornek.com")[0].problem).toBe("NAME");
  });

  it("marks the second use of an e-mail, in any letter case, and only the second", () => {
    const rows = one("Ayşe Yılmaz, ayse@ornek.com\nAyşe Y., AYSE@ornek.com\nCan Demir, can@ornek.com");
    expect(rows.map((r) => r.problem)).toEqual([null, "DUPLICATE", null]);
  });

  it("an invalid e-mail wins over a duplicate and a bad name", () => {
    expect(one("A, nope")[0].problem).toBe("EMAIL");
  });

  it("reads at most MAX_STUDENT_ROWS rows and says there were more", () => {
    const text = Array.from({ length: MAX_STUDENT_ROWS + 3 }, (_, i) => `Öğrenci ${i}, s${i}@ornek.com`).join("\n");
    const parsed = parseStudentRows(text);
    expect(parsed.rows).toHaveLength(MAX_STUDENT_ROWS);
    expect(parsed.tooMany).toBe(true);
    expect(listWait(parsed)).toBe("TOO_MANY");
  });
});

describe("readyStudents and listWait", () => {
  it("waits on an empty list and on any marked row", () => {
    expect(listWait(parseStudentRows("  \n "))).toBe("EMPTY");
    expect(listWait(parseStudentRows("Ayşe Yılmaz, ayse@ornek.com\nCan, can@"))).toBe("PROBLEMS");
    expect(readyStudents(parseStudentRows("Ayşe Yılmaz, ayse@ornek.com\nCan, can@"))).toBeNull();
  });

  it("lets a clean list through", () => {
    const parsed = parseStudentRows("Ayşe Yılmaz, ayse@ornek.com\nCan Demir, can@ornek.com\nDeniz Kaya, deniz@ornek.com");
    expect(listWait(parsed)).toBeNull();
    expect(readyStudents(parsed)?.map((r) => r.email)).toEqual(["ayse@ornek.com", "can@ornek.com", "deniz@ornek.com"]);
  });
});

describe("cleanStudentName", () => {
  it("collapses spaces and refuses an address or brackets in the name", () => {
    expect(cleanStudentName("  Ayşe   Yılmaz ")).toBe("Ayşe Yılmaz");
    expect(cleanStudentName("ayse@ornek.com")).toBeNull();
    expect(cleanStudentName("<b>Ayşe</b>")).toBeNull();
    expect(cleanStudentName("x".repeat(121))).toBeNull();
  });
});

describe("claimFor", () => {
  it("uses the row's own level, then the batch's, and none on placement", () => {
    expect(claimFor({ claimed: "A2" }, "LEVEL_VERIFICATION", "B1")).toBe("A2");
    expect(claimFor({ claimed: null }, "LEVEL_VERIFICATION", "B1")).toBe("B1");
    expect(claimFor({ claimed: null }, "LEVEL_VERIFICATION", null)).toBeNull();
    expect(claimFor({ claimed: "A2" }, "PLACEMENT", "B1")).toBeNull();
  });

  it("a course test has no claim, whatever the line or the batch says", () => {
    expect(claimFor({ claimed: "A2" }, "COURSE_TEST", "B1")).toBeNull();
    expect(claimFor({ claimed: null }, "COURSE_TEST", "B1")).toBeNull();
  });
});

describe("the result's CSV and copy text", () => {
  const students = [
    { fullName: "Ayşe Yılmaz", email: "ayse@ornek.com", url: "https://kademe.example/a/tok1", expires: "28 Eki 2026" },
    { fullName: "=HYPERLINK(\"x\")", email: "evil@ornek.com", url: "https://kademe.example/a/tok2", expires: "28 Eki 2026" },
  ];
  const headers = ["Ad Soyad", "E-posta", "Sınav", "Link", "Son gün"] as const;

  it("writes a BOM, the titles and one row per student with the chosen delimiter", () => {
    const csv = studentsCsv(students.slice(0, 1), headers, "Yerleştirme sınavı", ";");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual(["Ad Soyad;E-posta;Sınav;Link;Son gün", "Ayşe Yılmaz;ayse@ornek.com;Yerleştirme sınavı;https://kademe.example/a/tok1;28 Eki 2026", ""]);
  });

  it("quotes a cell holding the delimiter and never lets a cell start a formula", () => {
    const csv = studentsCsv(students, headers, "Sınav, B1", ",");
    expect(csv).toContain('"Sınav, B1"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("round-trips: the parser reads the CSV it wrote", () => {
    const parsed = parseStudentRows(studentsCsv(students.slice(0, 1), headers, "Yerleştirme sınavı", ";"));
    expect(parsed.header).toBe(true);
    expect(parsed.rows[0]).toMatchObject({ fullName: "Ayşe Yılmaz", email: "ayse@ornek.com", problem: null });
  });

  it("copies everything tab separated with titles", () => {
    expect(studentsTsv(students.slice(0, 1), ["Ad Soyad", "E-posta", "Link"])).toBe("Ad Soyad\tE-posta\tLink\nAyşe Yılmaz\tayse@ornek.com\thttps://kademe.example/a/tok1");
  });

  it("names the file in plain ASCII", () => {
    expect(csvFileName("Yerleştirme sınavı İleri", "2026-10-14")).toBe("yerlestirme-sinavi-ileri-davetler-2026-10-14.csv");
    expect(csvFileName("???", "2026-10-14")).toBe("sinav-davetler-2026-10-14.csv");
  });
});

describe("the wizard's steps", () => {
  it("never lets the address run past an unready list or exam", () => {
    expect(inviteFirstInvalid({ listReady: false, examReady: true })).toBe("list");
    expect(inviteFirstInvalid({ listReady: true, examReady: false })).toBe("exam");
    expect(inviteFirstInvalid({ listReady: true, examReady: true })).toBeNull();
  });

  it("the exam step waits for a choice, and on verification for every row's claim", () => {
    const rows = [{ claimed: null }, { claimed: "A2" as const }];
    expect(examWait({ mode: null, rows, batch: null })).toBe("EXAM");
    expect(examWait({ mode: "PLACEMENT", rows, batch: null })).toBeNull();
    expect(examWait({ mode: "LEVEL_VERIFICATION", rows, batch: null })).toBe("CLAIM");
    expect(examWait({ mode: "LEVEL_VERIFICATION", rows, batch: "B1" })).toBeNull();
    expect(examWait({ mode: "LEVEL_VERIFICATION", rows: [{ claimed: "C1" }], batch: null })).toBeNull();
  });

  it("the exam step of a course test never waits for a claim", () => {
    expect(examWait({ mode: "COURSE_TEST", rows: [{ claimed: null }, { claimed: null }], batch: null })).toBeNull();
  });

  it("names the rows that already have an open invitation, in any letter case", () => {
    expect(alreadyInvited([{ email: "Ayse@Ornek.com" }, { email: "can@ornek.com" }], ["ayse@ornek.com"])).toEqual(["Ayse@Ornek.com"]);
    expect(alreadyInvited([{ email: "can@ornek.com" }], [])).toEqual([]);
  });
});

describe("the course test choice (spec 2026-10-28)", () => {
  it("offers the two kinds, each with its four courses in level order", () => {
    expect(COURSE_KINDS).toEqual(["INTERIM", "FINAL"]);
    expect(courseKeysOfKind("INTERIM")).toEqual(["A1.1", "A2.1", "B1.1", "B2.1"]);
    expect(courseKeysOfKind("FINAL")).toEqual(["A1", "A2", "B1", "B2"]);
  });

  it("turns a course into the exam-choice value of its ready exam, and back", () => {
    expect(courseChoiceValue("B1.1")).toBe("template:course-b1-1");
    expect(courseChoiceValue("B1")).toBe("template:course-b1");
    for (const kind of COURSE_KINDS) {
      for (const key of courseKeysOfKind(kind)) expect(courseKeyOfChoice(courseChoiceValue(key))).toBe(key);
    }
  });

  it("does not take another exam for a course", () => {
    expect(courseKeyOfChoice("template:placement")).toBeNull();
    expect(courseKeyOfChoice("blueprint:course-b1")).toBeNull();
    expect(courseKeyOfChoice("template:course-c1")).toBeNull();
    expect(courseKeyOfChoice("")).toBeNull();
  });

  it("maps the form picker to the invite's courseForm: automatic is null", () => {
    expect(COURSE_FORM_CHOICES).toEqual(["AUTO", "A", "B"]);
    expect(courseFormOf("AUTO")).toBeNull();
    expect(courseFormOf("A")).toBe("A");
    expect(courseFormOf("B")).toBe("B");
  });

  it("knows what a form is worth: 56 points for a Zwischentest, 74 for an Abschlusstest", () => {
    for (const key of courseKeysOfKind("INTERIM")) expect(courseTotals(key).points).toBe(56);
    for (const key of courseKeysOfKind("FINAL")) expect(courseTotals(key).points).toBe(74);
    expect(courseTotals("B1.1").minutes).toBe(59);
    expect(courseTotals("B1").minutes).toBe(95);
  });

  it("waits for the course once a kind is picked, and for the exam before that", () => {
    const rows = [{ claimed: null }];
    expect(examWait({ mode: null, rows, batch: null })).toBe("EXAM");
    expect(examWait({ mode: null, rows, batch: null, courseKind: "INTERIM" })).toBe("COURSE");
    // A course test needs no claimed level.
    expect(examWait({ mode: "COURSE_TEST", rows, batch: null, courseKind: "FINAL" })).toBeNull();
  });
});

describe("decodeCsv", () => {
  it("reads UTF-8", () => {
    expect(decodeCsv(new TextEncoder().encode("Şule Çağlar, sule@ornek.com"))).toBe("Şule Çağlar, sule@ornek.com");
  });

  it("falls back for a file that is not UTF-8 instead of failing", () => {
    // "Ş" in Windows-1254 is 0xDE, which alone is not valid UTF-8.
    const text = decodeCsv(new Uint8Array([0xde, 0x75, 0x6c, 0x65]));
    expect(text).toHaveLength(4);
    expect(text.endsWith("ule")).toBe(true);
  });
});
