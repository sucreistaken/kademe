import { describe, expect, it } from "vitest";
import { CTEST_POOL_INSTRUCTION } from "@/lib/exam/ctest-instruction";
import type { ItemSnapshot } from "@/lib/exam/types";
import { gapSegments, pickedTextKind, plainPrompt, reviewCard, sectionScoreSummary, splitTaskPrompt } from "./review-cards";

const base = { id: "i", section: "GRAMMAR", level: "B1", difficulty: 0, stimulusId: null, orderInStimulus: 0, rubric: null, points: 1, stimulus: null } as const;

const ctest = {
  ...base,
  skillTag: "grammar.ctest",
  type: "GAP_FILL",
  prompt: "Anleitung.\n\nIch mö{{g1}} gern und arb{{g2}} viel.",
  content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] },
  key: { kind: "GAP", answers: { g1: ["chte", "möchte"], g2: ["eite"] } },
} as ItemSnapshot;
const grammarGap = {
  ...base,
  skillTag: "grammar.cases",
  type: "GAP_FILL",
  prompt: "Ich gehe in {{g1}} Kino.",
  content: { kind: "GAP", gaps: [{ id: "g1" }] },
  key: { kind: "GAP", answers: { g1: ["das", "ins"] } },
} as ItemSnapshot;

describe("gapSegments", () => {
  it("C-test: the stem moves into the gap so each gap holds the whole word", () => {
    const segs = gapSegments(ctest, { gaps: { g1: "chte", g2: "xyz" } })!;
    // The stored "type the letters" instruction gives way to the pool instruction the student saw.
    expect(segs[0]).toEqual({ kind: "text", text: `${CTEST_POOL_INSTRUCTION}\n\nIch ` });
    expect(segs[1]).toMatchObject({ kind: "gap", n: 1, stem: "mö", given: "chte", shown: "möchte", expected: "möchte", mark: "correct" });
    expect(segs[2]).toEqual({ kind: "text", text: " gern und " });
    expect(segs[3]).toMatchObject({ n: 2, stem: "arb", shown: "arbxyz", expected: "arbeite", mark: "wrong" });
    expect(segs[4]).toEqual({ kind: "text", text: " viel." });
  });
  it("C-test: a typed full word is not given the stem twice, an empty gap shows nothing", () => {
    const segs = gapSegments(ctest, { gaps: { g1: "möchte" } })!;
    expect(segs[1]).toMatchObject({ shown: "möchte", mark: "correct" });
    expect(segs[3]).toMatchObject({ given: "", shown: "", mark: "blank" });
  });
  it("an accepted gap is marked accepted, and an ordinary gap has no stem", () => {
    const segs = gapSegments(grammarGap, { gaps: { g1: "dem" } }, ["g1"])!;
    expect(segs).toEqual([
      { kind: "text", text: "Ich gehe in " },
      { kind: "gap", id: "g1", n: 1, stem: "", given: "dem", shown: "dem", expected: "das", mark: "accepted", options: [] },
      { kind: "text", text: " Kino." },
    ]);
  });
  it("returns null for an item that is not a gap item", () => {
    expect(gapSegments({ ...grammarGap, content: { kind: "SHORT_TEXT", maxChars: 5 }, key: { kind: "NONE" } } as ItemSnapshot, null)).toBeNull();
  });
});

const cloze = {
  ...base,
  skillTag: "grammar.cloze",
  type: "GAP_FILL",
  prompt: "Lesen Sie den Text.\n\nIch gehe {{g1}} Hause und bleibe {{g2}} dem Sofa.",
  content: { kind: "GAP", gaps: [{ id: "g1", choices: ["nach", "zu", "in", "bei"] }, { id: "g2", choices: ["auf", "an", "über", "unter"] }] },
  key: { kind: "GAP", answers: { g1: ["nach"], g2: ["auf"] } },
} as ItemSnapshot;
const wordbank = {
  ...base,
  skillTag: "grammar.wordbank",
  type: "GAP_FILL",
  prompt: "Wir {{g1}} morgen {{g2}} Hamburg.",
  content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] },
  key: { kind: "GAP", answers: { g1: ["fahren"], g2: ["nach"] }, distractors: ["fährt", "zu", "bei"] },
} as ItemSnapshot;

