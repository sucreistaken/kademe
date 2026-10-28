import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CandidateIntl } from "@/components/candidate/Intl";
import { AnalysisView } from "@/components/candidate/exam/AnalysisView";
import { StudentSheet } from "@/components/candidate/exam/student-sheet";
import { candidateT } from "@/i18n/candidate";
import { CANDIDATE_LOCALES, type CandidateLocale } from "@/i18n/locale";
import type { StudentResult } from "@/lib/exam-flow";
import type { StudentCourseResult } from "@/lib/exam/course/student-view";
import { Finished } from "./Finished";

/**
 * The released result of a course test, in the student's language (spec 2026-10-28, "Teacher and
 * student"): passed or not, the points per section, the course to continue in, the topics to practise.
 * Never a question, never a CEFR level, never a percentage, never a colour for the outcome.
 */

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const course: StudentCourseResult = {
  outcome: "PASS",
  sections: [
    { section: "READING", points: 8, max: 10 },
    { section: "GRAMMAR", points: 20, max: 25 },
    { section: "LISTENING", points: 7, max: 10 },
    { section: "WRITING", points: 6, max: 9 },
    { section: "SPEAKING", points: 15, max: 20 },
  ],
  total: 56,
  max: 74,
  recommendation: "B2.1",
  focus: null,
};

const released = (over: Partial<StudentResult> = {}): StudentResult => ({
  visibility: "FULL",
  released: true,
  awaitingTeacher: false,
  // The result row of a level exam would carry these; a course test must not show them.
  levelShown: true,
  overall: "A2",
  outcome: "PASS",
  skills: [{ section: "GRAMMAR", level: "A2" }],
  analysis: {
    sections: [
      { section: "READING", right: 8, wrong: 1, blank: 1 },
      { section: "GRAMMAR", right: 20, wrong: 3, blank: 2 },
      { section: "LISTENING", right: 7, wrong: 2, blank: 1 },
      { section: "WRITING", right: 0, wrong: 0, blank: 0, teacherAssessed: true },
      { section: "SPEAKING", right: 0, wrong: 0, blank: 0, teacherAssessed: true },
    ],
    missedTopics: [{ topic: "dativ", label: "Dativ", missed: 3, asked: 5 }],
    strongTopics: [{ topic: "perfekt", label: "Perfekt", asked: 4 }],
  },
  feedback: { strengths: ["Good reading"], improve: [{ topic: "Dativ", why: "Practise cases." }], nextStep: "Do daily drills." },
  course,
  ...over,
});

function finished(result: StudentResult, locale: CandidateLocale = "en") {
  return renderToStaticMarkup(
    createElement(CandidateIntl, { locale, timeZone: "UTC" } as ComponentProps<typeof CandidateIntl>, [
      createElement(Finished, {
        key: "f",
        token: "t".repeat(43),
        name: "Ada Lovelace",
        result,
        terminated: false,
        terminationReason: null,
        contactEmail: "okul@example.com",
        feedbackAnswered: true,
        sections: ["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"],
        mode: "COURSE_TEST",
      }),
    ]),
  );
}

