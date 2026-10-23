import { describe, expect, it } from "vitest";
import type { ItemSnapshot } from "@/lib/exam/types";
import { answerText, keyText } from "./format";
import { canAcceptAsCorrect, canAcceptGap, gapScore, objectiveBasis, responseState, reviewRows } from "./review-rows";

const base = { id: "i", section: "READING", level: "B1", difficulty: 0, skillTag: "x", stimulusId: null, orderInStimulus: 0, prompt: "p", rubric: null, points: 1, stimulus: null } as const;

const matching = {
  ...base,
  type: "MATCHING",
  content: { kind: "MATCHING", left: [{ id: "l1", text: "Text 1" }, { id: "l2", text: "Text 2" }], right: [{ id: "a", text: "Anzeige A" }, { id: "b", text: "Anzeige B" }] },
  key: { kind: "MATCHING", pairs: { l1: "a", l2: "b" } },
} as ItemSnapshot;
const tfng = {
  ...base,
  type: "TRUE_FALSE_NG",
  content: { kind: "TFNG", statements: [{ id: "s1", text: "Er kommt." }, { id: "s2", text: "Sie bleibt." }] },
  key: { kind: "TFNG", answers: { s1: "R", s2: "NG" } },
} as ItemSnapshot;
const gap = {
  ...base,
  type: "GAP_FILL",
  content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] },
  key: { kind: "GAP", answers: { g1: ["dem", "diesem"], g2: ["ins"] } },
} as ItemSnapshot;
const choice = {
  ...base,
  type: "SINGLE_CHOICE",
  content: { kind: "CHOICE", options: [{ id: "o1", text: "eins" }, { id: "o2", text: "zwei" }] },
  key: { kind: "CHOICE", correct: ["o2"] },
} as ItemSnapshot;
const short = { ...base, type: "SHORT_TEXT", content: { kind: "SHORT_TEXT", maxChars: 40 }, key: { kind: "SHORT_TEXT", accepted: ["Berlin"] } } as ItemSnapshot;

const tf = (c: string) => ({ R: "Doğru", F: "Yanlış", NG: "Metinde yok" })[c] ?? c;

describe("reviewRows", () => {
  it("matching: each row has the chosen target, the key target and a mark", () => {
    const v = reviewRows(matching, { matches: { l1: "a", l2: "a" } })!;
    expect(v.variant).toBe("MATCHING");
    expect(v.rows).toEqual([
      { id: "l1", label: "Text 1", given: "Anzeige A", key: "Anzeige A", mark: "correct" },
      { id: "l2", label: "Text 2", given: "Anzeige A", key: "Anzeige B", mark: "wrong" },
    ]);
  });
  it("matching: a row left empty is blank", () => {
    expect(reviewRows(matching, { matches: { l1: "a" } })!.rows[1]).toMatchObject({ given: "", mark: "blank" });
  });
  it("true/false/not given: codes stay codes, marks follow the key", () => {
    const v = reviewRows(tfng, { tfng: { s1: "R", s2: "F" } })!;
    expect(v.rows.map((r) => [r.given, r.key, r.mark])).toEqual([
      ["R", "R", "correct"],
      ["F", "NG", "wrong"],
    ]);
  });
  it("gap: typed text, every accepted spelling, tolerant matching", () => {
    const v = reviewRows(gap, { gaps: { g1: " Dem. ", g2: "im" } })!;
    expect(v.rows[0]).toMatchObject({ label: "1", given: " Dem. ", key: "dem / diesem", mark: "correct" });
    expect(v.rows[1]).toMatchObject({ label: "2", key: "ins", mark: "wrong" });
  });
  it("returns null for types without parts", () => {
    expect(reviewRows(choice, { choiceIds: ["o1"] })).toBeNull();
    expect(reviewRows(short, { text: "x" })).toBeNull();
  });
  it("an empty answer gives all-blank rows for every part type", () => {
    for (const s of [matching, tfng, gap]) expect(reviewRows(s, {})!.rows.every((r) => r.mark === "blank")).toBe(true);
    expect(reviewRows(gap, null)!.rows).toHaveLength(2);
  });
});

