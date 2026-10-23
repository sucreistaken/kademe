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
