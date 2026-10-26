import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { managerT } from "@/i18n/manager";
import type { PanelLocale } from "@/i18n/locale";
import type { FeedbackContent, StudentFeedbackStore } from "@/lib/exam/student-feedback";
import { buildReport, TEACHER_COPY_LOCALE, type ReportModel, type ReportSource } from "./model";
import { ReportSheet } from "./report-sheet";
import { DetailSheet } from "./detail-sheet";
import type { DetailSection } from "./detail-model";
import tr from "@/i18n/messages/screens.tr.json";
import en from "@/i18n/messages/screens.en.json";
import de from "@/i18n/messages/screens.de.json";

/**
 * The printed teacher copy is German whatever language the panel is open in (owner 2026-10-25:
 * "Raporda Türkçe metinler yer alabiliyor. Tamamiyle Almanca olabilir rapor"). These render the
 * two sheets the way the report page does and read the markup.
 */

const feedback: FeedbackContent = {
  strengths: ["Gute Satzstellung im Hauptsatz."],
  improve: [{ topic: "Perfekt", why: "Das Hilfsverb fehlt noch oft.", example: { student: "ich habe gegangen", correct: "ich bin gegangen" } }],
  nextStep: "Zehn Sätze im Perfekt schreiben.",
};
const store = (locale: StudentFeedbackStore["locale"], approved: FeedbackContent | null = feedback): StudentFeedbackStore => ({
  draft: null,
  draftedAt: null,
  draftRunId: null,
  approved,
  approvedBy: "u1",
  approvedAt: "2026-10-24T10:00:00.000Z",
  edited: false,
  locale,
});

const source: ReportSource = {
  status: "FINAL",
  schoolName: "Sprachschule Muster",
  studentName: "Anna Muster",
  // The name the owner's printed report carried: the Turkish default of the level check template.
  examName: "Dört beceride seviye kontrolü",
  examDate: new Date("2026-10-23T09:00:00Z"),
  sections: ["GRAMMAR", "READING", "WRITING", "SPEAKING"],
  finalOverall: "A1",
  skillLevels: { GRAMMAR: "A0", READING: "B1", WRITING: "A1" },
  mode: "LEVEL_VERIFICATION",
  placement: null,
  teacherName: "Frau Beispiel",
  finalizedAt: new Date("2026-10-24T09:00:00Z"),
  attemptId: "7f0c2c1e-1111-4222-8333-444455556666",
};

function modelOf(over: Partial<ReportSource> = {}): ReportModel {
  const r = buildReport({ ...source, ...over }, "secret");
  if (!r.ok) throw new Error("expected ok");
  return r.model;
}

const summary = (model: ReportModel, locale: PanelLocale) => renderToStaticMarkup(createElement(ReportSheet, { model, t: managerT(locale), locale }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the German teacher copy", () => {
  it("is German whatever the panel language: the page renders it with TEACHER_COPY_LOCALE", () => {
    expect(TEACHER_COPY_LOCALE).toBe("de");
  });

  it("prints German labels, the German exam name and a German date, and no Turkish", () => {
    const html = summary(modelOf(), TEACHER_COPY_LOCALE);
    const visible = text(html);
    expect(html).toContain('lang="de"');
    for (const label of ["Niveaubericht", "Lernende/r", "Prüfung", "Prüfungsdatum", "Gesamtniveau", "Niveaus der Fertigkeiten", "Grammatik", "Lesen", "Schreiben", "Sprechen", "Prüfcode"]) {
      expect(visible, label).toContain(label);
    }
    // The stored Turkish default name reads as its German name.
    expect(visible).toContain("Niveaukontrolle in vier Fertigkeiten");
    expect(visible).not.toContain("Dört beceride");
    // de-DE date for the exam day (23 October 2026 in the school's zone).
    expect(visible).toContain("23. Oktober 2026");
    expect(visible).not.toMatch(/[ışğİŞĞ]/u);
    // None of the Turkish or English labels of the same keys.
    for (const word of ["Öğrenci", "Sınav", "Beceri seviyeleri", "Seviye raporu", "Doğrulama", "STUDENT", "Student", "Exam date", "Skill levels", "Level report"]) {
      expect(visible, word).not.toContain(word);
    }
  });

  it("prints the level sentence and the footer in German", () => {
    const visible = text(summary(modelOf(), "de"));
    expect(visible).toContain(de.resultReport.level.A1);
    expect(visible).toContain(de.resultReport.scaleNote);
    expect(visible).toContain(de.resultReport.verificationHint);
    expect(visible).toContain("Erstellt mit Kademe");
  });

  it("would read Turkish if it were rendered in the panel language (control for the checks above)", () => {
    const visible = text(summary(modelOf(), "tr"));
    expect(visible).toContain("Öğrenci");
    expect(visible).toContain("Seviye raporu");
  });

  it("keeps a name the school typed as typed, and maps the English default and the length suffix", () => {
    expect(text(summary(modelOf({ examName: "Herbstgruppe Oktober" }), "de"))).toContain("Herbstgruppe Oktober");
    expect(text(summary(modelOf({ examName: "Four-skill level check" }), "de"))).toContain("Niveaukontrolle in vier Fertigkeiten");
    expect(text(summary(modelOf({ examName: "Dört beceride seviye kontrolü, 75 dk" }), "de"))).toContain("Niveaukontrolle in vier Fertigkeiten, 75 Min.");
  });
});

