import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { candidateT } from "@/i18n/candidate";
import { CANDIDATE_LOCALES, type CandidateLocale } from "@/i18n/locale";
import type { StudentResult } from "@/lib/exam-flow";
import { StudentSheet } from "./student-sheet";

/** The student's copy: the exam's name in the student's language, never the manager's Turkish template name. */

const result: StudentResult = { visibility: "FULL", released: true, awaitingTeacher: false, levelShown: false };
const A0: StudentResult = {
  visibility: "FULL",
  released: true,
  awaitingTeacher: false,
  levelShown: true,
  overall: "A0",
  skills: [{ section: "GRAMMAR", level: "A0" }],
  analysis: { sections: [{ section: "GRAMMAR", right: 3, wrong: 20, blank: 1 }], missedTopics: [], strongTopics: [] },
};

const sheet = (examName: string, locale: CandidateLocale, r: StudentResult = result) =>
  renderToStaticMarkup(createElement(StudentSheet, { schoolName: "Sprachschule Muster", studentName: "Ada", examName, date: null, result: r, locale }));

describe("the exam name on the student copy", () => {
  it("reads in the student's language for the Turkish default name of the level check", () => {
    for (const locale of CANDIDATE_LOCALES) {
      const html = sheet("Dört beceride seviye kontrolü", locale);
      const name = candidateT(locale)("examNames.levelCheck");
      expect(html, locale).toContain(name);
      if (locale !== "tr") expect(html, locale).not.toContain("Dört beceride");
    }
    expect(sheet("Dört beceride seviye kontrolü", "de")).toContain("Niveaukontrolle in vier Fertigkeiten");
    expect(sheet("Dört beceride seviye kontrolü", "en")).toContain("Four-skill level check");
  });

  it("maps the other two templates and the length suffix, and keeps a name the school typed", () => {
    expect(sheet("Yerleştirme sınavı, 45 dk", "de")).toContain("Einstufungstest, 45 Min.");
    expect(sheet("Quick level screen", "en")).toContain(candidateT("en")("examNames.quickScreen"));
    expect(sheet("Herbstgruppe Oktober", "de")).toContain("Herbstgruppe Oktober");
  });

  it("does not change a name that the student's own print page already mapped", () => {
    const mapped = candidateT("de")("examNames.levelCheck");
    expect(sheet(mapped, "de")).toContain(mapped);
  });
});

describe("A0 on the student copy", () => {
  it("is named A0 (Pre-A1) in every student language, with its explanation, and the sheet runs right to left for Arabic", () => {
    for (const locale of CANDIDATE_LOCALES) {
      const t = candidateT(locale);
      const html = sheet("Test", locale, A0);
      expect(html, locale).toContain(`>${t("analysis.levelA0")}</span>`);
      expect(html, locale).toContain(t("analysis.levelA0Note").replace(/'/g, "&#x27;"));
      expect(html, locale).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`);
    }
  });
});
