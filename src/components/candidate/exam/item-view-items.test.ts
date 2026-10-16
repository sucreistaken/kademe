import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({
  useT: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}(${Object.values(values).join(",")})` : key),
}));

import type { CandidateItem } from "@/lib/exam/safe";
import type { ItemAnswer } from "@/lib/exam/types";
import { ItemView, hasAnyAnswer, poolPlacement, withMatch } from "./ItemView";

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

  it("uses the targets' own letters, leaves out a bare list and explains only 0", () => {
    const html = render(ads);
    expect(html).not.toContain("matchTargets");
    expect(html).toContain(">0 = Keine Anzeige passt</p>");
    expect(html).toContain('aria-label="A: Anzeige A"');
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
  it("puts the German words on the buttons, in reading and listening alike", () => {
    for (const section of ["READING", "LISTENING"] as const) {
      const html = render(tfngItem(section));
      for (const word of ["Richtig", "Falsch", "Nicht im Text"]) {
        expect(html).toMatch(new RegExp(`lang="de"[^>]*>${word}</button>`));
      }
    }
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
    expect(gs[1]).toMatch(/aria-checked="true" lang="de" tabindex="0"[^>]*>Falsch<\/button>/);
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

describe("C-test word-part pool", () => {
  const ctest = (pool?: string[]): CandidateItem => ({
    sequence: 1,
    section: "GRAMMAR",
    type: "GAP_FILL",
    prompt: "Ergänzen Sie.\n\nIch bin 24 Jahre alt und arb{{g1}} in Köln. Das ist sch{{g2}}.",
    content: {
      kind: "GAP",
      attached: true,
      gaps: [
        { id: "g1", choices: null },
        { id: "g2", choices: null },
      ],
      ...(pool ? { pool } : {}),
    },
    stimulus: null,
    answer: null,
  });
  const pool = ["eite", "ön", "eiten", "ö"];
  const chips = (html: string) =>
    [...html.matchAll(/<button type="button" lang="de"[^>]*cursor-grab[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);

  it("draws empty slots after the stems and every chip in the pool, with no inputs or umlaut bar", () => {
    const html = render(ctest(pool));
    expect(html).not.toContain("<input");
    expect(html).not.toContain("umlautBar");
    expect(html).toContain("ctestHint");
    expect(html).toMatch(/arb<button[^>]*aria-label="gapLabel\(1\): ctestEmpty"/);
    expect(chips(html)).toEqual(pool);
  });

  it("shows a placed chip in its slot and takes it out of the pool", () => {
    const html = render(ctest(pool), { gaps: { g2: "ön" } });
    expect(html).toMatch(/aria-label="gapLabel\(2\): ön"[^>]*>ön<\/button>/);
    expect(chips(html)).toEqual(["eite", "eiten", "ö"]);
  });

  it("tracks duplicate chips by index", () => {
    const html = render(ctest(["en", "en", "er"]), { gaps: { g1: "en" } });
    expect(chips(html)).toEqual(["en", "er"]);
  });

  it("shows an old typed answer that is not in the pool, and keeps the whole pool", () => {
    const html = render(ctest(pool), { gaps: { g1: "eit" } });
    expect(html).toMatch(/aria-label="gapLabel\(1\): eit"[^>]*>eit<\/button>/);
    expect(chips(html)).toEqual(pool);
  });

  it("falls back to typing when no pool was sent", () => {
    expect(render(ctest())).toContain("<input");
  });

  it("rebuilds placement from saved strings, first unused equal entry first", () => {
    const { used, at } = poolPlacement(["en", "er", "en"], ["g1", "g2", "g3"], { g1: "en", g2: "en", g3: "xx" });
    expect([...used].sort()).toEqual([0, 2]);
    expect(at.get("g1")).toBe(0);
    expect(at.get("g2")).toBe(2);
    expect(at.has("g3")).toBe(false);
  });
});
