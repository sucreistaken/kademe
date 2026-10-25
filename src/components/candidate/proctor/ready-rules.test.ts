import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { policyFromPreset } from "@/lib/proctor/policy";
import { messagesFor } from "@/i18n/candidate";
import { CANDIDATE_LOCALES, type CandidateLocale } from "@/i18n/locale";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("@/lib/client/api", () => ({ apiSend: async () => ({}), candidateApiBase: () => "/api" }));
vi.mock("@/components/candidate/proctor/ProctorProvider", () => ({
  environmentFacts: () => ({}),
  // The engine is ready and every device already passed, so the last screen is what renders.
  useProctor: () => ({
    engine: null,
    snap: { ready: true, isExtended: false, camera: "ok", mic: "ok", model: "ready", faces: 1, screen: "ok", surface: "MONITOR", windowManagement: "granted", micLevel: 0 },
  }),
}));

import { ReadyRules } from "./ReadyRules";
import { SystemCheck } from "./SystemCheck";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: unknown }) => unknown;

function inLocale(locale: CandidateLocale, node: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(createElement(Provider as never, { locale, messages: messagesFor(locale), timeZone: "Europe/Istanbul" } as never, node));
}

const rules = (locale: CandidateLocale, preset: "STRICT" | "STANDARD" | "OFF", accepted = false) =>
  inLocale(locale, createElement(ReadyRules, { policy: policyFromPreset(preset), accepted, onChange: () => undefined }));

describe("the last screen's checklist card", () => {
  const tr = messagesFor("tr").examCheck;

  it("leads with a 20px bold title, then the yellow callout with the two rules that matter most", () => {
    const html = rules("tr", "STRICT");
    expect(html).toMatch(new RegExp(`<h2 id="ready-rules-title" class="[^"]*text-\\[20px\\][^"]*font-extrabold[^"]*">${tr.readyCardTitle}</h2>`));
    const callout = html.match(/<ul data-ready-callout="true" class="([^"]*)">(.*?)<\/ul>/);
    expect(callout?.[1]).toContain("bg-yellow-soft");
    expect(callout?.[2]).toContain(tr.readyCloseApps);
    expect(callout?.[2]).toContain(tr.readyRecCameraAudioScreen);
    // The plain rules sit outside the callout, after it.
    for (const rule of [tr.ruleFullscreen, tr.ruleOneScreen, tr.ruleTab]) {
      expect(callout?.[2]).not.toContain(rule);
      expect(html).toContain(rule);
    }
    expect(html.indexOf(tr.readyCloseApps)).toBeLessThan(html.indexOf(tr.ruleFullscreen));
  });

  it("keeps every line at 16px with ink text (the callout bold), icons beside each, never red", () => {
    const html = rules("tr", "STRICT");
    expect(html.match(/<li class="flex items-start gap-3 text-\[16px\] leading-6 text-ink">/g)).toHaveLength(5);
    expect(html.match(/<svg/g)?.length).toBeGreaterThanOrEqual(6);
    expect(html).not.toMatch(/danger|text-red|bg-red|border-red|bg-error|text-error/);
  });

  it("says only what the policy records: STANDARD has no screen, OFF records nothing", () => {
    const standard = rules("tr", "STANDARD");
    expect(standard).toContain(tr.readyRecCameraAudio);
    expect(standard).not.toContain(tr.readyRecCameraAudioScreen);
    expect(standard).not.toContain("görünür");
    const off = rules("tr", "OFF");
    expect(off).toContain(tr.readyCloseApps);
    for (const key of ["readyRecCameraAudioScreen", "readyRecCameraScreen", "readyRecScreen", "readyRecCameraAudio", "readyRecCamera"] as const) expect(off).not.toContain(tr[key]);
    expect(off).toContain(tr.ruleTab);
    expect(off).not.toContain(tr.ruleFullscreen);
    expect(off).not.toContain(tr.ruleOneScreen);
  });

  it("has a required checkbox, unticked until the prop says so", () => {
    const open = rules("tr", "STRICT");
    expect(open).toMatch(/<input type="checkbox" aria-required="true" class="peer sr-only"\/>/);
    expect(open).not.toContain('checked=""');
    expect(open).toContain(tr.readyConfirm);
    expect(rules("tr", "STRICT", true)).toMatch(/<input type="checkbox" aria-required="true" class="peer sr-only" checked=""\/>/);
  });

  it("renders in all five languages with real text (no raw keys, no em-dash), Arabic included", () => {
    for (const locale of CANDIDATE_LOCALES) {
      const html = rules(locale, "STRICT");
      const t = messagesFor(locale).examCheck;
      for (const text of [t.readyCardTitle, t.readyCloseApps, t.readyRecCameraAudioScreen, t.readyConfirm]) expect(html, locale).toContain(text.replace(/&/g, "&amp;"));
      expect(html, locale).not.toMatch(/ready[A-Z]\w+/);
      expect(html, locale).not.toContain("\u2014");
    }
  });
});

describe("the start button on the last screen", () => {
  // A policy with only the rules to read (no devices, no screen share), so the check opens on the last screen; STRICT needs clicks to get there.
  const policies = { OFF: policyFromPreset("OFF"), "full screen only": { ...policyFromPreset("OFF"), fullscreen: true, secondScreen: "WARN" as const } };
  const render = (policy: ReturnType<typeof policyFromPreset>) => inLocale("tr", createElement(SystemCheck, { token: "t".repeat(24), policy }));
  const tr = messagesFor("tr").examCheck;

  // The server render has no window; the check reads a few browser facts for the environment verdict.
  const stub = () => {
    vi.stubGlobal("window", { screen: {}, matchMedia: () => ({ matches: false }) });
    vi.stubGlobal("document", { fullscreenEnabled: true });
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh) Chrome/130", mediaDevices: { getDisplayMedia: () => undefined }, userAgentData: { brands: [{ brand: "Google Chrome" }], mobile: false } });
    vi.stubGlobal("MediaRecorder", class {});
  };
  afterEach(() => vi.unstubAllGlobals());

  it("is off until the rules are ticked, and says why right next to itself", () => {
    stub();
    for (const [name, policy] of Object.entries(policies)) {
      const html = render(policy);
      expect(html, name).toContain(tr.readyCardTitle);
      expect(html, name).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*aria-describedby="ready-why"[^>]*>${tr.cta}</button>`));
      expect(html, name).toMatch(new RegExp(`<p id="ready-why" class="[^"]*">${tr.readyConfirmHint}</p>`));
    }
  });

  it("the old three pale pills and the lead sentence are gone", () => {
    stub();
    const html = render(policies["full screen only"]);
    expect(html).not.toContain("bg-mint-soft");
    expect(html).not.toContain("üç kısa kural");
  });
});

describe("the start click stays the user gesture that enters full screen", () => {
  const src = readFileSync(path.resolve(__dirname, "SystemCheck.tsx"), "utf8");

  it("passes the tick state to the card and the step logic", () => {
    expect(src).toContain("<ReadyRules policy={policy} accepted={rulesAccepted} onChange={setRulesAccepted} />");
    expect(src).toMatch(/lookConfirmed,\n\s+rulesAccepted,\n\s+\} satisfies StepState/);
  });

  it("starts from the click handler with nothing awaited before full screen is requested", () => {
    const begin = src.slice(src.indexOf("async function begin()"), src.indexOf("async function reportProblem()"));
    const firstAwait = begin.indexOf("await ");
    expect(begin.slice(firstAwait, firstAwait + 40)).toContain("engine.enterFullscreen()");
    expect(src).toMatch(/case "start":\n\s+void begin\(\);/);
  });
});
