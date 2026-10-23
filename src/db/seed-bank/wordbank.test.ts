import { describe, expect, it } from "vitest";
import { scoreItem } from "@/lib/exam/item-scoring";
import { textGapKindOf, wordBankWords } from "@/lib/exam/types";
import { validateItem } from "@/lib/exam/validate";
import { SEED_BANK } from "./index";
import { seedItemKey } from "./seed-key";
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

describe("wordBank #topic", () => {
  const plain = wordBank("A1", "MID", spec);
  const tagged = wordBank("A1", "MID", {
    ...spec,
    body: "Mein Zimmer ist sehr [[hell#adjektiv]]. Am [[Schreibtisch#nomen]] lerne ich Deutsch.",
  });

  it("strips the suffix and stores it in key.topics, keeping the distractors", () => {
    expect(tagged.key).toEqual({
      kind: "GAP",
      answers: { g1: ["hell"], g2: ["Schreibtisch"] },
      distractors: spec.distractors,
      topics: { g1: "adjektiv", g2: "nomen" },
    });
    expect(tagged.prompt).not.toContain("#");
    expect(plain.key).not.toHaveProperty("topics");
    expect(validateItem(tagged)).toEqual([]);
  });

  it("keeps prompt, content and seed key unchanged for a shipped text", () => {
    const real = SEED_BANK.items.find((i) => i.skillTag === "grammar.wordbank" && i.prompt.includes("Mein Zimmer ist klein"));
    if (!real) throw new Error("shipped text not found");
    const rebuilt = wordBank("A1", "EASY", {
      title: "Mein Zimmer",
      first: "Ich wohne mit zwei Freunden in einer Wohnung in Köln.",
      body:
        "Mein Zimmer ist klein, aber sehr [[hell#adjektiv]], [[denn#konnektor]] es hat zwei große Fenster. " +
        "Am [[Schreibtisch]] lerne ich jeden Abend Deutsch. Im Regal stehen viele [[Bücher]]. " +
        "Ich schlafe gut: Mein [[Bett]] ist neu und bequem. " +
        "In der Küche [[koche]] ich am Wochenende für meine Freunde. Am Samstag essen wir immer zusammen. " +
        "Im [[Kühlschrank]] haben wir immer Milch und Käse. Die Miete [[kostet]] nur 400 Euro im Monat.",
      last: "Ich wohne sehr gern hier.",
      distractors: ["weil", "dunkel", "Lampe", "kochst", "kosten"],
    });
    const input = (i: typeof real) => ({ section: i.section, level: i.level, type: i.type, prompt: i.prompt, content: i.content, stimulusKey: null });
    expect(seedItemKey(input(rebuilt))).toBe(seedItemKey(input(real)));
    expect(rebuilt.key).toMatchObject({ topics: { g1: "adjektiv", g2: "konnektor" } });
  });

  it("rejects an empty topic", () => {
    expect(() => wordBank("A1", "MID", { ...spec, body: "Es ist [[hell#]]." })).toThrow(/empty topic/);
  });
});
