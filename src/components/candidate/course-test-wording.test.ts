import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

import { CandidateIntl } from "@/components/candidate/Intl";
import { INITIAL_WARMUP } from "@/components/candidate/exam/warmup/warmup-state";
import { candidateT } from "@/i18n/candidate";
import { CANDIDATE_LOCALES, type CandidateLocale } from "@/i18n/locale";
import type { CandidateState, StudentResult } from "@/lib/exam-flow";
import type { ExamMode } from "@/lib/exam/types";
import { PRESETS } from "@/lib/proctor/policy";
import { Finished } from "./Finished";
import { IntroConsent } from "./IntroConsent";
import { SectionIntro } from "./exam/SectionIntro";

/**
 * A course test on the candidate screens (spec 2026-10-28): its German name, the words of a course test
 * (no claimed level, no level estimate, no promise that questions get easier or harder), and a finish
 * screen that says the teacher will share the result.
 */

const NAME = "Abschlusstest B1";
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const inLocale = (locale: CandidateLocale, node: ReactElement) =>
  renderToStaticMarkup(createElement(CandidateIntl, { locale, timeZone: "UTC" } as ComponentProps<typeof CandidateIntl>, node));

const SECTIONS: CandidateState["sections"] = (["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"] as const).map((section, i) => ({
  section,
  position: i + 1,
  minutes: 15,
  itemsLabel: section === "WRITING" ? "1" : section === "SPEAKING" ? "3" : "10",
  navigable: section !== "SPEAKING",
  textOnly: false,
  textKinds: [],
  done: false,
}));

function stateOf(mode: ExamMode, over: Partial<CandidateState> = {}): CandidateState {
  return {
    step: "CONSENT",
    examName: NAME,
    orgName: "Campus German",
    mode,
    claimedLevel: null,
    estimatedMinutes: 85,
    expiresAt: "2026-11-30T10:00:00.000Z",
    sections: SECTIONS,
    proctoring: PRESETS.OFF,
    maxPlays: 2,
    ...over,
  };
}

const intro = (state: CandidateState, locale: CandidateLocale = "en") =>
  inLocale(
    locale,
    createElement(IntroConsent, {
      token: "t".repeat(43),
      locale,
      state,
      consent: { version: 1, body: "Consent text", shown: "en", turkishBody: null },
      supportEmail: null,
      mediaRetentionDays: 30,
    }),
  );

describe("the first screen of a course test", () => {
  it.each(CANDIDATE_LOCALES)("%s: is headed by the German name and says it is a course test, not a placement exam", (locale) => {
    const t = candidateT(locale);
    const html = intro(stateOf("COURSE_TEST"), locale);
    expect(html).toMatch(/<h1[^>]*>Abschlusstest B1<\/h1>/);
    expect(html).toContain(escape(t("exam.titleCourseTest")));
    expect(html).not.toContain(escape(t("exam.titlePlacement")));
    expect(html).not.toContain("exam.title");
  });

  it("names no level: the verification wording needs a claim and a course test has none", () => {
    const html = intro(stateOf("COURSE_TEST", { claimedLevel: null }));
    expect(html).not.toContain("level verification");
    expect(html).not.toContain("placement exam");
    expect(html).toContain("German course test");
  });

  it("is unchanged for the other two kinds of exam", () => {
    const placement = intro(stateOf("PLACEMENT", { examName: "Placement test" }));
    expect(placement).toContain("German placement exam");
    expect(placement).not.toContain("German course test");
    const verification = intro(stateOf("LEVEL_VERIFICATION", { examName: "Level check", claimedLevel: "B1" }));
    expect(verification).toContain("German B1 level verification");
    expect(verification).not.toContain("German course test");
  });

  it("still lists the five sections with their minutes", () => {
    const html = intro(stateOf("COURSE_TEST"));
    for (const name of ["Grammar", "Reading", "Listening", "Writing", "Speaking"]) expect(html).toContain(name);
    expect(html).toContain("About 85 minutes in total");
  });
});

function sectionIntro(mode: ExamMode, section: CandidateState["sections"][number]["section"], locale: CandidateLocale = "en", maxPlays = 2) {
  const position = SECTIONS.find((s) => s.section === section)!.position;
  const cur: NonNullable<CandidateState["current"]> = {
    section,
    position,
    total: SECTIONS.length,
    serverNow: "2026-10-28T10:00:00.000Z",
    deadlineAt: null,
    remainingMs: null,
    answered: 0,
    itemTotal: null,
    item: null,
    group: null,
    listening: null,
    nav: null,
  };
  return inLocale(
    locale,
    createElement(SectionIntro, {
      sections: SECTIONS,
      cur,
      maxPlays,
      mode,
      claimedLevel: null,
      clipboardBlock: true,
      warmHere: INITIAL_WARMUP,
      warmDo: () => undefined,
      busy: false,
      onStart: () => undefined,
      failure: null,
      headingRef: null,
    }),
  );
}

