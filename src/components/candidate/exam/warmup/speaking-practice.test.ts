import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({
  useT: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}(${Object.values(values).join(",")})` : key),
}));
vi.mock("next-intl", () => ({ useLocale: () => "en" }));

import { WarmupPractice } from "./Warmup";

const html = renderToStaticMarkup(
  createElement(WarmupPractice, { section: "SPEAKING", textKinds: [], step: 0, maxPlays: 1, position: 4, onNext: () => {}, onLeave: () => {} }),
);

describe("the speaking warm-up shows the exam's recorder panel, switched off", () => {
  it("draws the three steps, the ring clock and the big start button of the real panel", () => {
    expect(html).toContain('data-speaking-phase="THINKING"');
    expect(html).toContain("speakingStepPrepare");
    expect(html).toContain("speakingStepSaved");
    expect(html).toContain("speakingPrepareLabel");
    expect(html).toContain('role="timer"');
    expect(html).toContain(">0:30<");
    expect(html).toContain("speakingStart");
    expect(html).toContain("h-14 w-full");
  });

  it("switches the button off, records nothing and says no camera is live", () => {
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>speakingStart<\/button>/);
    expect(html).toContain("warmSpeakingPreview");
    expect(html).not.toContain("<video");
    // The hint that recording starts by itself is not true in the practice.
    expect(html).not.toContain("speakingPrepareHint");
  });

  it("leaves the old clock card out and keeps the practice's own buttons", () => {
    expect(html).not.toContain("thinkTime");
    expect(html).not.toContain("startNow");
    // The speaking practice has one step, so its button is the finishing one.
    expect(html).toContain("warmFinish");
    expect(html).toContain("warmLeave");
  });

  it("keeps the page's explanation that nothing is recorded", () => {
    expect(html).toContain("warmHintSpeaking(30,60)");
  });
});
