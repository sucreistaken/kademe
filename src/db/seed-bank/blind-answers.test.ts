import { describe, expect, it } from "vitest";
import { parseAnswerFile, parseTfng, toItemAnswer } from "./blind-answers";

const K1 = "grammar-b1-0123456789abcdef";
const K2 = "reading-b1-fedcba9876543210";

describe("parseAnswerFile", () => {
  it("reads key lines, ignores surrounding Markdown and handles commas in values", () => {
    const text = [
      "# Blind solve",
      "```",
      `${K1}: g1=dem, g2=den Hund, g3=a, b`,
      `${K2}: s1=R, s2=F`,
      "```",
      "free text: with colon",
    ].join("\n");
    const out = parseAnswerFile(text);
    expect([...out.keys()]).toEqual([K1, K2]);
    expect(Object.fromEntries(out.get(K1)!)).toEqual({ g1: "dem", g2: "den Hund", g3: "a, b" });
    expect(Object.fromEntries(out.get(K2)!)).toEqual({ s1: "R", s2: "F" });
  });
});

describe("toItemAnswer", () => {
  it("treats the template placeholder and empty values as unanswered", () => {
    const pairs = new Map([["g1", "..."], ["g2", ""]]);
    expect(toItemAnswer({ kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] }, pairs)).toBeNull();
    expect(toItemAnswer({ kind: "GAP", gaps: [] }, undefined)).toBeNull();
  });
  it("parses choice lists, tfng words and matching letters", () => {
    expect(toItemAnswer({ kind: "CHOICE", options: [] }, new Map([["choice", "a, c"]]))).toEqual({ choiceIds: ["a", "c"] });
    expect(toItemAnswer({ kind: "TFNG", statements: [] }, new Map([["s1", "richtig"], ["s2", "NG"], ["s3", "?"]]))).toEqual({
      tfng: { s1: "R", s2: "NG" },
    });
    expect(
      toItemAnswer({ kind: "MATCHING", left: [], right: [] }, new Map([["l1", "b"], ["l2", "Z"]]), { A: "r1", B: "r2" }),
    ).toEqual({ matches: { l1: "r2" } });
  });
  it("maps Ja / Nein words to R / F / NG and reads open gaps like typed gaps", () => {
    expect(parseTfng("ja", "JA_NEIN")).toBe("R");
    expect(parseTfng("J", "JA_NEIN")).toBe("R");
    expect(parseTfng("n", "JA_NEIN")).toBe("F");
    expect(parseTfng("Nein", "JA_NEIN")).toBe("F");
    expect(parseTfng("t", "JA_NEIN")).toBe("NG");
    expect(parseTfng("Text sagt dazu nichts", "JA_NEIN")).toBe("NG");
    expect(parseTfng("n")).toBe("NG");
    expect(
      toItemAnswer(
        { kind: "TFNG", statements: [], wording: "JA_NEIN" },
        new Map([["s1", "J"], ["s2", "n"], ["s3", "T"]]),
      ),
    ).toEqual({ tfng: { s1: "R", s2: "F", s3: "NG" } });
    expect(toItemAnswer({ kind: "GAP", gaps: [{ id: "g1" }] }, new Map([["g1", "weil"]]))).toEqual({ gaps: { g1: "weil" } });
  });
  it("parseTfng accepts the long forms", () => {
    expect(parseTfng("Nicht im Text")).toBe("NG");
    expect(parseTfng("falsch")).toBe("F");
    expect(parseTfng("x")).toBeUndefined();
  });
});