describe("answerText and keyText", () => {
  it("an empty answer {} is the empty string for every type, so the blank label shows", () => {
    for (const s of [matching, tfng, gap, choice, short]) {
      expect(answerText(s, {})).toBe("");
      expect(answerText(s, null)).toBe("");
    }
  });
  it("a picture choice without text is named by its letter and alt text", () => {
    const pics: ItemSnapshot = {
      ...choice,
      content: { kind: "CHOICE", options: [{ id: "a", text: "", image: { storageKey: "bank/images/0123456789abcdef.webp", w: 1, h: 1, alt: "Ein Hund." } }, { id: "b", text: "", image: { storageKey: "bank/images/fedcba9876543210.webp", w: 1, h: 1, alt: "Eine Katze." } }, { id: "c", text: "Baum" }] },
      key: { kind: "CHOICE", correct: ["b"] },
    };
    expect(keyText(pics)).toBe("B: Eine Katze.");
    expect(answerText(pics, { choiceIds: ["a", "c"] })).toBe("A: Ein Hund., Baum");
  });
  it("matching", () => {
    expect(answerText(matching, { matches: { l1: "a" } })).toBe("1→Anzeige A  2→-");
    expect(keyText(matching)).toBe("1→Anzeige A  2→Anzeige B");
  });
  it("true/false/not given translates the codes when asked", () => {
    expect(answerText(tfng, { tfng: { s1: "R" } })).toBe("1: R  2: -");
    expect(answerText(tfng, { tfng: { s1: "R" } }, tf)).toBe("1: Doğru  2: -");
    expect(keyText(tfng, tf)).toBe("1: Doğru  2: Metinde yok");
  });
  it("gap", () => {
    expect(answerText(gap, { gaps: { g1: "dem" } })).toBe("dem | -");
    expect(answerText(gap, { gaps: { g1: "  ", g2: "" } })).toBe("");
    expect(keyText(gap)).toBe("dem / diesem | ins");
  });
  it("choice and short text", () => {
    expect(answerText(choice, { choiceIds: ["o1"] })).toBe("eins");
    expect(keyText(choice)).toBe("zwei");
    expect(answerText(short, { text: "Bonn" })).toBe("Bonn");
    expect(keyText(short)).toBe("Berlin");
  });
});

describe("responseState", () => {
  const r = (answer: object | null, notReached: boolean) => ({ itemSnapshot: gap, answer, notReached });
  it("an answered item is answered", () => {
    expect(responseState(r({ gaps: { g1: "dem" } }, false), { navigable: true })).toBe("ANSWERED");
  });
  it("a navigable blank is blank even when stored as not reached", () => {
    expect(responseState(r({}, true), { navigable: true })).toBe("BLANK");
    expect(responseState(r(null, false), { navigable: true })).toBe("BLANK");
  });
  it("in a one-way section the flag decides", () => {
    expect(responseState(r({}, true), { navigable: false })).toBe("NOT_REACHED");
    expect(responseState(r({}, false), { navigable: false })).toBe("BLANK");
    expect(responseState(r(null, true), undefined)).toBe("NOT_REACHED");
  });
});

describe("objectiveBasis", () => {
  const rr = (score: number | null, answer: object | null, answered = true) => ({ itemSnapshot: matching, answer, answeredAt: answered ? new Date() : null, score });
  it("partial credit counts as its fraction, not as zero", () => {
    const m = { matches: { l1: "a" } };
    expect(objectiveBasis([rr(0.8, m), rr(0.75, m), rr(1, m), rr(0, m)])).toEqual({ answered: 4, pct: 64, partial: 2 });
  });
  it("blank and unreached items are not part of the answered count", () => {
    expect(objectiveBasis([rr(0, {}), rr(0, null, false), rr(1, { matches: { l1: "a" } })])).toEqual({ answered: 1, pct: 100, partial: 0 });
    expect(objectiveBasis([])).toEqual({ answered: 0, pct: 0, partial: 0 });
  });
});

