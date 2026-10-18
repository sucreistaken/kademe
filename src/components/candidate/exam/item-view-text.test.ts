import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({
  useT: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}(${Object.values(values).join(",")})` : key),
}));

import { toCandidateItem, type CandidateItem } from "@/lib/exam/safe";
import type { ItemAnswer, ItemSnapshot } from "@/lib/exam/types";
import { CLOZE_SKILL_TAG, WORD_BANK_SKILL_TAG } from "@/lib/exam/types";
import { ItemView, hasAnyAnswer } from "./ItemView";

const render = (item: CandidateItem, answer: ItemAnswer = {}, disabled = false) =>
  renderToStaticMarkup(createElement(ItemView, { item, answer, onChange: () => {}, disabled }));

function snapshot(skillTag: string, prompt: string, content: ItemSnapshot["content"], key: ItemSnapshot["key"]): ItemSnapshot {
  return {
    id: "i1",
    section: "GRAMMAR",
    level: "B1",
    difficulty: 0,
    type: "GAP_FILL",
    skillTag,
    stimulusId: null,
    orderInStimulus: 0,
    prompt,
    content,
    key,
    rubric: null,
    points: 1,
    stimulus: null,
  };
}

/** A cloze text of `n` gaps, each with four words; served the way the server serves it. */
function cloze(n: number): CandidateItem {
  const ids = Array.from({ length: n }, (_, i) => `g${i + 1}`);
  const text = ids.map((id, i) => `Satz ${i + 1} mit {{${id}}} und mehr Text.`).join(" ");
  return toCandidateItem(
    snapshot(
      CLOZE_SKILL_TAG,
      `Lesen Sie den Text. Wählen Sie für jede Lücke das passende Wort.\n\nMein Tag\n${text}`,
      { kind: "GAP", gaps: ids.map((id) => ({ id, choices: [`richtig${id}`, "falsch", "anders", "kurz"] })) },
      { kind: "GAP", answers: Object.fromEntries(ids.map((id) => [id, [`richtig${id}`]])) },
    ),
    {},
    null,
    1,
    { maxPlays: 0 },
  );
}

function wordBank(): CandidateItem {
  return toCandidateItem(
    snapshot(
      WORD_BANK_SKILL_TAG,
      "Setzen Sie die passenden Wörter in die Lücken ein.\n\nIch {{g1}} Anna und {{g2}} in Berlin. Am Abend {{g3}} ich nach Hause.",
      { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }, { id: "g3" }] },
      { kind: "GAP", answers: { g1: ["heiße"], g2: ["wohne"], g3: ["gehe"] }, distractors: ["Hund", "blau", "gestern", "Straßenbahnhaltestelle"] },
    ),
    {},
    null,
    1,
    { maxPlays: 0 },
  );
}

describe("cloze item", () => {
  it("is not a C-test: no inputs, no drop-downs, no pool", () => {
    const html = render(cloze(3));
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("ctestPool");
    expect(html).not.toContain("wordPool");
  });

  it("draws the text in German with one numbered button per gap and the instruction apart", () => {
    const html = render(cloze(12));
    expect(html).toContain('lang="de"');
    expect(html).toContain("Wählen Sie für jede Lücke das passende Wort.");
    expect((html.match(/data-cloze-gap=/g) ?? []).length).toBe(12);
    for (const n of [1, 6, 12]) expect(html).toContain(`>${n}</button>`);
    expect(html).not.toContain("{{g1}}");
  });

  it("opens the first empty gap with its four options as radio buttons, numbered 1 to 4", () => {
    const html = render(cloze(3));
    expect(html).toContain("gapLabel(1)");
    const panel = html.slice(html.indexOf('role="radiogroup"'));
    expect((panel.match(/role="radio"/g) ?? []).length).toBe(4);
    for (const n of [1, 2, 3, 4]) expect(panel).toContain(`>${n}</span>`);
    expect(panel).toContain("clozeKeys");
    // Nothing is picked yet, the first radio is the only tab stop.
    expect(panel).not.toContain('aria-checked="true"');
    expect(panel.match(/tabindex="0"/g)?.length).toBe(1);
  });

  it("opens the next empty gap once earlier gaps are filled, and shows a filled gap's word", () => {
    const item = cloze(3);
    const html = render(item, { gaps: { g1: "falsch", g2: "anders" } });
    expect(html).toContain("gapLabel(3)");
    // The two filled gaps show the chosen word in the text.
    expect(html).toMatch(/data-cloze-gap="g1"[^>]*>falsch<\/button>/);
    expect(html).toMatch(/data-cloze-gap="g2"[^>]*>anders<\/button>/);
    expect(html).toMatch(/data-cloze-gap="g3"[^>]*>3<\/button>/);
  });

  it("marks the open gap as pressed and the chosen option as checked when every gap is filled", () => {
    const item = cloze(2);
    const gaps = item.content.kind === "GAP" ? item.content.gaps : [];
    const answer = { gaps: { g1: gaps[0].choices![1], g2: gaps[1].choices![2] } };
    const html = render(item, answer);
    // All filled and nothing clicked: the first gap is open and its pick is checked.
    expect(html).toMatch(/data-cloze-gap="g1"/);
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect((html.match(/aria-checked="true"/g) ?? []).length).toBe(1);
  });

  it("disables gaps and options while inputs are off", () => {
    const html = render(cloze(2), {}, true);
    expect(html).not.toMatch(/<button[^>]*role="radio"(?![^>]*disabled)/);
    expect(html).not.toMatch(/<button(?![^>]*disabled)[^>]*data-cloze-gap/);
  });

  it("counts as answered once any gap has a word", () => {
    const item = cloze(3);
    expect(hasAnyAnswer(item, {})).toBe(false);
    expect(hasAnyAnswer(item, { gaps: { g2: "falsch" } })).toBe(true);
  });

  it("lays out two columns at desktop width with a sticky option panel", () => {
    const html = render(cloze(12));
    expect(html).toContain("lg:grid-cols-");
    expect(html).toContain("lg:sticky");
  });
});

describe("word-bank item", () => {
  it("draws slots without stems, numbered, and a tray of whole words (answers and distractors)", () => {
    const html = render(wordBank());
    expect((html.match(/data-gap-slot=/g) ?? []).length).toBe(3);
    expect(html).toContain("wordPool");
    expect(html).not.toContain("ctestPool");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
    const tray = html.slice(html.indexOf('aria-label="wordPool"'));
    for (const w of ["heiße", "wohne", "gehe", "Hund", "blau", "gestern", "Straßenbahnhaltestelle"]) expect(tray, w).toContain(`>${w}</button>`);
    expect((tray.match(/cursor-grab/g) ?? []).length).toBe(7);
  });

  it("keeps the text next to a slot as it is: no word stem is cut off the text before a gap", () => {
    const html = render(wordBank());
    expect(html).toContain("<span>Ich </span>");
    expect(html).toContain("<span> Anna und </span>");
  });

  it("sizes every slot for the longest pool word, so the width says nothing about the answer", () => {
    const html = render(wordBank());
    const widths = [...html.matchAll(/data-gap-slot="g\d"[^>]*style="min-width:([^"]+)"/g)].map((m) => m[1]);
    expect(widths).toEqual(["25ch", "25ch", "25ch"]);
  });

  it("keeps the stored instruction, not the C-test one", () => {
    const html = render(wordBank());
    expect(html).toContain("Setzen Sie die passenden Wörter in die Lücken ein.");
    expect(html).not.toContain("Wortteile");
  });

  it("shows a placed word in its slot, leaves it out of the tray, and keeps a twin chip for a second use", () => {
    const item = wordBank();
    const html = render(item, { gaps: { g1: "heiße" } });
    expect(html).toMatch(/data-gap-slot="g1"[^>]*>heiße<\/button>/);
    const tray = html.slice(html.indexOf('aria-label="wordPool"'));
    expect(tray).not.toContain(">heiße</button>");
    expect((tray.match(/cursor-grab/g) ?? []).length).toBe(6);
  });

  it("serves the pool without telling which word fits which gap", () => {
    const json = JSON.stringify(wordBank());
    expect(json).not.toContain("answers");
    expect(json).not.toContain("distractors");
  });
});
