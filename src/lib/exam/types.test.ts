import { describe, expect, it } from "vitest";
import { CLOZE_SKILL_TAG, C_TEST_SKILL_TAG, isCTest, isTextGap, textGapKindOf, WORD_BANK_SKILL_TAG, wordBankWords } from "./types";

describe("text-gap kinds", () => {
  it("tells C-test, MC cloze and word bank apart by skill tag", () => {
    expect(CLOZE_SKILL_TAG).toBe("grammar.cloze");
    expect(WORD_BANK_SKILL_TAG).toBe("grammar.wordbank");
    expect(textGapKindOf({ skillTag: C_TEST_SKILL_TAG })).toBe("CTEST");
    expect(textGapKindOf({ skillTag: CLOZE_SKILL_TAG })).toBe("CLOZE");
    expect(textGapKindOf({ skillTag: WORD_BANK_SKILL_TAG })).toBe("WORDBANK");
    expect(textGapKindOf({ skillTag: "grammar.dativ" })).toBeNull();
  });

  it("isTextGap covers every kind, isCTest only the C-test", () => {
    for (const skillTag of [C_TEST_SKILL_TAG, CLOZE_SKILL_TAG, WORD_BANK_SKILL_TAG]) expect(isTextGap({ skillTag })).toBe(true);
    expect(isTextGap({ skillTag: "reading.detail" })).toBe(false);
    expect(isCTest({ skillTag: C_TEST_SKILL_TAG })).toBe(true);
    expect(isCTest({ skillTag: CLOZE_SKILL_TAG })).toBe(false);
    expect(isCTest({ skillTag: WORD_BANK_SKILL_TAG })).toBe(false);
  });

  it("wordBankWords: the first answer per gap in gap order, then the distractors; a shared answer twice", () => {
    expect(wordBankWords(["g2", "g1"], { g1: ["den", "dem"], g2: ["der"] }, ["die", "das"])).toEqual(["der", "den", "die", "das"]);
    expect(wordBankWords(["g1", "g2"], { g1: ["der"], g2: ["der"] }, ["die"])).toEqual(["der", "der", "die"]);
    expect(wordBankWords(["g1", "g9"], { g1: ["der"] }, [" ", "die"])).toEqual(["der", "die"]);
  });
});
