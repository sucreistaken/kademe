import { describe, expect, it } from "vitest";
import type { ItemSnapshot } from "@/lib/exam/types";
import { gapSegments, plainPrompt, reviewCard, sectionScoreSummary, splitTaskPrompt } from "./review-cards";

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
    expect(segs[0]).toEqual({ kind: "text", text: "Anleitung.\n\nIch " });
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
      { kind: "gap", id: "g1", n: 1, stem: "", given: "dem", shown: "dem", expected: "das", mark: "accepted" },
      { kind: "text", text: " Kino." },
    ]);
  });
  it("returns null for an item that is not a gap item", () => {
    expect(gapSegments({ ...grammarGap, content: { kind: "SHORT_TEXT", maxChars: 5 }, key: { kind: "NONE" } } as ItemSnapshot, null)).toBeNull();
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
  it("sectionScoreSummary counts full marks, items served and blanks", () => {
    const r = (score: number | null, answer: object | null) => ({ itemSnapshot: grammarGap, answer, score });
    expect(sectionScoreSummary([r(1, { gaps: { g1: "das" } }), r(0, { gaps: { g1: "x" } }), r(0.5, { gaps: { g1: "x" } }), r(0, null)])).toEqual({ right: 1, total: 4, blank: 1 });
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
