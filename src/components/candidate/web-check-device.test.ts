import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

import tr from "@/i18n/messages/candidate.tr.json";
import { CandidateIntl } from "@/components/candidate/Intl";
import { candidateT } from "@/i18n/candidate";
import { CANDIDATE_LOCALES, type CandidateLocale } from "@/i18n/locale";
import type { CandidateState } from "@/lib/exam-flow";
import { PRESETS } from "@/lib/proctor/policy";
import { DesktopOnlyGate } from "./DesktopOnlyGate";
import { IntroConsent } from "./IntroConsent";
import { blocksDevice, examPageView } from "./device";

/**
 * The phone gate for an exam that runs on phones (`allowMobile`, the public
 * web check of 2026-11-09), next to the desktop-only rule of 2026-10-14 that
 * every other exam keeps (device.test.ts, mobile-block.test.ts).
 */

describe("examPageView and blocksDevice with allowMobile", () => {
  it("a phone gets the exam only when the exam runs on phones", () => {
    expect(examPageView("mobile", true)).toBe("exam");
    expect(examPageView("mobile", false)).toBe("block");
    expect(examPageView("mobile")).toBe("block");
  });

  it("a computer gets the exam either way, and nothing shows while the device is unknown", () => {
    expect(examPageView("desktop", true)).toBe("exam");
    expect(examPageView("desktop", false)).toBe("exam");
    expect(examPageView("unknown", true)).toBe("wait");
    expect(examPageView("unknown", false)).toBe("wait");
  });

  it("the consent screen and the system check block a phone only for a desktop-only exam", () => {
    expect(blocksDevice(true, false)).toBe(true);
    expect(blocksDevice(true)).toBe(true);
    expect(blocksDevice(true, true)).toBe(false);
    expect(blocksDevice(false, false)).toBe(false);
    expect(blocksDevice(false, true)).toBe(false);
  });
});

const RUNNER = "EXAM_RUNNER_RENDERED";
const gate = (serverHint: "mobile" | "unknown", allowMobile: boolean | undefined) =>
  renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale: "tr", messages: tr, timeZone: "Europe/Istanbul" } as never,
      createElement(DesktopOnlyGate, { token: "t".repeat(43), serverHint, need: {}, moment: "start", allowMobile }, createElement("p", null, RUNNER)),
    ),
  );

describe("DesktopOnlyGate on the server for an exam that runs on phones", () => {
  it("a phone's first paint is not the desktop-only screen, and the exam still waits for hydration", () => {
    const out = gate("mobile", true);
    expect(out).toBe("");
    expect(out).not.toContain(tr.visual.mobileTitle);
    expect(out).not.toContain(RUNNER);
  });

  it("every other exam still shows a phone the desktop-only screen at once", () => {
    for (const allowMobile of [false, undefined]) {
      const out = gate("mobile", allowMobile);
      expect(out).toContain(tr.visual.mobileTitle);
      expect(out).not.toContain(RUNNER);
    }
  });
});

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const grammarOnly: CandidateState["sections"] = [
  { section: "GRAMMAR", position: 1, minutes: 25, itemsLabel: "7", navigable: true, textOnly: true, textKinds: ["CLOZE", "WORDBANK"], done: false },
];

const stateOf = (over: Partial<CandidateState>): CandidateState => ({
  step: "CONSENT",
  examName: "Online level test",
  orgName: "Campus German",
  mode: "PLACEMENT",
  claimedLevel: null,
  estimatedMinutes: 25,
  expiresAt: "2026-11-12T10:00:00.000Z",
  sections: grammarOnly,
  proctoring: PRESETS.OFF,
  maxPlays: 2,
  ...over,
});

const intro = (state: CandidateState, locale: CandidateLocale) =>
  renderToStaticMarkup(
    createElement(
      CandidateIntl,
      { locale, timeZone: "UTC" } as ComponentProps<typeof CandidateIntl>,
      createElement(IntroConsent, {
        token: "t".repeat(43),
        locale,
        state,
        consent: { version: 1, body: "Consent text", shown: "en", turkishBody: null },
        supportEmail: null,
        mediaRetentionDays: 30,
      }) as ReactElement,
    ),
  );

describe("the consent screen of an exam that runs on phones", () => {
  it.each(CANDIDATE_LOCALES)("%s: asks for a phone, tablet or computer instead of a computer", (locale) => {
    const t = candidateT(locale);
    const html = intro(stateOf({ allowMobile: true }), locale);
    expect(html).toContain(escape(t("exam.needPhoneOrComputer")));
    expect(html).not.toContain(escape(t("exam.needComputer")));
  });

  it.each(CANDIDATE_LOCALES)("%s: every other exam still asks for a computer", (locale) => {
    const t = candidateT(locale);
    for (const state of [stateOf({}), stateOf({ allowMobile: false }), stateOf({ proctoring: PRESETS.STANDARD })]) {
      const html = intro(state, locale);
      expect(html).toContain(escape(t("exam.needComputer")));
      expect(html).not.toContain(escape(t("exam.needPhoneOrComputer")));
    }
  });
});
