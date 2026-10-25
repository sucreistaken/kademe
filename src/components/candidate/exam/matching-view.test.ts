import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({
  useT: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}(${Object.values(values).join(",")})` : key),
}));

import type { CandidateItem } from "@/lib/exam/safe";
import type { ItemAnswer } from "@/lib/exam/types";
import { ItemView } from "./ItemView";
import { ReadingPane } from "./ReadingPane";
import { MatchUiProvider } from "./match-ui";
import { matchInstruction } from "./MatchingView";

const noop = () => {};

/** The reading pane (the gaps) and the question column (the list), side by side as the exam draws them. */
function screen(item: CandidateItem, answer: ItemAnswer = {}, openRow?: string | null): { pane: string; column: string } {
  const wrap = (node: ReactElement) => renderToStaticMarkup(openRow === undefined ? node : createElement(MatchUiProvider, { openRow, inline: true }, node));
  const stimulus = item.stimulus?.kind === "READING" ? item.stimulus : null;
  return {
    pane: stimulus
      ? wrap(createElement(ReadingPane, { title: stimulus.title, text: stimulus.text, token: "t", sectionPosition: 0, match: { item, answer, onChange: noop } }))
      : "",
    column: wrap(createElement(ItemView, { item, answer, onChange: noop })),
  };
}

const badgesOf = (html: string) => [...html.matchAll(/data-badge="([^"]*)"/g)].map((m) => m[1]);

const PASSAGE = `Der Park am Fluss

Am Morgen ist es still. (1) ________ Danach kommen die ersten Läufer.

Im Winter ist alles anders. (2) ________ Das Eis hält nicht.`;

const insertion = (text = PASSAGE): CandidateItem => ({
  sequence: 4,
  section: "READING",
  type: "MATCHING",
  prompt: "Welcher Satz passt in welche Lücke?",
  content: {
    kind: "MATCHING",
    left: [
      { id: "l1", text: "Lücke (1)" },
      { id: "l2", text: "Lücke (2)" },
    ],
    right: [
      { id: "rA", text: "A: Im Sommer ist der Park voll." },
      { id: "rB", text: "B: Dann öffnet das Café am Wehr." },
      { id: "rC", text: "C: Das Wetter spielt keine Rolle." },
    ],
  },
  stimulus: { kind: "READING", title: "Der Park am Fluss", text: text },
  answer: null,
});

describe("text insertion: the gaps are in the text", () => {
  it("draws each gap marker as a button in the passage and keeps the words around it", () => {
    const { pane } = screen(insertion());
    expect(pane).toContain('data-match-trigger="l1"');
    expect(pane).toContain('data-match-trigger="l2"');
    expect(pane).not.toContain("________");
    expect(pane).toContain("Am Morgen ist es still.");
    expect(pane).toContain("Danach kommen die ersten Läufer.");
    // The title line of the text is the pane's heading, once.
    expect(pane.split("Der Park am Fluss").length - 1).toBe(1);
  });

  it("makes each gap a button that opens a list: named by its number and its pick, with a number and a blank", () => {
    const { pane } = screen(insertion());
    const tag = pane.match(/<button[^>]*data-match-trigger="l1"[^>]*>/)?.[0] ?? "";
    expect(tag).toContain('type="button"');
    expect(tag).toContain('aria-haspopup="listbox"');
    expect(tag).toContain('aria-expanded="false"');
    expect(tag).toContain('aria-label="gapLabel(1), gapEmpty"');
    expect(tag).toContain("border-dashed");
    expect(pane).toMatch(/aria-hidden="true" class="tnum text-ink-2">1<\/span>/);
  });

  it("shows the picked sentence in its gap: the letter and the start of the sentence", () => {
    const { pane } = screen(insertion(), { matches: { l1: "rB" } });
    const slot = pane.match(/<button[^>]*data-match-trigger="l1"[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(slot).toContain('aria-label="gapLabel(1), clozeChosen(B)"');
    expect(slot).toMatch(/>B<\/span>/);
    expect(slot).toMatch(/<span lang="de" class="min-w-0 max-w-\[13rem\] truncate font-semibold">Dann öffnet das Café am Wehr\.<\/span>/);
    expect(slot).not.toContain("border-dashed");
    // The other gap is still empty.
    expect(pane).toContain('aria-label="gapLabel(2), gapEmpty"');
  });

  it("leaves only the instruction and the lettered sentences in the question column: no per-gap rows, no tray, no radios", () => {
    const { column } = screen(insertion());
    expect(column).toContain("Klicken Sie auf eine Lücke im Text und wählen Sie den passenden Satz. Jeden Satz können Sie nur einmal verwenden.");
    expect(column).toContain("data-insert-list");
    expect(column.match(/data-insert-sentence="/g)).toHaveLength(3);
    for (const sentence of ["Im Sommer ist der Park voll.", "Dann öffnet das Café am Wehr.", "Das Wetter spielt keine Rolle."]) expect(column).toContain(sentence);
    expect(column).not.toContain("data-match-trigger");
    expect(column).not.toContain("data-match-row");
    expect(column).not.toContain("data-match-tray");
    expect(column).not.toContain("data-match-drop");
    expect(column).not.toContain('role="radio"');
    expect(column).not.toContain("Ziehen Sie");
  });

  it("dims a sentence that is in a gap and says which: → 1, with the words for a screen reader", () => {
    const { column } = screen(insertion(), { matches: { l1: "rB" } });
    const item = (id: string) => column.match(new RegExp(`<li[^>]*data-insert-sentence="${id}"[\\s\\S]*?</li>`))?.[0] ?? "";
    expect(item("rB")).toContain("→ 1");
    expect(item("rB")).toContain("insertUsedIn(1)");
    expect(item("rB")).toContain("text-ink-3");
    for (const free of ["rA", "rC"]) {
      expect(item(free)).not.toContain("→");
      expect(item(free)).not.toContain("text-ink-3");
    }
  });

  it("lists the gap's sentences with the used ones last, dimmed, saying where", () => {
    const { pane } = screen(insertion(), { matches: { l2: "rA" } }, "l1");
    expect(pane).toContain('role="listbox"');
    expect(badgesOf(pane)).toEqual(["B", "C", "A"]);
    const used = pane.match(/<span[^>]*data-demo-option="l1:rA"[\s\S]*?<\/span><\/span>/)?.[0] ?? "";
    expect(used).toContain("insertUsedIn(2)");
    expect(used).toContain("text-ink-3");
    expect(pane).toContain("Im Sommer ist der Park voll.");
    expect(pane).toContain('aria-expanded="true"');
  });

  it("offers to empty a gap only when it holds a sentence, and keeps its own sentence in place", () => {
    expect(badgesOf(screen(insertion(), {}, "l1").pane)).toEqual(["A", "B", "C"]);
    const filled = screen(insertion(), { matches: { l1: "rB", l2: "rA" } }, "l1").pane;
    // Own pick B stays among the free ones, marked; A (in gap 2) sinks; the empty entry comes last.
    expect(badgesOf(filled)).toEqual(["B", "C", "A", ""]);
    expect(filled).toMatch(/aria-selected="true"[^>]*data-badge="B"/);
    expect(filled).toContain('data-demo-option="l1:"');
    expect(filled).toContain("matchClear");
  });

  it("makes a sentence of the list pickable for the open gap and nothing otherwise", () => {
    const closed = screen(insertion()).column;
    expect(closed).not.toContain("cursor-pointer");
    const open = screen(insertion(), {}, "l2").column;
    expect(open).toContain("cursor-pointer");
  });
});

describe("text insertion whose gaps cannot be found in the text", () => {
  const unlinked = insertion("Der Park am Fluss\n\nEin Text ohne jede Markierung.");

  it("falls back to one dropdown per row, with the gap instruction and no slots in the text", () => {
    const { pane, column } = screen(unlinked, { matches: { l1: "rA" } });
    expect(pane).not.toContain("data-match-trigger");
    expect(column).toContain("Wählen Sie für jede Lücke den passenden Satz. Jeden Satz können Sie nur einmal verwenden.");
    expect(column).not.toContain("data-insert-list");
    expect(column.match(/data-match-row="/g)).toHaveLength(2);
    expect(column.match(/aria-haspopup="listbox"/g)).toHaveLength(2);
  });

  it("names the gap, not a row number, where a sentence is already used", () => {
    const { column } = screen(unlinked, { matches: { l2: "rA" } }, "l1");
    expect(badgesOf(column)).toEqual(["B", "C", "A"]);
    expect(column).toContain("insertUsedIn(2)");
  });

  it("does the same when only some of the gaps are in the text", () => {
    const some = insertion("Der Park am Fluss\n\nNur eine Lücke. (1) ________ Mehr nicht.");
    const { pane, column } = screen(some);
    expect(pane).not.toContain("data-match-trigger");
    expect(column).toContain("data-match-row");
  });
});

const persons = (stimulus: CandidateItem["stimulus"] = null): CandidateItem => ({
  sequence: 2,
  section: "READING",
  type: "MATCHING",
  prompt: "Welche Anzeige passt?",
  content: {
    kind: "MATCHING",
    left: [
      { id: "l1", text: "Sie suchen einen Sprachkurs am Abend." },
      { id: "l2", text: "Sie möchten ein Fahrrad kaufen." },
      { id: "l3", text: "Sie suchen eine Wohnung." },
    ],
    right: [
      { id: "oa", text: "Anzeige A" },
      { id: "ob", text: "Anzeige B" },
      { id: "oc", text: "Anzeige C" },
      { id: "od", text: "Keine Anzeige passt" },
    ],
  },
  stimulus,
  answer: null,
});

describe("other matching: one dropdown per row", () => {
  it("numbers the rows and gives each one button that opens the list, labelled by the row text", () => {
    const { column } = screen(persons());
    expect(column.match(/data-match-row="/g)).toHaveLength(3);
    expect(column.match(/aria-haspopup="listbox"/g)).toHaveLength(3);
    expect(column).toMatch(/aria-hidden="true" class="tnum[^"]*">1<\/span>/);
    expect(column).toMatch(/aria-hidden="true" class="tnum[^"]*">3<\/span>/);
    expect(column.match(/>matchPlaceholder<\/span>/g)).toHaveLength(3);
    const labelled = column.match(/aria-labelledby="([^"]+)"/g) ?? [];
    expect(labelled).toHaveLength(3);
    const [textId, buttonId] = ((labelled[0] ?? "").match(/"([^"]+)"/)?.[1] ?? "").split(" ");
    expect(column).toContain(`<p id="${textId}" lang="de"`);
    expect(column).toContain(`id="${buttonId}"`);
    expect(column).toContain("Wählen Sie für jede Nummer die passende Antwort.");
  });

  it("has no tray, no per-row letter buttons and nothing to drag", () => {
    const { column } = screen(persons(), { matches: { l1: "oa" } });
    for (const gone of ["data-match-tray", "data-match-drop", "data-demo-chip", 'role="radio"', 'role="radiogroup"', "cursor-grab", "touch-none", "Ziehen Sie", "sticky"]) {
      expect(column).not.toContain(gone);
    }
  });

  it("shows the chosen letter and its words on the row's button", () => {
    const { column } = screen(persons(), { matches: { l2: "od" } });
    const button = column.match(/<button[^>]*data-match-trigger="l2"[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(button).toMatch(/>0<\/span>/);
    expect(button).toContain("Keine Anzeige passt");
    expect(button).not.toContain("matchPlaceholder");
  });

  it("sinks the letters other rows hold, saying where, and never sinks the 'fits nobody' entry", () => {
    const open = screen(persons(), { matches: { l1: "oa", l3: "od" } }, "l2").column;
    expect(badgesOf(open)).toEqual(["B", "C", "0", "A"]);
    expect(open).toContain("matchUsedAt(1)");
    expect(open.match(/matchUsedAt/g)).toHaveLength(1);
    const zero = badgesOf(screen(persons(), { matches: { l1: "od", l2: "od" } }, "l3").column);
    expect(zero).toEqual(["A", "B", "C", "0"]);
  });

  it("offers every row's list as a labelled listbox of options, each wearing its letter", () => {
    const { column } = screen(persons(), {}, "l1");
    expect(column).toMatch(/role="listbox" aria-label="1: matchTargets"/);
    expect(column.match(/role="option"/g)).toHaveLength(4);
    expect(column).toContain('data-demo-option="l1:oa"');
    expect(column).toContain("Keine Anzeige passt");
  });

  it("takes the title of each advert from its card in the text, for the list and the button", () => {
    const text = "Kleinanzeigen\n\nA  Computerkurs\nWord und Excel.\n\nB  Fotostudio Klick\nBewerbungsfotos.\n\nC  Fahrradladen\nStadträder.";
    const item = persons({ kind: "READING", title: "Kleinanzeigen", text });
    const open = screen(item, { matches: { l2: "oc" } }, "l1").column;
    expect(open).toContain("Computerkurs");
    expect(open).toContain("Fotostudio Klick");
    expect(open).toContain("Fahrradladen");
    expect(screen(item, { matches: { l2: "oc" } }).column).toMatch(/data-match-trigger="l2"[\s\S]*?Fahrradladen/);
    // Without that text the plain label stays.
    expect(screen(persons(), {}, "l1").column).toContain("Anzeige A");
  });

  it("keeps its picture gallery above the rows and puts letter and caption in the list", () => {
    const image = (slot: string, alt: string) => ({ slot, w: 640, h: 480, alt });
    const item: CandidateItem = {
      ...persons(),
      content: {
        kind: "MATCHING",
        left: [{ id: "l1", text: "Bitte nicht essen!" }],
        right: [
          { id: "pa", text: "Bild A", image: image("pa", "Ein Café") },
          { id: "pb", text: "Am Strand", image: image("pb", "Ein Strand") },
        ],
      },
    };
    const open = screen(item, {}, "l1").column;
    expect(open.indexOf("<img")).toBeLessThan(open.indexOf('role="listbox"'));
    // "Bild A" says nothing, so the list uses the picture's alt text; a real caption is used as written and printed under the picture.
    expect(open).toContain("Ein Café");
    expect(open).toContain("Am Strand");
    expect(open).toContain("Wählen Sie für jede Nummer das passende Bild.");
    expect(badgesOf(open)).toEqual(["A", "B"]);
  });
});

describe("matchInstruction", () => {
  it("describes the new interaction in formal German, never dragging", () => {
    const all = [
      matchInstruction({ linked: true, gapRows: true, pictures: false }),
      matchInstruction({ linked: false, gapRows: true, pictures: false }),
      matchInstruction({ linked: false, gapRows: false, pictures: true }),
      matchInstruction({ linked: false, gapRows: false, pictures: false }),
    ];
    expect(all[0]).toBe("Klicken Sie auf eine Lücke im Text und wählen Sie den passenden Satz. Jeden Satz können Sie nur einmal verwenden.");
    expect(new Set(all).size).toBe(4);
    for (const text of all) {
      expect(text).toMatch(/^(Klicken|Wählen) Sie /);
      expect(text).not.toMatch(/ziehen|\u2014/i);
    }
  });
});
