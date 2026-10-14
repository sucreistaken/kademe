import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import tr from "@/i18n/messages/candidate.tr.json";
import en from "@/i18n/messages/candidate.en.json";
import { DesktopOnlyGate } from "./DesktopOnlyGate";
import { examPageView, isMobileSignals, mobileMoment, serverDeviceHint, type MobileMoment } from "./device";
import type { SectionSummary } from "@/lib/exam-flow";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const IPAD_DESKTOP_SITE = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

const headersOf = (h: Record<string, string>) => ({ get: (name: string) => h[name] ?? null });

describe("isMobileSignals (the exam's own rule)", () => {
  it("a phone or a tablet is mobile", () => {
    expect(isMobileSignals({ uaMobile: true, hasDisplayMedia: false, coarsePointer: true, userAgent: ANDROID })).toBe(true);
    expect(isMobileSignals({ uaMobile: undefined, hasDisplayMedia: false, coarsePointer: true, userAgent: IPHONE })).toBe(true);
    // iPadOS asking for the desktop site: a Mac UA, but touch and no screen sharing.
    expect(isMobileSignals({ uaMobile: undefined, hasDisplayMedia: false, coarsePointer: true, userAgent: IPAD_DESKTOP_SITE })).toBe(true);
  });

  it("a computer is not, a touch screen laptop included", () => {
    expect(isMobileSignals({ uaMobile: false, hasDisplayMedia: true, coarsePointer: false, userAgent: MAC_CHROME })).toBe(false);
    expect(isMobileSignals({ uaMobile: false, hasDisplayMedia: true, coarsePointer: true, userAgent: MAC_CHROME })).toBe(false);
    expect(isMobileSignals({ uaMobile: undefined, hasDisplayMedia: true, coarsePointer: false, userAgent: IPAD_DESKTOP_SITE })).toBe(false);
  });
});

describe("serverDeviceHint", () => {
  it("names only a definite phone; everything else waits for the browser", () => {
    expect(serverDeviceHint(headersOf({ "user-agent": IPHONE }))).toBe("mobile");
    expect(serverDeviceHint(headersOf({ "user-agent": ANDROID }))).toBe("mobile");
    expect(serverDeviceHint(headersOf({ "user-agent": MAC_CHROME, "sec-ch-ua-mobile": "?1" }))).toBe("mobile");
    expect(serverDeviceHint(headersOf({ "user-agent": MAC_CHROME, "sec-ch-ua-mobile": "?0" }))).toBe("unknown");
    expect(serverDeviceHint(headersOf({ "user-agent": IPAD_DESKTOP_SITE }))).toBe("unknown");
    expect(serverDeviceHint(null)).toBe("unknown");
  });
});

describe("examPageView and mobileMoment", () => {
  it("shows the exam only once the device is known to be a computer", () => {
    expect(examPageView("mobile")).toBe("block");
    expect(examPageView("unknown")).toBe("wait");
    expect(examPageView("desktop")).toBe("exam");
  });

  const sections = (done: boolean[]) => done.map((d, i) => ({ section: "GRAMMAR", position: i + 1, minutes: 10, itemsLabel: "12", navigable: true, done: d }) as SectionSummary);
  it("says where the student stands", () => {
    expect(mobileMoment({ step: "SECTION_INTRO", sections: sections([false, false]) })).toBe("start");
    expect(mobileMoment({ step: "SECTION_INTRO", sections: sections([true, false]) })).toBe("between");
    expect(mobileMoment({ step: "ITEM", sections: sections([false, false]) })).toBe("running");
  });
});

/**
 * The gate as the server renders it (renderToStaticMarkup takes the server
 * snapshot, as the first paint and hydration do): the exam is never rendered
 * before the browser has decided.
 */
const RUNNER = "EXAM_RUNNER_RENDERED";
const gate = (serverHint: "mobile" | "unknown", moment: MobileMoment, messages: typeof tr = tr) =>
  renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale: messages === tr ? "tr" : "en", messages, timeZone: "Europe/Istanbul" } as never,
      createElement(DesktopOnlyGate, { token: "t".repeat(43), serverHint, need: { writing: true }, moment }, createElement("p", null, RUNNER)),
    ),
  );

describe("DesktopOnlyGate on the exam page", () => {
  it("renders nothing, not the exam, while the device is unknown", () => {
    expect(gate("unknown", "start")).toBe("");
  });

  it("a phone gets the desktop-only screen and never the exam", () => {
    const out = gate("mobile", "start");
    expect(out).not.toContain(RUNNER);
    expect(out).toContain(tr.visual.mobileTitle);
    expect(out).toContain(tr.visual.mobileLead);
    expect(out).toContain(tr.check.copyLink);
  });

  it("between sections it says finished sections are kept, not that nothing has started", () => {
    const out = gate("mobile", "between");
    expect(out).toContain(tr.examDevice.leadBetween);
    expect(out).not.toContain(tr.visual.mobileLead);
    expect(out).toContain(tr.visual.mobileStepQuiet);
  });

  it("inside a running section it says the clock runs and drops the no-hurry step", () => {
    const out = gate("mobile", "running");
    expect(out).toContain(tr.examDevice.leadRunning);
    expect(out).not.toContain(tr.visual.mobileLead);
    expect(out).not.toContain(tr.visual.mobileStepQuiet);
    // The markup escapes the apostrophe in "section's".
    expect(gate("mobile", "running", en as typeof tr)).toContain(en.examDevice.leadRunning.replace(/'/g, "&#x27;"));
  });
});
