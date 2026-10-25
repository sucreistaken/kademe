import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CandidateIntl } from "@/components/candidate/Intl";
import type { StudentResult } from "@/lib/exam-flow";
import type { CandidateLocale } from "@/i18n/locale";
import { Finished } from "./Finished";

/** The closing screen with the survey under it: where it shows, where it does not. */

const waiting: StudentResult = { visibility: "FULL", released: false, awaitingTeacher: true, waitingFor: "REVIEW", levelShown: false };
const released: StudentResult = { visibility: "FULL", released: true, awaitingTeacher: false, levelShown: true, overall: "B2", skills: [{ section: "GRAMMAR", level: "B2" }] };

function screen(over: Partial<ComponentProps<typeof Finished>> = {}, locale: CandidateLocale = "en") {
  const props: ComponentProps<typeof Finished> = {
    token: "t".repeat(43),
    name: "Ada Lovelace",
    result: waiting,
    terminated: false,
    terminationReason: null,
    contactEmail: "okul@example.com",
    feedbackAnswered: false,
    sections: ["GRAMMAR", "READING"],
    ...over,
  };
  return renderToStaticMarkup(createElement(CandidateIntl, { locale, timeZone: "UTC" } as ComponentProps<typeof CandidateIntl>, createElement(Finished, props)));
}

/** The survey's own card, cut out of the page. */
const surveyOf = (html: string) => /<section aria-labelledby="[^"]+-title"[^>]*>[\s\S]*$/.exec(html)?.[0] ?? "";

describe("the finished screen offers the survey", () => {
  it("under the closing card when the result still waits for a teacher", () => {
    const html = screen();
    expect(html).toContain("your teacher will review it and decide");
    expect(html).toContain("Rate the exam");
    // After the "something went wrong" report and the contact lines, as its own card.
    expect(html.indexOf("Rate the exam")).toBeGreaterThan(html.indexOf("Did something go wrong during the exam?"));
    expect(html.indexOf("Rate the exam")).toBeGreaterThan(html.indexOf("okul@example.com"));
  });

  it("also when the result is released", () => {
    expect(screen({ result: released })).toContain("Rate the exam");
  });

  it("not again once the server says it is answered, and the rest of the screen is unchanged", () => {
    const html = screen({ feedbackAnswered: true });
    expect(html).not.toContain("Rate the exam");
    expect(html).toContain("Did something go wrong during the exam?");
    expect(html).toContain("okul@example.com");
  });

  it("not for an exam that was ended (terminated)", () => {
    const html = screen({ terminated: true, terminationReason: "FULLSCREEN_EXITS" });
    expect(html).not.toContain("Rate the exam");
    expect(html).toContain("The exam was ended");
  });

  it("shows no score or level of its own: the card holds only the survey", () => {
    const html = screen({ result: released });
    expect(html).toContain("B2");
    const card = surveyOf(html);
    expect(card).toContain("Rate the exam");
    expect(card).not.toContain("B2");
    expect(card).not.toMatch(/Your level|right|wrong/i);
  });

  it.each(["tr", "en", "de", "es", "ar"] as const)("%s: the closing screen carries the survey in its language", (locale) => {
    const html = screen({}, locale);
    expect(html).not.toMatch(/feedback\.[a-zA-Z]+/);
    expect(surveyOf(html).length).toBeGreaterThan(200);
  });
});
