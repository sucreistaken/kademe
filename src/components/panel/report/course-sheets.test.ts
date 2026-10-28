import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudentSheet } from "@/components/candidate/exam/student-sheet";
import { candidateT } from "@/i18n/candidate";
import { CANDIDATE_LOCALES } from "@/i18n/locale";
import { managerT } from "@/i18n/manager";
import type { PanelLocale } from "@/i18n/locale";
import { COMMON_WRITING_ERRORS, CRITERION_LABEL_DE, SPEAKING_CRITERIA, WRITING_CRITERIA, type CourseResult } from "@/lib/exam/course/types";
import type { StudentAnalysis } from "@/lib/exam/student-analysis";
import { buildCourseReport, courseStudentResult, type CourseReportGrading, type CourseReportSource } from "./course-model";
import { CourseReportSheet } from "./course-report-sheet";
import { DetailSheet } from "./detail-sheet";
import type { DetailSection } from "./detail-model";
import { TEACHER_COPY_LOCALE } from "./model";
import tr from "@/i18n/messages/screens.tr.json";
import en from "@/i18n/messages/screens.en.json";
import de from "@/i18n/messages/screens.de.json";

/**
 * The printed course test, rendered the way the report page renders it: the
 * German Bewertungsbogen for the teacher (owner rule: the teacher copy is German
 * only) and the student's copy in the student's language. Neither carries a CEFR
 * level; the student's carries no criterion and no question either.
 */

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const passed: CourseResult = {
  key: "B1",
  form: "A",
  sections: {
    READING: { points: 9, max: 10, pending: false },
    GRAMMAR: { points: 22, max: 25, pending: false },
    LISTENING: { points: 8, max: 10, pending: false },
    WRITING: { points: 7, max: 9, pending: false },
    SPEAKING: { points: 10, max: 20, pending: false },
  },
  total: 56,
  max: 74,
  pct: 75.7,
  outcome: "FAIL",
  reasons: ["SPEAKING_BELOW_MIN"],
  recommendation: "B1.2",
  focus: "SPEAKING",
};

const writing: CourseReportGrading = {
  itemResponseId: "w1",
  status: "CONFIRMED",
  courseProposal: {
    kind: "COURSE_RUBRIC",
    section: "WRITING",
    criteria: WRITING_CRITERIA.map((id, i) => ({ id, points: [3, 2, 2][i], max: 3, rationale: "x" })),
    commonErrors: ["VERB_POSITION"],
    advice: "Nebensätze mit weil üben.",
  },
  coursePoints: { points: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 2 }, commonErrors: ["VERB_POSITION", "SPELLING"] },
  reason: null,
};

const speakingTask = (id: string, points: number[]): CourseReportGrading => ({
  itemResponseId: id,
  status: "CONFIRMED",
  courseProposal: {
    kind: "COURSE_RUBRIC",
    section: "SPEAKING",
    criteria: SPEAKING_CRITERIA.map((c, i) => ({ id: c, points: points[i], max: 4, rationale: "x" })),
    advice: "Mehr Verbindungswörter.",
  },
  coursePoints: { points: Object.fromEntries(SPEAKING_CRITERIA.map((c, i) => [c, points[i]])) },
  reason: null,
});

const SECTIONS = ["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"];

const source: CourseReportSource = {
  status: "FINAL",
  schoolName: "Campus German",
  studentName: "Anna Muster",
  examDate: new Date("2026-10-23T09:00:00Z"),
  teacherName: "Frau Beispiel",
  finalizedAt: new Date("2026-10-24T09:00:00Z"),
  attemptId: "7f0c2c1e-1111-4222-8333-444455556666",
  sections: SECTIONS,
  config: { key: "B1", form: "A", rules: { passPct: 65, secondHalfPct: 59, firstHalfPct: 43.75, speakingMinPct: 60, writingContentZeroFails: true } },
  course: passed,
  finalOutcome: "FAIL",
  skillOverrides: {},
  nameOf: {},
  runs: SECTIONS.map((section) => ({ id: `run-${section}`, section })),
  responses: [
    { id: "w1", sectionRunId: "run-WRITING", sequence: 30 },
    { id: "s1", sectionRunId: "run-SPEAKING", sequence: 40 },
    { id: "s2", sectionRunId: "run-SPEAKING", sequence: 41 },
    { id: "s3", sectionRunId: "run-SPEAKING", sequence: 42 },
  ],
  gradings: [writing, speakingTask("s1", [2, 2, 2, 2, 2]), speakingTask("s2", [3, 2, 2, 2, 2]), speakingTask("s3", [2, 2, 2, 2, 2])],
};

