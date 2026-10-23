import { ALLOWED_INSTRUCTIONS } from "./originality-allow";
import { describe, expect, it } from "vitest";
import {
  addSource,
  findHits,
  isStopShingle,
  itemStrings,
  promptInContext,
  shingles,
  stimulusStrings,
  tokenize,
  type SourceIndex,
} from "./originality";
import type { SeedItem, SeedStimulus } from "./types";

describe("tokenize", () => {
  it("lower-cases, strips punctuation, collapses whitespace and keeps umlauts", () => {
    expect(tokenize("  Über   Käse, und BRÖT!\n\nNeu: 3 Stück. ")).toEqual(["über", "käse", "und", "bröt", "neu", "3", "stück"]);
  });
});

describe("shingles", () => {
  it("makes 8-word windows", () => {
    const s = shingles("Anna fährt morgen früh mit dem Zug nach Hamburg zur Konferenz");
    expect(s).toEqual([
      "anna fährt morgen früh mit dem zug nach",
      "fährt morgen früh mit dem zug nach hamburg",
      "morgen früh mit dem zug nach hamburg zur",
      "früh mit dem zug nach hamburg zur konferenz",
    ]);
  });
  it("gives nothing for fewer than 8 words", () => {
    expect(shingles("nur sieben Wörter stehen hier im Satz")).toEqual([]);
  });
  it("drops a shingle with 6 or more stop words and keeps one with 5", () => {
    expect(isStopShingle(["das", "ist", "nicht", "der", "die", "und", "haus", "garten"])).toBe(true);
    expect(isStopShingle(["das", "ist", "nicht", "der", "die", "tisch", "haus", "garten"])).toBe(false);
    expect(shingles("es ist nicht so dass wir es nur")).toEqual([]);
  });
});

describe("findHits", () => {
  const index: SourceIndex = new Map();
  addSource(index, "buch.txt", "Im Sommer fahren viele Familien gern mit dem Fahrrad an den See.");
  it("finds a copied run of 8 words regardless of case and punctuation", () => {
    const hits = findHits("Man sagt: viele FAMILIEN, gern mit dem Fahrrad an den Strand!", index);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({ shingle: "viele familien gern mit dem fahrrad an den", source: "buch.txt" });
  });
  it("finds nothing for 7 shared words", () => {
    expect(findHits("viele Familien gern mit dem Fahrrad an", index)).toEqual([]);
  });
});

describe("bank strings", () => {
  const item: SeedItem = {
    section: "GRAMMAR",
    level: "B1",
    type: "GAP_FILL",
    skillTag: "grammar.dativ",
    prompt: "Ich gebe {{g1}} Kind einen Apfel.",
    content: { kind: "GAP", gaps: [{ id: "g1" }] },
    key: { kind: "GAP", answers: { g1: ["dem"] } },
  };
  it("fills gaps with the first accepted answer", () => {
    expect(promptInContext(item)).toBe("Ich gebe dem Kind einen Apfel.");
    expect(itemStrings(item, "grammar-b1-x").map((s) => s.text)).toEqual(["Ich gebe dem Kind einen Apfel."]);
  });
  it("includes key distractors and writing student points", () => {
    const gap: SeedItem = {
      section: "GRAMMAR",
      level: "B1",
      type: "GAP_FILL",
      skillTag: "grammar.wordbank",
      prompt: "Ich esse {{g1}}.",
      content: { kind: "GAP", gaps: [{ id: "g1" }] },
      key: { kind: "GAP", answers: { g1: ["Brot"] }, distractors: ["Käse", "Wurst"] },
    };
    expect(itemStrings(gap, "k").map((s) => s.text)).toEqual(["Ich esse Brot.", "Käse", "Wurst"]);
    const writing: SeedItem = {
      section: "WRITING",
      level: "B1",
      type: "WRITING_PROMPT",
      skillTag: "writing.email",
      prompt: "Schreiben Sie.",
      content: { kind: "WRITING", minWords: 40, maxWords: 80 },
      key: { kind: "NONE" },
      rubric: { contentPoints: ["x"], studentPoints: ["einen Grund nennen"] },
    };
    expect(itemStrings(writing, "k").map((s) => s.text)).toEqual(["Schreiben Sie.", "einen Grund nennen"]);
  });
  it("strips speaker labels from listening scripts only", () => {
    const base = { key: "l-1", level: "B1" as const, title: "T", topic: "x" };
    const listening: SeedStimulus = { ...base, section: "LISTENING", body: "Anna: Guten Tag.\nBen: Hallo." };
    const reading: SeedStimulus = { ...base, section: "READING", body: "Hinweis: Guten Tag." };
    expect(stimulusStrings(listening)[1].text).toBe("Guten Tag.\nHallo.");
    expect(stimulusStrings(reading)[1].text).toBe("Hinweis: Guten Tag.");
  });
});

describe("allowed instruction formulas", () => {
  const index: SourceIndex = new Map();
  addSource(index, "buch.txt", "Nehmen Sie Stellung und begründen Sie Ihre Meinung. Gehen Sie auf die Frage ein.");
  it("does not count a shingle made only of allowed instruction phrases", () => {
    const seed = "Und begründen Sie Ihre Meinung. Gehen Sie auf";
    expect(findHits(seed, index)).toHaveLength(1);
    expect(findHits(seed, index, ALLOWED_INSTRUCTIONS)).toEqual([]);
  });
  it("still counts an 8-word overlap that is not covered by allowed phrases", () => {
    const idx: SourceIndex = new Map();
    addSource(idx, "buch.txt", "Der Zug nach Hamburg fährt jeden Morgen pünktlich um sieben ab.");
    expect(findHits("Der Zug nach Hamburg fährt jeden Morgen pünktlich", idx, ALLOWED_INSTRUCTIONS)).toHaveLength(1);
  });
});