describe("MC cloze and word bank cards", () => {
  it("the kind is read from the skill tag; C-tests and ordinary gaps are not a picked text", () => {
    expect(pickedTextKind(cloze)).toBe("CLOZE");
    expect(pickedTextKind(wordbank)).toBe("WORDBANK");
    expect(pickedTextKind(ctest)).toBeNull();
    expect(pickedTextKind(grammarGap)).toBeNull();
  });
  it("cloze: numbers the gaps in text order and carries the four options with the pick and the key", () => {
    const card = reviewCard(cloze, { gaps: { g1: "zu", g2: "auf" } });
    if (card.kind !== "GAP") throw new Error("gap");
    expect(card).toMatchObject({ ctest: false, textKind: "CLOZE", right: 1, total: 2 });
    const gaps = card.segments.flatMap((x) => (x.kind === "gap" ? [x] : []));
    expect(gaps.map((g) => [g.n, g.shown, g.expected, g.mark])).toEqual([
      [1, "zu", "nach", "wrong"],
      [2, "auf", "auf", "correct"],
    ]);
    expect(gaps[0].options).toEqual([
      { text: "nach", picked: false, correct: true },
      { text: "zu", picked: true, correct: false },
      { text: "in", picked: false, correct: false },
      { text: "bei", picked: false, correct: false },
    ]);
    // A cloze text is never given a C-test stem: the word before the gap stays in the text.
    expect(card.segments[0]).toEqual({ kind: "text", text: "Lesen Sie den Text.\n\nIch gehe " });
  });
  it("cloze: a gap left empty has no pick among the options", () => {
    const card = reviewCard(cloze, { gaps: { g2: "an" } });
    if (card.kind !== "GAP") throw new Error("gap");
    const first = card.segments.find((x) => x.kind === "gap");
    expect(first).toMatchObject({ mark: "blank", shown: "" });
    expect(first && first.kind === "gap" && first.options.some((o) => o.picked)).toBe(false);
  });
  it("word bank: the student's word against the key, no options, and the text stays whole", () => {
    const card = reviewCard(wordbank, { gaps: { g1: "fährt", g2: "nach" } });
    if (card.kind !== "GAP") throw new Error("gap");
    expect(card).toMatchObject({ textKind: "WORDBANK", right: 1, total: 2 });
    const gaps = card.segments.flatMap((x) => (x.kind === "gap" ? [x] : []));
    expect(gaps.map((g) => [g.shown, g.expected, g.mark, g.options])).toEqual([
      ["fährt", "fahren", "wrong", []],
      ["nach", "nach", "correct", []],
    ]);
  });
  it("typed gap items keep textKind null and no options", () => {
    expect(reviewCard(ctest, { gaps: { g1: "chte" } })).toMatchObject({ textKind: null });
    expect(reviewCard(grammarGap, { gaps: { g1: "das" } })).toMatchObject({ textKind: null });
  });
});

