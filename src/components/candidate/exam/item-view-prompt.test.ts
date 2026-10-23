import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({
  useT: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}(${Object.values(values).join(",")})` : key),
}));

// The task card marks its interface label with the page language.
const uiLocale = vi.hoisted(() => ({ value: "en" }));
vi.mock("next-intl", () => ({ useLocale: () => uiLocale.value }));

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
    expect(html).toContain('class="whitespace-pre-line text-body-lg font-bold text-ink">Wann fährt der Zug ab?</p>');
    expect(html).not.toContain("border-l-[3px]");
  });

  it("sets options at 16px ink instead of ink-2", () => {
    const html = render(choice);
    expect(html).toContain("text-[16px]");
    expect(html).toContain("border-line text-ink hover:border-line-strong");
    expect(html).not.toContain("text-ink-2");
  });

  it("sets the question of a matching prompt as a stem between ruled instructions", () => {
    const html = render({
      ...base,
      section: "READING",
      type: "MATCHING",
      prompt: "Lesen Sie die Situationen. Welche Anzeige passt? Jede Anzeige passt höchstens einmal.",
      content: { kind: "MATCHING", left: [{ id: "l1", text: "Sie suchen einen Kurs." }], right: [{ id: "oaaaaa", text: "Anzeige A" }] },
    });
    expect(html).toMatch(/border-s-\[3px\] border-brand[^>]*>Lesen Sie die Situationen\.<\/p>/);
    expect(html).toContain('class="whitespace-pre-line text-body-lg font-bold text-ink">Welche Anzeige passt?</p>');
    expect(html).toMatch(/border-s-\[3px\] border-brand[^>]*>Jede Anzeige passt höchstens einmal\.<\/p>/);
  });

  it("draws a gap instruction as a ruled block above the sentence", () => {
    const html = render(gap);
    expect(html).toMatch(/border-s-\[3px\] border-brand[^>]*>Ergänzen Sie das fehlende Wort\.<\/p>/);
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

  it("labels the writing field with the prompt and describes it with the expectations box", () => {
    const html = render(writing);
    const describedBy = html.match(/<textarea[^>]*aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeTruthy();
    expect(html).toContain(`<div id="${describedBy}" class="mt-5 rounded-[12px]`);
    expect(html.slice(html.indexOf(`id="${describedBy}"`))).toContain("expectLength(40,80)");
  });

  it("gives the task label the interface language and direction inside the German card", () => {
    expect(render(writing)).toMatch(/<div lang="en" dir="ltr" class="[^"]*">taskHeading<\/div>/);
    uiLocale.value = "ar";
    try {
      const html = render(writing);
      expect(html).toMatch(/<div lang="ar" dir="rtl" class="[^"]*">taskHeading<\/div>/);
      // The card itself stays German.
      expect(html).toMatch(/<div id="[^"]+" lang="de" class="flex flex-col gap-4 text-ink">/);
    } finally {
      uiLocale.value = "en";
    }
  });

  const withPoints = (prompt: string): CandidateItem => ({
    ...writing,
    prompt,
    content: { kind: "WRITING", minWords: 40, maxWords: 80, studentPoints: ["Begrüßung", "einen Grund nennen"] },
  });
  // One task sentence and no list: the points add what the prompt does not spell out.
  const openTask = withPoints("Ihr Chef ist krank.\n\nSchreiben Sie ihm eine Nachricht.");

  it("shows the student points after the task card and before the assessment box, labelled in the interface language", () => {
    const html = render(openTask);
    expect(html).toMatch(/<div lang="en" dir="ltr" class="[^"]*">coverPoints<\/div><ul lang="de" class="[^"]*text-\[17px\][^"]*"><li>Begrüßung<\/li><li>einen Grund nennen<\/li><\/ul>/);
    const task = html.indexOf("Schreiben Sie ihm eine Nachricht.");
    const points = html.indexOf("coverPoints");
    expect(task).toBeGreaterThan(-1);
    expect(points).toBeGreaterThan(task);
    expect(html.indexOf("assessTitle")).toBeGreaterThan(points);
    expect(html).not.toMatch(/\b[ABC][12]\b/);
    expect(html.toLowerCase()).not.toMatch(/level|score|contentpoints|register/);
  });

  it("keeps the field's name to the card and describes it with the points and the expectations", () => {
    const html = render(openTask);
    const labelledBy = html.match(/<textarea[^>]*aria-labelledby="([^"]+)"/)?.[1];
    const describedBy = html.match(/<textarea[^>]*aria-describedby="([^"]+)"/)?.[1].split(" ") ?? [];
    expect(describedBy).toHaveLength(2);
    // The points box is not inside the labelling card.
    const card = html.slice(html.indexOf(`id="${labelledBy}"`));
    expect(card.slice(0, card.indexOf(`id="${describedBy[0]}"`))).not.toContain("<ul lang=\"de\"");
    expect(html).toMatch(new RegExp(`<div id="${describedBy[0]}" class="[^"]*">[^]*?coverPoints`));
    expect(html.slice(html.indexOf(`id="${describedBy[1]}"`))).toContain("expectLength(40,80)");
  });

  it("shows no points box when the prompt already lists the tasks", () => {
    // Bullets under "Gehen Sie auf diese Punkte ein:".
    expect(render(withPoints(writing.prompt))).not.toContain("coverPoints");
    // Two task sentences, drawn as a list.
    expect(render(withPoints("Ihr Chef ist krank.\n\nSchreiben Sie ihm eine Nachricht. Fragen Sie, wann er zurückkommt."))).not.toContain("coverPoints");
    // A list of questions on its own.
    expect(render(withPoints("Schreiben Sie Nina.\n\n- Wo arbeiten Sie?\n- Wann arbeiten Sie?"))).not.toContain("coverPoints");
    const html = render(withPoints(writing.prompt));
    expect(html.match(/<textarea[^>]*aria-describedby="([^"]+)"/)?.[1].split(" ")).toHaveLength(1);
  });

  it("shows no points box when the item has no student points", () => {
    expect(render(writing)).not.toContain("coverPoints");
    expect(speakingHtml()).not.toContain("coverPoints");
  });

  it("names no level, score or grading guidance", () => {
    for (const html of [speakingHtml(), render(writing)]) {
      expect(html).not.toMatch(/\b[ABC][12]\b/);
      expect(html.toLowerCase()).not.toMatch(/level|score|points|contentpoints|register/);
    }
  });
});
