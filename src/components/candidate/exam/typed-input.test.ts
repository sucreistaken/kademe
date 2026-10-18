import { describe, expect, it } from "vitest";
import { entersByTyping } from "./typed-input";

describe("typed or clicked answers", () => {
  it("writing, short text and speaking are typed", () => {
    expect(entersByTyping({ kind: "WRITING", minWords: 10, maxWords: 40 })).toBe(true);
    expect(entersByTyping({ kind: "SHORT_TEXT", maxChars: 40 })).toBe(true);
    expect(entersByTyping({ kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 60, maxTakes: 1 })).toBe(true);
  });

  it("a gap with free input is typed", () => {
    expect(entersByTyping({ kind: "GAP", gaps: [{ id: "g1", choices: null }] })).toBe(true);
  });

  it("cloze options, word-bank words, C-test parts and drop-downs are clicks", () => {
    const choices = ["a", "b", "c", "d"];
    expect(entersByTyping({ kind: "GAP", cloze: true, gaps: [{ id: "g1", choices }] })).toBe(false);
    expect(entersByTyping({ kind: "GAP", pool: ["das", "ein"], gaps: [{ id: "g1", choices: null }] })).toBe(false);
    expect(entersByTyping({ kind: "GAP", attached: true, pool: ["ön"], gaps: [{ id: "g1", choices: null }] })).toBe(false);
    expect(entersByTyping({ kind: "GAP", gaps: [{ id: "g1", choices }] })).toBe(false);
  });

  it("choices, true/false and matching are clicks", () => {
    expect(entersByTyping({ kind: "CHOICE", multiple: false, options: [] })).toBe(false);
    expect(entersByTyping({ kind: "TFNG", statements: [] })).toBe(false);
    expect(entersByTyping({ kind: "MATCHING", left: [], right: [] })).toBe(false);
    expect(entersByTyping(undefined)).toBe(false);
  });
});