describe("A0 on the summary sheet", () => {
  const cellsOf = (html: string) => html.split("<li").slice(1).map((li) => ({ on: (li.match(/rounded-full bg-accent"/g) ?? []).length, off: (li.match(/rounded-full bg-line"/g) ?? []).length }));

  it("has seven cells, A0 to C2, in the bar and in the scale row", () => {
    const html = summary(modelOf(), "de");
    expect(html).toMatch(/>A0<\/span><span[^>]*>A1<\/span><span[^>]*>A2<\/span><span[^>]*>B1<\/span><span[^>]*>B2<\/span><span[^>]*>C1<\/span><span[^>]*>C2<\/span>/);
    for (const c of cellsOf(html)) expect(c.on + c.off).toBe(7);
  });

  it("fills only the A0 cell for an A0 skill, up to the level for the others, none for no level", () => {
    // GRAMMAR A0, READING B1, WRITING A1, SPEAKING none.
    expect(cellsOf(summary(modelOf(), "de")).map((c) => c.on)).toEqual([1, 4, 2, 0]);
  });

  it("prints A0 in the skill row and keeps the Pre-A1 name on the overall level", () => {
    const html = summary(modelOf({ finalOverall: "A0", skillLevels: { GRAMMAR: "A0", READING: "A0" } }), "de");
    expect(html).toMatch(/text-\[17px\] font-bold">A0</);
    expect(text(html)).toContain("Pre-A1");
    expect(text(html)).toContain(de.resultLevel.A0Note);
    expect(text(html)).toContain(de.resultReport.level.A0);
  });
});

describe("the approved feedback on the German summary", () => {
  it("is printed when it is German", () => {
    const visible = text(summary(modelOf({ feedback: store("de") }), "de"));
    expect(visible).toContain("Gute Satzstellung im Hauptsatz.");
    expect(visible).toContain("Zehn Sätze im Perfekt schreiben.");
    expect(visible).not.toContain(de.resultReport.feedbackOnStudentCopy);
  });

  it("is replaced by a German line when it is in the student's language", () => {
    for (const locale of ["tr", "en", "es", "ar"] as const) {
      const html = summary(modelOf({ feedback: store(locale, { ...feedback, strengths: ["Strong word order."] }) }), "de");
      const visible = text(html);
      expect(visible, locale).toContain(de.resultReport.feedbackOnStudentCopy);
      expect(visible, locale).not.toContain("Strong word order.");
      expect(visible, locale).not.toContain("Zehn Sätze");
    }
  });

  it("is absent, with no line, when nothing is approved", () => {
    for (const f of [null, store("de", null), { ...store("tr"), approvedAt: null }]) {
      const visible = text(summary(modelOf({ feedback: f }), "de"));
      expect(visible).not.toContain(de.resultReport.feedbackOnStudentCopy);
      expect(visible).not.toContain(de.resultReport.feedbackTitle);
    }
  });

  it("has a line in all three panel languages", () => {
    for (const d of [tr, en, de]) expect(d.resultReport.feedbackOnStudentCopy.length).toBeGreaterThan(20);
  });
});

describe("the detail sheet in German", () => {
  const sections: DetailSection[] = [
    {
      section: "GRAMMAR",
      kind: "OBJECTIVE",
      level: "A2",
      correct: 1,
      total: 2,
      hasTfng: true,
      topics: [{ topic: "dativ", label: "Dativ", format: false, right: 1, total: 2 }],
      blocks: [
        {
          heading: "Ein Brief",
          questions: [
            { kind: "CHOICE", n: 1, level: "A1", skillTag: "grammar.x", stem: "Ich ___ Anna.", given: "bin", key: "heiße", mark: "wrong" },
            { kind: "ROWS", n: 2, level: "A2", skillTag: "reading.tfng", variant: "TFNG", stem: "Richtig oder falsch?", rows: [{ label: "Anna wohnt in Köln.", given: "R", key: "F", mark: "wrong" }] },
          ],
        },
      ],
    },
    {
      section: "WRITING",
      kind: "PRODUCTIVE",
      level: "A0",
      tasks: [
        {
          n: 1,
          prompt: "Schreiben Sie eine E-Mail.",
          text: "Hallo Anna",
          typedInstead: false,
          transcript: null,
          words: 2,
          level: "A0",
          decidedBy: "Frau Beispiel",
          teacherNote: "Zu wenig Text.",
          criteria: [{ criterion: "RANGE", level: "A0", note: "Kein bewertbarer Satz." }],
          summary: "Es gibt keinen eigenen Satz.",
        },
      ],
    },
  ];
  const detail = (locale: PanelLocale) => text(renderToStaticMarkup(createElement(DetailSheet, { sections, studentName: "Anna Muster", t: managerT(locale), locale })));

  it("prints every label from the German dictionary and none from Turkish or English", () => {
    const visible = detail(TEACHER_COPY_LOCALE);
    for (const label of [
      de.resultReport.detailIntro,
      "Anna Muster - detaillierte Ergebnisse",
      de.resultReport.topicsHeading,
      de.resultReport.topicScoreCol,
      "1 von 2 Antworten richtig",
      "Frage 1",
      "falsch",
      de.resultReport.tfLegend,
      de.resultReport.task,
      de.resultReport.studentText,
      de.resultReport.teacherLevel,
      de.resultReport.criteria,
      "Spektrum",
      "A0 (Pre-A1)",
      de.resultReport.teacherNote,
    ]) {
      expect(visible, label).toContain(label);
    }
    expect(visible).not.toMatch(/[ışğİŞĞ]/u);
    for (const word of [tr.resultReport.detailIntro, tr.resultReport.teacherLevel, en.resultReport.detailIntro, en.resultReport.teacherLevel, "Question 1", "Soru 1"]) {
      expect(visible, word).not.toContain(word);
    }
  });

  it("prints the AI notes and the teacher's typed note as they are", () => {
    const visible = detail("de");
    expect(visible).toContain("Kein bewertbarer Satz.");
    expect(visible).toContain("Es gibt keinen eigenen Satz.");
    expect(visible).toContain("Zu wenig Text.");
  });
});

describe("every label the two sheets print is German in the German dictionary", () => {
  // Values that are the same in every language on purpose.
  const SAME = new Set(["resultLevel.A0", "resultLevel.A0Name", "resultReport.readingText"]);
  const flat = (o: Record<string, unknown>, prefix: string): Array<[string, string]> =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[`${prefix}${k}`, v] as [string, string]] : flat(v as Record<string, unknown>, `${prefix}${k}.`)));
  const used = [
    ...flat(de.resultReport, "resultReport."),
    ...flat(de.sectionName, "sectionName."),
    ...flat(de.resultLevel, "resultLevel."),
    ...Object.entries(de.result).filter(([k]) => k.startsWith("crit")).map(([k, v]) => [`result.${k}`, v as string] as [string, string]),
  ];
  const lookup = (d: Record<string, unknown>, key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], d) as string;

  it("differs from the Turkish and the English text", () => {
    for (const [key, value] of used) {
      if (SAME.has(key)) continue;
      expect(value, key).not.toBe(lookup(tr, key));
      expect(value, key).not.toBe(lookup(en, key));
    }
  });

  it("holds no Turkish letter", () => {
    for (const [key, value] of used) expect(value, key).not.toMatch(/[ışğİŞĞ]/u);
  });
});

describe("the report page", () => {
  // The page needs the database, so its source is read: the two teacher sheets get the German translator, the toolbar keeps the panel's.
  const page = readFileSync(path.resolve(process.cwd(), "src/app/(manager)/exam/students/[id]/report/page.tsx"), "utf8");

  it("renders both teacher sheets with the German translator and locale, not the panel's", () => {
    expect(page).toContain("const sheetT = managerT(TEACHER_COPY_LOCALE);");
    expect(page).toMatch(/<ReportSheet [^>]*t=\{sheetT\} locale=\{TEACHER_COPY_LOCALE\}/);
    expect(page).toMatch(/<DetailSheet [^>]*t=\{sheetT\} locale=\{TEACHER_COPY_LOCALE\}/);
    expect(page).not.toMatch(/<(ReportSheet|DetailSheet) [^>]*\bt=\{t\}/);
  });

  it("keeps the toolbar and the hints in the panel language", () => {
    expect(page).toContain('t("resultReport.printHint")');
    expect(page).toContain('t("resultReport.back")');
  });
});