describe("per-gap acceptance", () => {
  it("a single-gap item: a typed gap the key does not take can be accepted and scores 1", () => {
    const one = { ...gap, content: { kind: "GAP", gaps: [{ id: "g1" }] }, key: { kind: "GAP", answers: { g1: ["dem"] } } } as ItemSnapshot;
    expect(canAcceptGap(one, { gaps: { g1: "diesem Haus" } }, "g1")).toBe(true);
    expect(gapScore(one, { gaps: { g1: "diesem Haus" } }, ["g1"])).toBe(1);
    expect(gapScore(one, { gaps: { g1: "diesem Haus" } })).toBe(0);
  });
  it("a multi-gap item scores (key-correct + accepted) / all gaps, not 1", () => {
    const a = { gaps: { g1: "dem", g2: "im" } };
    expect(gapScore(gap, a)).toBe(0.5);
    expect(canAcceptGap(gap, a, "g2")).toBe(true);
    expect(gapScore(gap, a, ["g2"])).toBe(1);
    // only g1 filled: accepting it can never credit the empty gap
    expect(gapScore(gap, { gaps: { g1: "irgendwas" } }, ["g1"])).toBe(0.5);
  });
  it("an empty or blank gap can never be accepted, nor one the key already takes, nor one already accepted", () => {
    const a = { gaps: { g1: "dem", g2: "  " } };
    expect(canAcceptGap(gap, a, "g2")).toBe(false);
    expect(canAcceptGap(gap, {}, "g2")).toBe(false);
    expect(canAcceptGap(gap, a, "g1")).toBe(false);
    expect(canAcceptGap(gap, { gaps: { g1: "x" } }, "g1", ["g1"])).toBe(false);
    expect(canAcceptGap(gap, { gaps: { g1: "x" } }, "nope")).toBe(false);
    expect(canAcceptGap(short, { text: "x" }, "g1")).toBe(false);
    expect(gapScore(gap, { gaps: { g1: " " } }, ["g1"])).toBe(0);
  });
  it("an MC cloze or word-bank gap is never accepted: the student picked a given option; a C-test gap still is", () => {
    const one = { ...gap, content: { kind: "GAP", gaps: [{ id: "g1" }] }, key: { kind: "GAP", answers: { g1: ["dem"] } } } as ItemSnapshot;
    const a = { gaps: { g1: "den" } };
    expect(canAcceptGap({ ...one, skillTag: "grammar.cloze" }, a, "g1")).toBe(false);
    expect(canAcceptGap({ ...one, skillTag: "grammar.wordbank" }, a, "g1")).toBe(false);
    expect(canAcceptGap({ ...one, skillTag: "grammar.ctest" }, a, "g1")).toBe(true);
  });
  it("the row view marks accepted gaps", () => {
    const v = reviewRows(gap, { gaps: { g1: "x", g2: "" } }, ["g1", "g2"])!;
    expect(v.rows.map((r) => r.mark)).toEqual(["accepted", "blank"]);
  });
});

describe("canAcceptAsCorrect", () => {
  it("only short typed answers are accepted as a whole; gap items go gap by gap", () => {
    expect(canAcceptAsCorrect({ itemSnapshot: gap, answer: { gaps: { g1: "x" } }, score: 0.5 })).toBe(false);
    expect(canAcceptAsCorrect({ itemSnapshot: short, answer: { text: "x" }, score: 0 })).toBe(true);
    expect(canAcceptAsCorrect({ itemSnapshot: short, answer: { text: "Berlin" }, score: 1 })).toBe(false);
    expect(canAcceptAsCorrect({ itemSnapshot: short, answer: {}, score: 0 })).toBe(false);
    expect(canAcceptAsCorrect({ itemSnapshot: matching, answer: { matches: { l1: "b" } }, score: 0 })).toBe(false);
    expect(canAcceptAsCorrect({ itemSnapshot: choice, answer: { choiceIds: ["o1"] }, score: 0 })).toBe(false);
  });
});
