import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

import { CandidateIntl } from "@/components/candidate/Intl";
import { hintOf, practiceFor } from "@/components/candidate/exam/warmup/practice-data";
import { INITIAL_WARMUP } from "@/components/candidate/exam/warmup/warmup-state";
import { WarmupPractice } from "@/components/candidate/exam/warmup/Warmup";
import { candidateT } from "@/i18n/candidate";
import { CANDIDATE_LOCALES, type CandidateLocale } from "@/i18n/locale";
import type { CandidateState } from "@/lib/exam-flow";
import type { TextGapKind } from "@/lib/exam/types";
import { SectionIntro } from "./SectionIntro";

/**
 * The web check runs on phones (allowMobile, 2026-11-09). ClozeItem puts the
 * four words on the right only from the lg breakpoint up; below it they sit
 * under the text (pinned above the bottom bar on a phone). So the web check's
 * grammar intro and its warm-up hint show the "below the text" wording under
 * lg and the "on the right" one from lg up; every other exam keeps its one line.
 */

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const inLocale = (locale: CandidateLocale, node: ReactElement) =>
  renderToStaticMarkup(createElement(CandidateIntl, { locale, timeZone: "UTC" } as ComponentProps<typeof CandidateIntl>, node));

const WEB_CHECK_KINDS: TextGapKind[] = ["CLOZE", "WORDBANK"];
/** The web check's grammar section: seven texts in 25 minutes, so about 4 minutes a text. */
const PER_TEXT = { n: "7", minutes: 4 };

function grammarIntro(locale: CandidateLocale, allowMobile: boolean, textKinds: TextGapKind[] = WEB_CHECK_KINDS) {
  const sections: CandidateState["sections"] = [
    { section: "GRAMMAR", position: 1, minutes: 25, itemsLabel: "7", navigable: true, textOnly: true, textKinds, done: false },
  ];
  const cur: NonNullable<CandidateState["current"]> = {
    section: "GRAMMAR",
    position: 1,
    total: 1,
    serverNow: "2026-11-09T10:00:00.000Z",
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
      sections,
      cur,
      maxPlays: 2,
      mode: "PLACEMENT",
      claimedLevel: null,
      clipboardBlock: false,
      allowMobile,
      warmHere: INITIAL_WARMUP,
      warmDo: () => undefined,
      busy: false,
      onStart: () => undefined,
      failure: null,
      headingRef: null,
    }),
  );
}

const wide = (text: string) => `<span class="max-lg:hidden">${escape(text)}</span>`;
const narrow = (text: string) => `<span class="lg:hidden">${escape(text)}</span>`;

describe("the web check's grammar intro follows the cloze layout", () => {
  it.each(CANDIDATE_LOCALES)("%s: below the text under lg, on the right (beside it) from lg up", (locale) => {
    const t = candidateT(locale);
    const html = grammarIntro(locale, true);
    expect(html).toContain(wide(t("examNav.ruleGRAMMARTexts", PER_TEXT)));
    expect(html).toContain(narrow(t("examNav.ruleGRAMMARTextsBelow", PER_TEXT)));
  });

  it.each(CANDIDATE_LOCALES)("%s: a section of cloze texts only gets the same pair", (locale) => {
    const t = candidateT(locale);
    const html = grammarIntro(locale, true, ["CLOZE"]);
    expect(html).toContain(wide(t("examNav.ruleGRAMMARCloze", PER_TEXT)));
    expect(html).toContain(narrow(t("examNav.ruleGRAMMARClozeBelow", PER_TEXT)));
  });

  it.each(CANDIDATE_LOCALES)("%s: every other exam keeps its one line", (locale) => {
    const t = candidateT(locale);
    const html = grammarIntro(locale, false);
    expect(html).toContain(escape(t("examNav.ruleGRAMMARTexts", PER_TEXT)));
    expect(html).not.toContain(escape(t("examNav.ruleGRAMMARTextsBelow", PER_TEXT)));
    expect(html).not.toContain("lg:hidden");
  });

  it("a rule that names no place stays one line in the web check too", () => {
    const t = candidateT("en");
    const html = grammarIntro("en", true, ["WORDBANK"]);
    expect(html).toContain(escape(t("examNav.ruleGRAMMARWordBank", PER_TEXT)));
    expect(html).not.toContain("lg:hidden");
  });
});

describe("the web check's warm-up hint follows the cloze layout", () => {
  const clozeStep = practiceFor("GRAMMAR", WEB_CHECK_KINDS).findIndex((d) => hintOf(d) === "cloze");
  const practice = (locale: CandidateLocale, allowMobile: boolean) =>
    inLocale(
      locale,
      createElement(WarmupPractice, {
        section: "GRAMMAR",
        textKinds: WEB_CHECK_KINDS,
        step: clozeStep,
        maxPlays: 2,
        position: 1,
        allowMobile,
        onNext: () => undefined,
        onLeave: () => undefined,
      }),
    );

  it("has a cloze step to show", () => {
    expect(clozeStep).toBeGreaterThanOrEqual(0);
  });

  it.each(CANDIDATE_LOCALES)("%s: below the text under lg, on the right (beside it) from lg up", (locale) => {
    const t = candidateT(locale);
    const html = practice(locale, true);
    expect(html).toContain(wide(t("examFlow.warmHintCloze")));
    expect(html).toContain(narrow(t("examFlow.warmHintClozeBelow")));
  });

  it.each(CANDIDATE_LOCALES)("%s: every other exam keeps its one hint", (locale) => {
    const t = candidateT(locale);
    const html = practice(locale, false);
    expect(html).toContain(escape(t("examFlow.warmHintCloze")));
    expect(html).not.toContain(escape(t("examFlow.warmHintClozeBelow")));
    expect(html).not.toContain("lg:hidden");
  });
});

describe("the exam runner hands both screens the exam's phone flag", () => {
  const src = readFileSync(path.resolve(__dirname, "ExamRunner.tsx"), "utf8");

  it("passes state.allowMobile to the section intro and to the warm-up", () => {
    const passes = src.match(/allowMobile=\{state\.allowMobile === true\}/g) ?? [];
    expect(passes).toHaveLength(2);
    expect(src.indexOf("<WarmupPractice")).toBeLessThan(src.indexOf("allowMobile={state.allowMobile === true}"));
    expect(src.lastIndexOf("allowMobile={state.allowMobile === true}")).toBeGreaterThan(src.indexOf("<SectionIntro"));
  });
});
