import { describe, expect, it } from "vitest";
import { scoreItem } from "@/lib/exam/item-scoring";
import { textGapKindOf, wordBankWords } from "@/lib/exam/types";
import { validateItem } from "@/lib/exam/validate";
import { wordBank } from "./wordbank";

const spec = {
  title: "Mein Zimmer",
  first: "Ich wohne in Köln.",
  body: "Mein Zimmer ist sehr [[hell]]. Am [[Schreibtisch]] lerne ich Deutsch.",
  last: "Ich wohne gern hier.",
  distractors: ["Lampe", "schläfst", "liest"],
};

describe("wordBank", () => {
  const item = wordBank("A1", "MID", spec);

  it("is a GAP_FILL word-bank item that validates", () => {
    expect(item.type).toBe("GAP_FILL");
    expect(textGapKindOf(item)).toBe("WORDBANK");
    expect(validateItem(item)).toEqual([]);
  });

  it("marks the gaps, keeps title and intact sentences, and has no choices", () => {
    const [, title, text] = item.prompt.split("\n\n");
    expect(title).toBe("Mein Zimmer");
    expect(text).toBe("Ich wohne in Köln. Mein Zimmer ist sehr {{g1}}. Am {{g2}} lerne ich Deutsch. Ich wohne gern hier.");
    expect(item.content).toEqual({ kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] });
  });

  it("keeps the answers and the distractors in the key, and the pool is answers plus distractors", () => {
    expect(item.key).toEqual({
      kind: "GAP",
      answers: { g1: ["hell"], g2: ["Schreibtisch"] },
      distractors: ["Lampe", "schläfst", "liest"],
    });
    if (item.key.kind !== "GAP") throw new Error("not a gap key");
    expect(wordBankWords(["g1", "g2"], item.key.answers, item.key.distractors)).toEqual([
      "hell",
      "Schreibtisch",
      "Lampe",
      "schläfst",
      "liest",
    ]);
  });

  it("scores each gap on its own", () => {
    const s = scoreItem(item.type, item.content, item.key, { gaps: { g1: "hell", g2: "Lampe" } });
    expect(s?.score).toBe(0.5);
  });

  it("rejects fewer than three distractors", () => {
    expect(() => wordBank("A1", "MID", { ...spec, distractors: ["Lampe", "liest"] })).toThrow(/at least 3/);
  });

  it("rejects a distractor equal to an answer or to another distractor, also by spelling", () => {
    expect(() => wordBank("A1", "MID", { ...spec, distractors: ["Lampe", "liest", "Hell"] })).toThrow(/equals an answer/);
    expect(() => wordBank("A1", "MID", { ...spec, distractors: ["Lampe", "liest", "lampe"] })).toThrow(/repeats/);
  });

  it("rejects distractors and answers that are not one whole word, choices in a gap and repeated answers", () => {
    expect(() => wordBank("A1", "MID", { ...spec, distractors: ["Lampe", "liest", "zu Hause"] })).toThrow(/whole word/);
    expect(() => wordBank("A1", "MID", { ...spec, body: "Es ist [[sehr hell]]." })).toThrow(/whole word/);
    expect(() => wordBank("A1", "MID", { ...spec, body: "Es ist [[hell|dunkel]]." })).toThrow(/one answer/);
    expect(() => wordBank("A1", "MID", { ...spec, body: "Es ist [[hell]] und [[hell]]." })).toThrow(/repeats/);
    expect(() => wordBank("A1", "MID", { ...spec, body: "Es ist [[ ]]." })).toThrow(/no answer/);
  });
});