describe("the finish screen once a course test is released", () => {
  it.each(CANDIDATE_LOCALES)("%s: shows the outcome, the total, the points per section and the course to continue in", (locale) => {
    const t = candidateT(locale);
    const html = finished(released(), locale);
    expect(html).toContain(escape(t("analysis.courseOutcomePASS")));
    expect(html).toContain(escape(t("analysis.courseTotal", { points: 56, max: 74 })));
    for (const { section, points, max } of course.sections) {
      expect(html).toContain(escape(t(`section.${section}`)));
      expect(html).toContain(escape(t("analysis.coursePoints", { points, max })));
    }
    expect(html).toContain(escape(t("analysis.courseNext", { course: "B2.1" })));
    expect(html).not.toContain("analysis.course");
    // The analysis block the screen uses for a level exam: the title, and the print link.
    expect(html).toContain(escape(t("analysis.title")));
    expect(html).toContain("/done/print");
  });

  it("is a different sentence for not passed, in the same box", () => {
    const t = candidateT("en");
    const pass = finished(released());
    const fail = finished(released({ course: { ...course, outcome: "FAIL", recommendation: "B1.2" } }));
    expect(fail).toContain(escape(t("analysis.courseOutcomeFAIL")));
    expect(fail).not.toContain(escape(t("analysis.courseOutcomePASS")));
    expect(fail).toContain(escape(t("analysis.courseNext", { course: "B1.2" })));
    // Colour never follows the result: the box has the same classes either way.
    const box = (html: string) => html.match(/<div data-role="course-outcome" class="([^"]*)"/)?.[1];
    expect(box(pass)).toBeTruthy();
    expect(box(fail)).toBe(box(pass));
    expect(fail).not.toMatch(/(?:text|bg|border)-(?:error|red|success|danger|warn)/);
  });

  it.each(CANDIDATE_LOCALES)("%s: says which skill to practise when it applies, and only then", (locale) => {
    const t = candidateT(locale);
    const speaking = finished(released({ course: { ...course, outcome: "FAIL", recommendation: "B1.2", focus: "SPEAKING" } }), locale);
    expect(speaking).toContain(escape(t("analysis.courseFocusSPEAKING")));
    expect(speaking).not.toContain(escape(t("analysis.courseFocusWRITING")));
    const writing = finished(released({ course: { ...course, outcome: "FAIL", recommendation: "B1.2", focus: "WRITING" } }), locale);
    expect(writing).toContain(escape(t("analysis.courseFocusWRITING")));
    const none = finished(released(), locale);
    expect(none).not.toContain(escape(t("analysis.courseFocusSPEAKING")));
    expect(none).not.toContain(escape(t("analysis.courseFocusWRITING")));
  });

  it("leaves the choice of course to the teacher when none was worked out for this outcome", () => {
    const t = candidateT("en");
    const html = finished(released({ course: { ...course, recommendation: null } }));
    expect(html).toContain(escape(t("analysis.courseNextTeacher")));
    expect(html).not.toContain("Course to continue in");
  });

  it("lists the topics to practise and the approved note from the analysis, and no right, wrong or blank counts", () => {
    const html = finished(released());
    expect(html).toContain("Dativ");
    expect(html).toContain("missed 3 of 5");
    expect(html).toContain("Perfekt");
    expect(html).toContain("Do daily drills.");
    expect(html).not.toMatch(/\d+ (?:right|wrong|blank)/);
    expect(html).not.toContain("Assessed by your teacher");
  });

  it("shows no CEFR level, no level wording and no percentage, although the row carries a level", () => {
    const html = finished(released());
    expect(html).not.toContain("Your level");
    expect(html).not.toContain("Your stated level");
    expect(html).not.toContain(">A2<");
    expect(html).not.toContain("%");
  });

  it("works when only the course result is there (the analysis could not be built)", () => {
    const t = candidateT("en");
    const html = finished(released({ analysis: undefined, feedback: undefined }));
    expect(html).toContain(escape(t("analysis.courseOutcomePASS")));
    expect(html).toContain(escape(t("analysis.coursePoints", { points: 20, max: 25 })));
    expect(html).not.toContain("Your teacher will share your result");
    expect(html).not.toContain("analysis.");
  });

  it("is the old analysis, untouched, for a level exam without a course result", () => {
    const html = finished(released({ course: undefined }));
    expect(html).toContain("8 right");
    expect(html).toContain("Assessed by your teacher");
    expect(html).not.toContain("Passed");
  });
});

describe("the same result as an AnalysisView on its own", () => {
  const view = (result: StudentResult, locale: CandidateLocale = "en") => {
    const t = candidateT(locale);
    return renderToStaticMarkup(
      createElement(AnalysisView, {
        result,
        t: (k: string, v?: Record<string, string | number>) => t(`analysis.${k}` as never, v as never),
        sectionName: (s: string) => t(`section.${s}` as never),
      } as never),
    );
  };

  it("draws nothing without an analysis or a course result", () => {
    expect(view(released({ analysis: undefined, course: undefined }))).toBe("");
  });

  it("keeps the sections in the order of the test", () => {
    const html = view(released());
    const at = (name: string) => html.indexOf(name);
    expect(at("Reading")).toBeLessThan(at("Grammar"));
    expect(at("Grammar")).toBeLessThan(at("Listening"));
    expect(at("Listening")).toBeLessThan(at("Writing"));
    expect(at("Writing")).toBeLessThan(at("Speaking"));
  });
});

describe("the student's printed copy of a course result", () => {
  const sheet = (locale: CandidateLocale, examName = "Abschlusstest B1") =>
    renderToStaticMarkup(
      createElement(StudentSheet, { schoolName: "Campus German", studentName: "Ada", examName, date: null, result: released(), locale }),
    );

  it.each(CANDIDATE_LOCALES)("%s: carries the German name of the test, the outcome and the points", (locale) => {
    const t = candidateT(locale);
    const html = sheet(locale);
    expect(html).toContain("Abschlusstest B1");
    expect(html).toContain(escape(t("analysis.courseOutcomePASS")));
    expect(html).toContain(escape(t("analysis.courseNext", { course: "B2.1" })));
    expect(html).toContain(escape(t("analysis.coursePoints", { points: 15, max: 20 })));
    expect(html).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`);
    expect(html).not.toContain(escape(t("analysis.levelLabel")));
  });
});
