import { describe, expect, it } from "vitest";
import { hasAnswer, normalizeAnswer, scoreItem, typedMatches, wordCount } from "./item-scoring";

const choice = {
  kind: "CHOICE" as const,
  options: [
    { id: "a", text: "der" },
    { id: "b", text: "die" },
    { id: "c", text: "das" },
    { id: "d", text: "dem" },
  ],
};

describe("typed answers", () => {
  it("ignores case, spacing and trailing punctuation", () => {
    expect(normalizeAnswer("  Dem   Mann. ")).toBe("dem mann");
    expect(typedMatches("DEM", ["dem"])).toBe(true);
  });

  it("accepts ss for ß and ae/oe/ue for umlauts", () => {
    expect(typedMatches("heisst", ["heißt"])).toBe(true);
    expect(typedMatches("fuer", ["für"])).toBe(true);
    expect(typedMatches("Mädchen", ["Maedchen"])).toBe(true);
  });

  it("does not accept a different word", () => {
    expect(typedMatches("den", ["dem"])).toBe(false);
    expect(typedMatches("", ["dem"])).toBe(false);
  });
});

describe("scoring", () => {
  it("single choice is all or nothing", () => {
    const key = { kind: "CHOICE" as const, correct: ["d"] };
    expect(scoreItem("SINGLE_CHOICE", choice, key, { choiceIds: ["d"] })).toEqual({ score: 1, correct: true });
    expect(scoreItem("SINGLE_CHOICE", choice, key, { choiceIds: ["a"] })).toEqual({ score: 0, correct: false });
    expect(scoreItem("SINGLE_CHOICE", choice, key, { choiceIds: ["a", "d"] })?.score).toBe(0);
    expect(scoreItem("SINGLE_CHOICE", choice, key, null)?.score).toBe(0);
  });

  it("multi choice subtracts wrong picks and never goes negative", () => {
    const key = { kind: "CHOICE" as const, correct: ["a", "b"] };
    expect(scoreItem("MULTI_CHOICE", choice, key, { choiceIds: ["a"] })?.score).toBe(0.5);
    expect(scoreItem("MULTI_CHOICE", choice, key, { choiceIds: ["a", "c"] })?.score).toBe(0);
    expect(scoreItem("MULTI_CHOICE", choice, key, { choiceIds: ["c", "d"] })?.score).toBe(0);
    expect(scoreItem("MULTI_CHOICE", choice, key, { choiceIds: ["a", "b"] })?.correct).toBe(true);
  });

  it("gap fill gives a share per gap", () => {
    const content = { kind: "GAP" as const, gaps: [{ id: "g1" }, { id: "g2" }] };
    const key = { kind: "GAP" as const, answers: { g1: ["bin"], g2: ["gegangen"] } };
    expect(scoreItem("GAP_FILL", content, key, { gaps: { g1: "bin", g2: "gegeht" } })?.score).toBe(0.5);
  });

  it("true / false / not given counts each statement", () => {
    const content = { kind: "TFNG" as const, statements: [{ id: "s1", text: "x" }, { id: "s2", text: "y" }] };
    const key = { kind: "TFNG" as const, answers: { s1: "R" as const, s2: "NG" as const } };
    expect(scoreItem("TRUE_FALSE_NG", content, key, { tfng: { s1: "R", s2: "F" } })?.score).toBe(0.5);
  });

  it("matching counts each row", () => {
    const content = {
      kind: "MATCHING" as const,
      left: [{ id: "l1", text: "" }, { id: "l2", text: "" }],
      right: [{ id: "r1", text: "" }, { id: "r2", text: "" }, { id: "r3", text: "" }],
    };
    const key = { kind: "MATCHING" as const, pairs: { l1: "r2", l2: "r1" } };
    expect(scoreItem("MATCHING", content, key, { matches: { l1: "r2", l2: "r2" } })?.score).toBe(0.5);
  });

  it("productive items are not scored here", () => {
    expect(scoreItem("WRITING_PROMPT", { kind: "WRITING", minWords: 50, maxWords: 80 }, { kind: "NONE" }, { text: "Hallo" })).toBe(null);
  });
});

describe("answered", () => {
  it("knows an empty answer from a given one", () => {
    expect(hasAnswer("GAP_FILL", { gaps: { g1: "  " } })).toBe(false);
    expect(hasAnswer("GAP_FILL", { gaps: { g1: "bin" } })).toBe(true);
    expect(hasAnswer("SPEAKING_PROMPT", { mediaAssetId: "m" })).toBe(true);
    expect(wordCount("  Ich  bin hier. ")).toBe(3);
  });
});