describe("reviewCard", () => {
  it("gap: counts the gaps that are right", () => {
    expect(reviewCard(ctest, { gaps: { g1: "chte" } })).toMatchObject({ kind: "GAP", ctest: true, right: 1, total: 2 });
  });
  it("choice: marks the pick and the key, and the overall mark", () => {
    const choice = { ...base, skillTag: "x", type: "SINGLE_CHOICE", prompt: "p", content: { kind: "CHOICE", options: [{ id: "o1", text: "eins" }, { id: "o2", text: "zwei" }] }, key: { kind: "CHOICE", correct: ["o2"] } } as ItemSnapshot;
    expect(reviewCard(choice, { choiceIds: ["o1"] })).toEqual({
      kind: "CHOICE",
      multiple: false,
      options: [
        { id: "o1", letter: "A", text: "eins", picked: true, correct: false },
        { id: "o2", letter: "B", text: "zwei", picked: false, correct: true },
      ],
      mark: "wrong",
    });
    expect(reviewCard(choice, { choiceIds: ["o2"] })).toMatchObject({ mark: "correct" });
    expect(reviewCard(choice, {})).toMatchObject({ mark: "blank" });
  });
  it("true/false/not given: student code against key code", () => {
    const tfng = { ...base, skillTag: "x", type: "TRUE_FALSE_NG", prompt: "p", content: { kind: "TFNG", statements: [{ id: "s1", text: "Er kommt." }] }, key: { kind: "TFNG", answers: { s1: "NG" } } } as ItemSnapshot;
    expect(reviewCard(tfng, { tfng: { s1: "F" } })).toEqual({ kind: "TFNG", rows: [{ id: "s1", text: "Er kommt.", given: "F", key: "NG", mark: "wrong" }] });
  });
  it("matching: letters follow the target order, a row left empty is blank", () => {
    const matching = {
      ...base,
      skillTag: "x",
      type: "MATCHING",
      prompt: "p",
      content: { kind: "MATCHING", left: [{ id: "l1", text: "Text 1" }, { id: "l2", text: "Text 2" }], right: [{ id: "a", text: "Anzeige A" }, { id: "b", text: "Anzeige B" }] },
      key: { kind: "MATCHING", pairs: { l1: "a", l2: "b" } },
    } as ItemSnapshot;
    const card = reviewCard(matching, { matches: { l1: "b" } });
    expect(card).toMatchObject({ kind: "MATCHING" });
    if (card.kind !== "MATCHING") return;
    expect(card.rows[0]).toMatchObject({ givenLetter: "B", keyLetter: "A", mark: "wrong" });
    expect(card.rows[1]).toMatchObject({ givenLetter: "", keyLetter: "B", mark: "blank" });
  });
  it("short text and writing", () => {
    const short = { ...base, skillTag: "x", type: "SHORT_TEXT", prompt: "p", content: { kind: "SHORT_TEXT", maxChars: 9 }, key: { kind: "SHORT_TEXT", accepted: ["Berlin"] } } as ItemSnapshot;
    expect(reviewCard(short, { text: "berlin" })).toMatchObject({ kind: "TEXT", mark: "correct" });
    expect(reviewCard({ ...short, key: { kind: "NONE" } } as ItemSnapshot, null)).toEqual({ kind: "OTHER" });
  });
});

describe("helpers", () => {
  it("plainPrompt shows a gap marker as a blank", () => {
    expect(plainPrompt("Ich {{g1}} hier")).toBe("Ich ___ hier");
  });
  it("sectionScoreSummary counts answers (gaps), not whole items, and the blanks", () => {
    const r = (score: number | null, answer: object | null) => ({ itemSnapshot: grammarGap, answer, score, notReached: false });
    expect(sectionScoreSummary([r(1, { gaps: { g1: "das" } }), r(0, { gaps: { g1: "x" } }), r(0.5, { gaps: { g1: "x" } }), r(0, null)])).toEqual({ right: 1, total: 4, blank: 1 });
    const c = { itemSnapshot: ctest, answer: { gaps: { g1: "chte", g2: "x" } }, score: 0.5, notReached: false };
    expect(sectionScoreSummary([c])).toEqual({ right: 1, total: 2, blank: 0 });
  });
});

describe("splitTaskPrompt", () => {
  it("splits the topic and the card into separate lines", () => {
    expect(splitTaskPrompt('Thema: Arbeit. Auf Ihrer Karte steht: "Mittagspause?"')).toEqual(["Thema: Arbeit.", 'Auf Ihrer Karte steht: "Mittagspause?"']);
  });
  it("keeps existing line breaks and drops stray blank lines", () => {
    expect(splitTaskPrompt("\nSchreiben Sie eine E-Mail.\n\n\nMindestens 80 Wörter.\n")).toEqual(["Schreiben Sie eine E-Mail.", "", "Mindestens 80 Wörter."]);
  });
  it("leaves a prompt without either pattern as one line", () => {
    expect(splitTaskPrompt("Beschreiben Sie Ihren Tag.")).toEqual(["Beschreiben Sie Ihren Tag."]);
  });
  it("splits the card line when there is no topic line", () => {
    expect(splitTaskPrompt('Sprechen Sie. Auf deiner Karte steht: "Urlaub"')).toEqual(["Sprechen Sie.", 'Auf deiner Karte steht: "Urlaub"']);
  });
});
