import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { managerT } from "@/i18n/manager";
import type { StoredFeedback } from "@/server/exam-feedback";
import { ExamFeedbackBox, StarsReadout } from "./exam-feedback-box";

const feedback = (over: Partial<StoredFeedback> = {}): StoredFeedback => ({
  overall: 4,
  clarity: 5,
  usability: 3,
  technicalProblem: true,
  comment: "Die Kamera ist einmal ausgefallen.",
  locale: "de",
  createdAt: new Date("2026-10-25T09:30:00Z"),
  ...over,
});

const box = (f: StoredFeedback, locale: "tr" | "en" | "de" = "de") => renderToStaticMarkup(createElement(ExamFeedbackBox, { feedback: f, locale, t: managerT(locale) }));

describe("the result page's box 'Rückmeldung des Prüflings'", () => {
  it("shows the rating, the two quick answers, the technical flag and the comment, in German", () => {
    const html = box(feedback());
    expect(html).toContain("Rückmeldung des Prüflings");
    expect(html).toContain("4 von 5");
    expect(html).toContain("5 von 5");
    expect(html).toContain("3 von 5");
    expect(html).toContain("Verständlichkeit der Anweisungen");
    expect(html).toContain("Bedienbarkeit des Prüfungsbildschirms");
    expect(html).toContain("Ja, gemeldet");
    expect(html).toContain("Die Kamera ist einmal ausgefallen.");
    expect(html).toContain("Gesendet am");
  });

  it("draws four filled stars and one empty one for a 4, hidden from a screen reader", () => {
    const html = renderToStaticMarkup(createElement(StarsReadout, { value: 4 }));
    expect(html).toContain('aria-hidden="true"');
    expect(html.match(/fill-yellow/g)).toHaveLength(4);
    expect(html.match(/fill-transparent/g)).toHaveLength(1);
  });

  it("reads a skipped question as not answered, never as zero, and no technical flag as 'Nein'", () => {
    const html = box(feedback({ clarity: null, usability: null, technicalProblem: false, comment: null }));
    expect(html.match(/Nicht beantwortet/g)).toHaveLength(2);
    expect(html).not.toContain("0 von 5");
    expect(html).toContain("Nein");
    expect(html).not.toContain("Ja, gemeldet");
    expect(html).toContain("Kein Kommentar geschrieben.");
  });

  it("says nothing about a technical problem the student did not answer", () => {
    const html = box(feedback({ technicalProblem: null }));
    expect(html).not.toContain("Ja, gemeldet");
    expect(html.match(/Nicht beantwortet/g)).toHaveLength(1);
  });

  it("keeps a comment line breaks and its own language", () => {
    const html = box(feedback({ comment: "Zeile eins\nZeile zwei", locale: "ar" }));
    expect(html).toContain("whitespace-pre-line");
    expect(html).toContain('lang="ar"');
    expect(html).toContain('dir="auto"');
  });

  it("says that it is about the exam experience and does not change the result", () => {
    expect(box(feedback())).toContain("keinen Einfluss auf das Ergebnis");
    expect(box(feedback(), "en")).toContain("does not affect the result");
  });

  it.each(["tr", "en", "de"] as const)("renders in %s without a raw key or an em dash", (locale) => {
    const html = box(feedback(), locale);
    expect(html).not.toMatch(/examFeedback\./);
    expect(html).not.toContain("\u2014");
  });
});
