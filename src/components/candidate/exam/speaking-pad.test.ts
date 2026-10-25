import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({
  useT: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}(${Object.values(values).join(",")})` : key),
}));
vi.mock("next-intl", () => ({ useLocale: () => "en" }));

import type { CandidateItem } from "@/lib/exam/safe";
import { SpeakingItem } from "./MediaItems";

const item: CandidateItem = {
  sequence: 7,
  stimulus: null,
  answer: null,
  section: "SPEAKING",
  type: "SPEAKING_PROMPT",
  prompt: "Stellen Sie sich vor.",
  content: { kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 60, maxTakes: 1 },
} as CandidateItem;

describe("speaking screen notes", () => {
  it("includes the notes pad folded by default so the task card fits the first screen", () => {
    const html = renderToStaticMarkup(createElement(SpeakingItem, { token: "t", sectionPosition: 2, item, answer: {}, onChange: () => {}, engine: null }));
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("modeType");
    expect(html).toContain("<video");
  });
});

describe("speaking screen recorder", () => {
  const html = renderToStaticMarkup(createElement(SpeakingItem, { token: "t", sectionPosition: 2, item, answer: {}, onChange: () => {}, engine: null }));

  it("starts in the prepare step with one recorder panel on the right", () => {
    expect(html.match(/data-speaking-phase="/g)).toHaveLength(1);
    expect(html).toContain('data-speaking-phase="THINKING"');
    expect(html).toContain("speakingPrepareLabel");
    expect(html).toContain("speakingStart");
    expect(html).not.toContain("stopRecording");
  });

  it("shows the camera once: one video element, labelled, and it sits inside the panel", () => {
    expect(html.match(/<video/g)).toHaveLength(1);
    expect(html).toContain('aria-label="speakingCamera"');
    expect(html.indexOf("<video")).toBeGreaterThan(html.indexOf('data-speaking-phase="'));
  });

  it("starts at the saved step when the question already has a take (after a reload)", () => {
    const taken = renderToStaticMarkup(
      createElement(SpeakingItem, { token: "t", sectionPosition: 2, item: { ...item, takesUsed: 1 } as CandidateItem, answer: { mediaAssetId: "m" }, onChange: () => {}, engine: null }),
    );
    expect(taken).toContain('data-speaking-phase="DONE"');
    expect(taken).toContain("speakingSavedTitle");
    expect(taken).not.toContain("speakingStart");
  });

  it("keeps the old clock and its tiny buttons out of the screen", () => {
    expect(html).not.toContain("thinkTime");
    expect(html).not.toContain("startNow");
  });
});
