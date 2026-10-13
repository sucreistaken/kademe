import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({
  useT: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}(${Object.values(values).join(",")})` : key),
}));

import type { CandidateItem } from "@/lib/exam/safe";
import type { ItemAnswer } from "@/lib/exam/types";
import { ItemView, hasAnyAnswer, withMatch } from "./ItemView";

const render = (item: CandidateItem, answer: ItemAnswer = {}) =>
  renderToStaticMarkup(createElement(ItemView, { item, answer, onChange: () => {} }));

/** Every radio group in the markup, as the HTML between its opening tag and the next group. */
const groups = (html: string) => html.split('role="radiogroup"').slice(1);

function matchingItem(right: Array<{ id: string; text: string }>): CandidateItem {
  return {
    sequence: 1,
    section: "READING",
    type: "MATCHING",
    prompt: "Welche Anzeige passt?",
    content: {
      kind: "MATCHING",
      left: [
        { id: "l1", text: "Sie suchen einen Sprachkurs." },
        { id: "l2", text: "Sie möchten ein Fahrrad kaufen." },
        { id: "l3", text: "Sie suchen eine Wohnung." },
      ],
      right,
    },
    stimulus: null,
    answer: null,
  };
}

const ads = matchingItem([
  { id: "oaaaaa", text: "Anzeige A" },
  { id: "obbbbb", text: "Anzeige B" },
  { id: "occccc", text: "Anzeige C" },
  { id: "odddde", text: "Keine Anzeige passt" },
]);

const sentences = matchingItem([
  { id: "ox1111", text: "Das spart Zeit und Geld." },
  { id: "ox2222", text: "Niemand hatte damit gerechnet." },
  { id: "ox3333", text: "Am Ende waren alle zufrieden." },
]);

describe("matching items", () => {
  it("shows every target in view with its letter, and no drop-down", () => {
    const html = render(sentences);
    expect(html).not.toContain("<select");
    expect(html).toContain("matchTargets");
    for (const [badge, text] of [
      ["A", "Das spart Zeit und Geld."],
      ["B", "Niemand hatte damit gerechnet."],
      ["C", "Am Ende waren alle zufrieden."],
    ]) {
      expect(html).toMatch(new RegExp(`<li[^>]*><span[^>]*>${badge}</span><span lang="de"[^>]*>${text}</span>`));
    }
  });

  it("uses the targets' own letters and 0 for 'none fits'", () => {
    const html = render(ads);
    expect(html).toMatch(/>A<\/span><span lang="de"[^>]*>Anzeige A</);
    expect(html).toMatch(/>0<\/span><span lang="de"[^>]*>Keine Anzeige passt</);
    expect(html).toContain('aria-label="0: Keine Anzeige passt"');
  });

  it("gives each row a radio group labelled by the row text, with one tab stop", () => {
    const html = render(sentences);
    const rows = groups(html);
    expect(rows).toHaveLength(3);
    for (const g of rows) {
      const id = g.match(/^ aria-labelledby="([^"]+)"/)?.[1];
      expect(id).toBeTruthy();
      expect(html).toContain(`id="${id}" lang="de"`);
      const radios = g.split("</div>")[0].match(/role="radio"/g) ?? [];
      expect(radios).toHaveLength(3);
      expect(g.split("</div>")[0].match(/tabindex="0"/g)).toHaveLength(1);
    }
  });

  it("marks the chosen target, fades it elsewhere, and offers to clear only that row", () => {
    const html = render(sentences, { matches: { l1: "ox2222" } });
    const [row1, row2, row3] = groups(html).map((g) => g.split("</div>")[0]);
    expect(row1).toMatch(/aria-checked="true"[^>]*aria-label="B: Niemand hatte damit gerechnet\."/);
    expect(row1.match(/tabindex="0"/g)).toHaveLength(1);
    expect(row1).toMatch(/aria-checked="true"[^>]*tabindex="0"/);
    // In the other rows B is still a choice, marked as used.
    expect(row2).toContain('aria-label="B: Niemand hatte damit gerechnet., matchUsedElsewhere"');
    expect(row2).toContain("border-dashed");
    expect(row3).toContain("matchUsedElsewhere");
    // The target list fades B and says it is chosen.
    expect(html).toMatch(/<li class="flex items-start gap-3 opacity-60">[^]*?Niemand hatte damit gerechnet\.[^]*?matchUsed</);
    expect(html.match(/matchClear/g)).toHaveLength(1);
    expect(html).toContain("→ </span>Niemand hatte damit gerechnet.");
  });

  it("removes a cleared row instead of storing an empty value", () => {
    expect(withMatch({ l1: "ox1111", l2: "ox2222" }, "l1", null)).toEqual({ l2: "ox2222" });
    expect(withMatch(undefined, "l1", "ox1111")).toEqual({ l1: "ox1111" });
    expect(withMatch({ l1: "ox1111" }, "l1", "")).toEqual({});
    expect(hasAnyAnswer(sentences, { matches: withMatch({ l1: "ox1111" }, "l1", null) })).toBe(false);
    expect(hasAnyAnswer(sentences, { matches: { l1: "" } })).toBe(false);
  });
});

function tfngItem(section: "READING" | "LISTENING"): CandidateItem {
  return {
    sequence: 1,
    section,
    type: "TRUE_FALSE_NG",
    prompt: "Richtig (R), falsch (F) oder nicht im Text (NG)?",
    content: {
      kind: "TFNG",
      statements: [
        { id: "s1", text: "Der Kurs beginnt am Montag." },
        { id: "s2", text: "Der Kurs kostet nichts." },
      ],
    },
    stimulus: null,
    answer: null,
  };
}

describe("true / false / not given", () => {
  it("puts the German letters on the buttons, reading wording for NG", () => {
    const html = render(tfngItem("READING"));
    for (const [letter, label] of [
      ["R", "tfR"],
      ["F", "tfF"],
      ["NG", "tfNG"],
    ]) {
      expect(html).toMatch(new RegExp(`<span class="[^"]*">${letter}</span>${label}</button>`));
    }
    expect(html).not.toContain("tfNgListening");
  });

  it("words NG for a recording in listening", () => {
    const html = render(tfngItem("LISTENING"));
    expect(html).toMatch(/>NG<\/span>tfNgListening<\/button>/);
    expect(html).not.toMatch(/>tfNG</);
  });

  it("labels each statement's group by the statement and keeps one tab stop", () => {
    const html = render(tfngItem("READING"), { tfng: { s2: "F" } });
    const gs = groups(html).map((g) => g.split("</div>")[0]);
    expect(gs).toHaveLength(2);
    for (const [i, text] of ["Der Kurs beginnt am Montag.", "Der Kurs kostet nichts."].entries()) {
      const id = gs[i].match(/^ aria-labelledby="([^"]+)"/)?.[1];
      expect(html).toContain(`id="${id}" lang="de" class="text-[15px] leading-[1.55] text-ink">${text}</p>`);
      expect(gs[i].match(/tabindex="0"/g)).toHaveLength(1);
    }
    expect(gs[1]).toMatch(/aria-checked="true" tabindex="0"[^>]*>.*?>F<\/span>tfF/);
  });
});

describe("gap labels", () => {
  it("names each gap by its position and uses a 16px font", () => {
    const item: CandidateItem = {
      sequence: 1,
      section: "GRAMMAR",
      type: "GAP_FILL",
      prompt: "Ich fahre {{g1}} Bus und warte {{g2}} dich.",
      content: { kind: "GAP", gaps: [{ id: "g1", choices: ["mit dem", "mit den"] }, { id: "g2", choices: null }] },
      stimulus: null,
      answer: null,
    };
    const html = render(item);
    expect(html).toMatch(/<select aria-label="gapLabel\(1\)"[^>]*text-\[16px\]/);
    expect(html).toMatch(/<input[^>]*aria-label="gapLabel\(2\)"[^>]*text-\[16px\]/);
  });
});