describe("a section introduction of a course test", () => {
  it.each(CANDIDATE_LOCALES)("%s: the grammar part does not promise questions that go from easier to harder", (locale) => {
    const t = candidateT(locale);
    const html = sectionIntro("COURSE_TEST", "GRAMMAR", locale);
    expect(html).toContain(escape(t("examNav.ruleGRAMMARCourse")));
    expect(html).not.toContain(escape(t("examNav.ruleGRAMMARFixed")));
    expect(html).not.toContain(escape(t("section.ruleGRAMMAR")));
  });

  it("keeps the old rule for a level exam", () => {
    const t = candidateT("en");
    const html = sectionIntro("PLACEMENT", "GRAMMAR");
    expect(html).toContain(escape(t("examNav.ruleGRAMMARFixed")));
    expect(html).not.toContain(escape(t("examNav.ruleGRAMMARCourse")));
  });

  it.each(CANDIDATE_LOCALES)("%s: the listening part states the plays without saying some recordings play only once", (locale) => {
    const t = candidateT(locale);
    const html = sectionIntro("COURSE_TEST", "LISTENING", locale, 2);
    expect(html).toContain(escape(t("section.ruleLISTENINGCourse", { plays: 2 })));
    expect(html).not.toContain(escape(t("section.ruleLISTENINGMixed", { plays: 2 })));
  });

  it("a placement exam with two plays still gets the mixed wording, and a course test never does", () => {
    const t = candidateT("en");
    expect(sectionIntro("PLACEMENT", "LISTENING")).toContain(escape(t("section.ruleLISTENINGMixed", { plays: 2 })));
    for (const plays of [1, 2, 3]) {
      expect(sectionIntro("COURSE_TEST", "LISTENING", "en", plays)).not.toContain("play only once");
    }
  });

  it("leaves the writing and speaking rules as they are", () => {
    const t = candidateT("en");
    expect(sectionIntro("COURSE_TEST", "SPEAKING")).toContain(escape(t("section.ruleSPEAKING")));
    expect(sectionIntro("COURSE_TEST", "WRITING")).toContain(escape(t("examFlow.ruleWritingPaste")));
    expect(sectionIntro("COURSE_TEST", "READING")).toContain(escape(t("section.ruleREADING")));
  });
});

const finished = (result: StudentResult, mode: ExamMode | undefined, locale: CandidateLocale = "en") =>
  inLocale(
    locale,
    createElement(Finished, {
      token: "t".repeat(43),
      name: "Ada Lovelace",
      result,
      terminated: false,
      terminationReason: null,
      contactEmail: "okul@example.com",
      feedbackAnswered: true,
      sections: ["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"],
      ...(mode ? { mode } : {}),
    }),
  );

describe("the finish screen of a course test before the teacher releases the result", () => {
  const waiting: StudentResult = { visibility: "FULL", released: false, awaitingTeacher: true, waitingFor: "PRODUCTIVE", levelShown: false };

  it.each(CANDIDATE_LOCALES)("%s: says the teacher will share the result, not that a level is awaited", (locale) => {
    const t = candidateT(locale);
    const html = finished(waiting, "COURSE_TEST", locale);
    expect(html).toContain(escape(t("result.courseWait")));
    expect(html).not.toContain(escape(t("result.pending")));
    expect(html).not.toContain(escape(t("result.notReleased")));
    expect(html).not.toContain(escape(t("result.none")));
    expect(html).not.toContain("result.course");
  });

  it("says the same when the school hid results from level exams (visibility NONE) and when nothing is waiting any more", () => {
    const t = candidateT("en");
    for (const over of [{ visibility: "NONE" as const }, { awaitingTeacher: false, waitingFor: null }]) {
      expect(finished({ ...waiting, ...over }, "COURSE_TEST")).toContain(escape(t("result.courseWait")));
    }
  });

  it("shows no level and no score, even if the result row is released and carries an overall level", () => {
    for (const released of [false, true]) {
      const html = finished({ ...waiting, released, levelShown: true, overall: "B1", outcome: "PASS" }, "COURSE_TEST");
      expect(html).not.toContain("Your level");
      expect(html).not.toContain(">B1<");
      expect(html).not.toContain("Your stated level");
      expect(html).toContain("Your teacher will share your result");
    }
  });

  it("a level exam keeps its own waiting sentence", () => {
    const t = candidateT("en");
    expect(finished(waiting, undefined)).toContain(escape(t("result.pending")));
    expect(finished(waiting, "PLACEMENT")).toContain(escape(t("result.pending")));
    expect(finished(waiting, "PLACEMENT")).not.toContain(escape(t("result.courseWait")));
  });
});
