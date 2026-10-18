import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({
  useT: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}(${Object.values(values).join(",")})` : key),
}));

import type { CandidateItem } from "@/lib/exam/safe";
import { ItemView } from "./ItemView";
import { TaskExpectations } from "./TaskExpectations";
import { TaskPromptCard } from "./TaskPromptCard";

const render = (item: CandidateItem) => renderToStaticMarkup(createElement(ItemView, { item, answer: {}, onChange: () => {} }));

const base = { sequence: 1, stimulus: null, answer: null } as const;

const choice: CandidateItem = {
  ...base,
  section: "READING",
  type: "SINGLE_CHOICE",
  prompt: "Wann fährt der Zug ab?",
  content: { kind: "CHOICE", multiple: false, options: [{ id: "oa", text: "um acht" }] },
};

const gap: CandidateItem = {
  ...base,
  section: "GRAMMAR",
  type: "GAP_FILL",
  prompt: "Ergänzen Sie das fehlende Wort.\n\nGestern habe ich mit dem {{g1}} gesprochen.",
  content: { kind: "GAP", gaps: [{ id: "g1", choices: null }] },
};

/** The speaking screen needs a camera, so its prompt and expectations are drawn on their own, as SpeakingItem does. */
const speakingHtml = () =>
  renderToStaticMarkup(
    createElement("div", null, [
      createElement(TaskPromptCard, {
        key: "p",
        text: "Sie sind im Büro. Ihr Kollege Herr Braun hat einen Kuli.\n\nBitten Sie Herrn Braun um den Kuli. Sagen Sie auch danke.",
      }),
      createElement(TaskExpectations, { key: "e", section: "SPEAKING", thinkSeconds: 30, answerSeconds: 60 }),
    ]),
  );

const writing: CandidateItem = {
  ...base,
  section: "WRITING",
  type: "WRITING_PROMPT",
  prompt: "Ihr Chef ist krank.\n\nSchreiben Sie ihm eine Nachricht. Gehen Sie auf diese Punkte ein:\n- Wünsche\n- Frage",
  content: { kind: "WRITING", minWords: 40, maxWords: 80 },
};

describe("question typography", () => {
  it("sets a plain question stem at 17px semibold ink with no instruction block", () => {
    const html = render(choice);
    expect(html).toContain('class="whitespace-pre-line text-[17px] font-semibold leading-[1.6] text-ink">Wann fährt der Zug ab?</p>');
    expect(html).not.toContain("border-l-[3px]");
  });

  it("sets options at 16px ink instead of ink-2", () => {
    const html = render(choice);
    expect(html).toContain("text-[16px]");
    expect(html).toContain("border-line text-ink hover:border-line-strong");
    expect(html).not.toContain("text-ink-2");
  });

  it("draws a gap instruction as a ruled block above the sentence", () => {
    const html = render(gap);
    expect(html).toMatch(/border-l-\[3px\] border-brand[^>]*>Ergänzen Sie das fehlende Wort\.<\/p>/);
    expect(html).toContain("font-semibold");
    expect(html.indexOf("Ergänzen Sie")).toBeLessThan(html.indexOf("Gestern habe ich"));
    expect(html).not.toContain("{{g1}}");
  });
});

describe("what writing and speaking expect", () => {
  it("splits the situation from the task lines and says how the task is assessed", () => {
    const html = speakingHtml();
    expect(html).toContain("bg-cream");
    expect(html).toMatch(/bg-cream[^>]*><p>Sie sind im Büro\.<\/p><p>Ihr Kollege Herr Braun hat einen Kuli\.<\/p>/);
    expect(html).toContain("taskHeading");
    expect(html).toMatch(/<li>Bitten Sie Herrn Braun um den Kuli\.<\/li><li>Sagen Sie auch danke\.<\/li>/);
    expect(html).toContain("assessTitle");
    for (const k of ["assessTask", "assessCoherent", "assessRange", "assessAccuracy", "assessFluency", "assessPronunciation"]) {
      expect(html).toContain(k);
    }
    expect(html).toContain("expectTimes(30,60)");
    expect(html).not.toContain("assessOrganised");
  });

  it("lists the writing points under the task line and shows the word range", () => {
    const html = render(writing);
    expect(html).toMatch(/Gehen Sie auf diese Punkte ein:<ul[^>]*><li>Wünsche<\/li><li>Frage<\/li><\/ul>/);
    expect(html).toContain("expectLength(40,80)");
    for (const k of ["assessTask", "assessOrganised", "assessRange", "assessAccuracy"]) expect(html).toContain(k);
    expect(html).not.toContain("assessFluency");
    expect(html).not.toContain("assessPronunciation");
  });

  it("names no level, score or grading guidance", () => {
    for (const html of [speakingHtml(), render(writing)]) {
      expect(html).not.toMatch(/\b[ABC][12]\b/);
      expect(html.toLowerCase()).not.toMatch(/level|score|points|contentpoints|register/);
    }
  });
});