function sheet(over: Partial<CourseReportSource> = {}, locale: PanelLocale = TEACHER_COPY_LOCALE) {
  const r = buildCourseReport({ ...source, ...over }, "secret");
  if (!r.ok) throw new Error("expected a sheet");
  return renderToStaticMarkup(createElement(CourseReportSheet, { model: r.model, t: managerT(locale), locale }));
}

describe("the German Bewertungsbogen", () => {
  it("prints the header of the paper sheet: school, test, form, maximum, name, course, date and teacher", () => {
    const html = sheet();
    const visible = text(html);
    expect(html).toContain('lang="de"');
    for (const s of [
      "Campus German",
      "Bewertungsbogen",
      "Abschlusstest B1 · Version A",
      "Schriftlich 54 Punkte + Mündlich 20 Punkte · Maximale Punktzahl: 74",
      "Name:",
      "Anna Muster",
      "Kurs / Niveau:",
      "Datum:",
      "23. Oktober 2026",
      "Lehrkraft:",
      "Frau Beispiel",
    ]) {
      expect(visible, s).toContain(s);
    }
  });

  it("prints the parts in telc order with their points, the total and the Einstufung", () => {
    const visible = text(sheet());
    const at = (s: string) => visible.indexOf(s);
    for (const part of ["Lesen", "Sprachbausteine", "Hören", "Schreiben", "Sprechen"]) expect(visible, part).toContain(part);
    expect(at("Lesen")).toBeLessThan(at("Sprachbausteine"));
    expect(at("Sprachbausteine")).toBeLessThan(at("Hören"));
    expect(at("Hören")).toBeLessThan(at("Schreiben"));
    expect(visible).toContain("Prüfungsteil max. erreicht Bemerkung");
    expect(visible).toContain("Lesen 10 9");
    expect(visible).toContain("Sprachbausteine 25 22");
    expect(visible).toContain("Inhalt 3 · Wortschatz 2 · Grammatik 2");
    expect(visible).toContain("Aufgaben: 10 · 11 · 10. Durchschnitt, abgerundet.");
    expect(visible).toContain("GESAMT 74 56 Einstufung: Nicht bestanden");
  });

  it("prints the writing criteria and every box of Häufigste Fehler, the decided ones ticked", () => {
    const html = sheet();
    const visible = text(html);
    for (const c of WRITING_CRITERIA) expect(visible).toContain(CRITERION_LABEL_DE[c]);
    expect(visible).toContain("Punkte Schreiben 9 7");
    expect(visible).toContain("Häufigste Fehler");
    for (const label of Object.values(COMMON_WRITING_ERRORS)) expect(html).toContain(escape(label));
    const ticked = [...html.matchAll(/data-ticked="true"/g)].length;
    expect(ticked).toBe(2);
    expect(visible).toContain(`${COMMON_WRITING_ERRORS.SPELLING} (angekreuzt)`);
    expect(visible).not.toContain(`${COMMON_WRITING_ERRORS.TOO_SHORT} (angekreuzt)`);
    expect(visible).toContain("Kommentar zur Schreibaufgabe Förderhinweis: Nebensätze mit weil üben.");
  });

  it("prints the speaking criteria per task and the floored mean", () => {
    const visible = text(sheet());
    for (const c of SPEAKING_CRITERIA) expect(visible).toContain(CRITERION_LABEL_DE[c]);
    expect(visible).toContain("Aufgabe 1 Aufgabe 2 Aufgabe 3");
    expect(visible).toContain("Summe 20 10 11 10");
    expect(visible).toContain("Gesamtpunktzahl Sprechen: 10 / 20 (Durchschnitt der Aufgaben, abgerundet)");
  });

  it("closes with the Gesamtauswertung, the reason in German, the rules and both signature lines", () => {
    const visible = text(sheet());
    for (const s of [
      "Gesamtauswertung",
      "56 von 74 Punkten",
      "75,7 %",
      "Nicht bestanden",
      "Weiter im Kurs B1.2",
      "Schwerpunkt Sprechen",
      "Sprechen unter dem Minimum: 10 Punkte, mindestens 12 nötig.",
      "Für das Bestehen gilt eine Mindestgrenze von 65 % der Gesamtpunktzahl. Das entspricht 49 von 74 Punkten.",
      "Bei weniger als 12 von 20 Punkten im Sprechen ist der Test nicht bestanden",
      "Wer im Schreiben 0 Punkte im Bereich Inhalt erhält",
      "Unterschrift Lehrkraft",
      "Gesehen (Teilnehmer/in)",
      "Prüfcode",
      "Erstellt mit Kademe",
    ]) {
      expect(visible, s).toContain(s);
    }
  });

  it("has no CEFR level: no level bar, no level wording", () => {
    const html = sheet();
    const visible = text(html);
    for (const s of [de.resultReport.overall, de.resultReport.skills, de.resultReport.scaleNote, de.resultReport.title, "GER", "Pre-A1"]) expect(visible, s).not.toContain(s);
    expect(html).not.toMatch(/rounded-full bg-(accent|line)"/);
  });

  it("is German only: no Turkish letter and none of the Turkish or English labels", () => {
    const visible = text(sheet());
    expect(visible).not.toMatch(/[ışğİŞĞ]/u);
    for (const word of [tr.courseReport.title, en.courseReport.title, en.courseReport.signatureTeacher, tr.courseReport.signatureTeacher, "Passed", "Geçti"]) {
      expect(visible, word).not.toContain(word);
    }
  });

  it("says Bestanden for a pass, with the next course and no reason", () => {
    const pass: CourseResult = { ...passed, outcome: "PASS", reasons: [], recommendation: "B2.1", focus: null, sections: { ...passed.sections, SPEAKING: { points: 16, max: 20, pending: false } }, total: 62, pct: 83.8 };
    const visible = text(sheet({ course: pass, finalOutcome: "PASS" }));
    expect(visible).toContain("Einstufung: Bestanden");
    expect(visible).toContain("Weiter im Kurs B2.1");
    expect(visible).not.toContain("Nicht bestanden");
    expect(visible).not.toContain("Schwerpunkt");
    expect(visible).not.toContain("unter dem Minimum");
  });

  it("prints what the points said, the teacher's outcome and the reason when the teacher changed it", () => {
    const visible = text(
      sheet({
        finalOutcome: "PASS",
        skillOverrides: { COURSE_OUTCOME: { level: "PASS", decider: "TEACHER", userId: "u2", reason: "Mündlich nachgeholt.", at: "2026-10-24T08:00:00.000Z" } },
        nameOf: { u2: "Herr Kontrolle" },
      }),
    );
    expect(visible).toContain("Einstufung: Bestanden");
    expect(visible).toContain("Nach den Punkten: Nicht bestanden. Die Lehrkraft hat das Ergebnis geändert.");
    expect(visible).toContain("Begründung: Mündlich nachgeholt.");
    expect(visible).toContain("Lehrkraft: Herr Kontrolle");
    expect(visible).toContain("Den weiteren Kurs legt die Lehrkraft fest.");
    expect(visible).not.toContain("Weiter im Kurs B1.2");
  });

  it("marks open and proposed numbers and explains both, never printing a zero for them", () => {
    const pending: CourseResult = {
      ...passed,
      sections: { ...passed.sections, WRITING: { points: null, max: 9, pending: true } },
      total: null,
      pct: null,
      outcome: null,
      reasons: [],
      recommendation: null,
      focus: null,
    };
    const proposedSpeaking: CourseReportGrading = { ...speakingTask("s1", [2, 2, 2, 2, 2]), status: "AI_PROPOSED", coursePoints: null };
    const html = sheet({
      course: pending,
      finalOutcome: null,
      gradings: [{ ...writing, status: "PENDING", courseProposal: null, coursePoints: null }, proposedSpeaking, ...source.gradings.slice(2)],
    });
    const visible = text(html);
    expect(visible).toContain("Schreiben 9 offen");
    expect(visible).toContain("GESAMT 74 offen Einstufung: offen");
    expect(visible).toContain("Inhalt offen · Wortschatz offen · Grammatik offen");
    expect(visible).toContain("Punkte Schreiben 9 offen");
    expect(visible).toContain("2 (vorgeschlagen)");
    // The speaking part rests on a proposed task, so its points are marked in the table of parts as well.
    expect(visible).toContain("Sprechen 20 10 (vorgeschlagen)");
    expect(visible).toContain(de.courseReport.legendOpen);
    expect(visible).toContain(de.courseReport.legendProposed);
    expect(html).not.toContain('data-ticked="true"');
  });
});

describe("the courseReport dictionary", () => {
  it("has a German text that differs from the Turkish and the English one, with no Turkish letter", () => {
    for (const [key, value] of Object.entries(de.courseReport)) {
      expect(value, key).not.toBe(tr.courseReport[key as keyof typeof tr.courseReport]);
      expect(value, key).not.toBe(en.courseReport[key as keyof typeof en.courseReport]);
      expect(value, key).not.toMatch(/[ışğİŞĞ]/u);
    }
  });
});

describe("the detail sheet of a course test", () => {
  const sections: DetailSection[] = [
    {
      section: "GRAMMAR",
      kind: "OBJECTIVE",
      level: null,
      correct: 1,
      total: 1,
      hasTfng: false,
      topics: [],
      blocks: [{ heading: null, questions: [{ kind: "CHOICE", n: 1, level: "B1", skillTag: "grammar.x", stem: "Ich ___ müde.", given: "bin", key: "bin", mark: "correct" }] }],
    },
    {
      section: "WRITING",
      kind: "PRODUCTIVE",
      level: null,
      tasks: [
        { n: 1, prompt: "Schreiben Sie eine E-Mail.", text: "Sehr geehrte Frau Neumann", typedInstead: false, transcript: null, words: 4, level: null, decidedBy: null, teacherNote: null, criteria: [], summary: null },
      ],
    },
  ];
  const detail = (levels: boolean) => text(renderToStaticMarkup(createElement(DetailSheet, { sections, studentName: "Anna Muster", t: managerT("de"), locale: "de", levels })));

  it("prints the questions and the student's text with no level at all", () => {
    const visible = detail(false);
    expect(visible).toContain("Frage 1");
    expect(visible).toContain("Ich ___ müde.");
    expect(visible).toContain("Sehr geehrte Frau Neumann");
    expect(visible).not.toContain(de.resultReport.levelLabel);
    expect(visible).not.toContain(de.resultReport.teacherLevel);
    expect(visible).not.toMatch(/Frage 1 B1/);
  });

  it("keeps the levels for a level exam (control)", () => {
    const visible = detail(true);
    expect(visible).toContain(de.resultReport.levelLabel);
    expect(visible).toContain(de.resultReport.teacherLevel);
    expect(visible).toMatch(/Frage 1 B1/);
  });
});

describe("the student's copy of a course test", () => {
  const analysis: StudentAnalysis = {
    sections: [
      { section: "GRAMMAR", right: 22, wrong: 2, blank: 1 },
      { section: "WRITING", right: 0, wrong: 0, blank: 0, teacherAssessed: true },
    ],
    missedTopics: [{ topic: "relative-clause", label: "Relativsätze", missed: 2, asked: 3 }],
    strongTopics: [],
  };
  const result = courseStudentResult({ visibility: "FULL", course: passed, finalOutcome: "FAIL", analysis, feedback: null });
  const studentSheet = (locale: (typeof CANDIDATE_LOCALES)[number]) =>
    renderToStaticMarkup(createElement(StudentSheet, { schoolName: "Campus German", studentName: "Anna Muster", examName: "Abschlusstest B1", date: null, result, locale }));

  it.each(CANDIDATE_LOCALES)("%s: Nicht bestanden in the student's language, the points, the next course, the focus and the topics", (locale) => {
    const t = candidateT(locale);
    const html = studentSheet(locale);
    expect(html).toContain(`lang="${locale}"`);
    expect(html).toContain("Abschlusstest B1");
    expect(html).toContain(escape(t("analysis.courseOutcomeFAIL")));
    expect(html).toContain(escape(t("analysis.courseTotal", { points: 56, max: 74 })));
    expect(html).toContain(escape(t("analysis.coursePoints", { points: 10, max: 20 })));
    expect(html).toContain(escape(t("analysis.courseNext", { course: "B1.2" })));
    expect(html).toContain(escape(t("analysis.courseFocusSPEAKING")));
    expect(html).toContain("Relativsätze");
    expect(html).not.toContain(escape(t("analysis.levelLabel")));
  });

  it("carries no criterion, no common error, no question, no percentage and no level", () => {
    const html = studentSheet("en");
    const visible = text(html);
    for (const c of [...WRITING_CRITERIA, ...SPEAKING_CRITERIA]) expect(visible, c).not.toContain(CRITERION_LABEL_DE[c]);
    for (const label of Object.values(COMMON_WRITING_ERRORS)) expect(html).not.toContain(escape(label));
    expect(visible).not.toContain("Nebensätze");
    expect(visible).not.toContain("%");
    expect(visible).not.toMatch(/\b(A0|A1|A2|B2|C1|C2)\b/);
    expect(visible).not.toContain("22 right");
  });
});

describe("the report page", () => {
  const page = readFileSync(path.resolve(process.cwd(), "src/app/(manager)/exam/students/[id]/report/page.tsx"), "utf8");

  it("prints a course test's teacher copy and its detail in German, without levels", () => {
    expect(page).toMatch(/<CourseReportSheet [^>]*t=\{sheetT\} locale=\{TEACHER_COPY_LOCALE\}/);
    expect(page).toMatch(/<DetailSheet [^>]*levels=\{false\} t=\{sheetT\} locale=\{TEACHER_COPY_LOCALE\}/);
    expect(page).not.toMatch(/<CourseReportSheet [^>]*\bt=\{t\}/);
  });

  it("prints a course test's student copy from the course result, in the student's language", () => {
    expect(page).toContain("courseStudentResult({");
    expect(page).toContain("examName={candidateTestName(assessment.blueprintName, cfg)}");
    expect(page).toContain('assessment.mode === "COURSE_TEST"');
  });
});
