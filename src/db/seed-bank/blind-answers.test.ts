import { describe, expect, it } from "vitest";
import { scoreItem } from "@/lib/exam/item-scoring";
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

describe("parseAnswerFile with a course form's seed keys", () => {
  const C1 = "course-b1-1-a-reading-b1-0123456789abcdef";
  const C2 = "course-b1-a-grammar-b1-fedcba9876543210";

  it("reads the longer keys of a course form, with or without a list bullet or backticks", () => {
    const out = parseAnswerFile([`${C1}: s1=R, s2=F`, `- \`${C2}\`: g1=dem`, "course-b1-a-grammar-b1: not a key line"].join("\n"));
    expect([...out.keys()]).toEqual([C1, C2]);
    expect(Object.fromEntries(out.get(C1)!)).toEqual({ s1: "R", s2: "F" });
    expect(Object.fromEntries(out.get(C2)!)).toEqual({ g1: "dem" });
  });

  it("still ignores Markdown that merely looks like a key", () => {
    const out = parseAnswerFile(["## 3. READING", "### Text: Reise", "**Aufgabe:** Was stimmt?", "Antwort je Aussage: R (richtig) oder F (falsch).", "- (a) Eins"].join("\n"));
    expect([...out.keys()]).toEqual([]);
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
  it("reads a short answer's text= line and scores it with the engine", () => {
    const content = { kind: "SHORT_TEXT" as const, maxChars: 40 };
    const key = { kind: "SHORT_TEXT" as const, accepted: ["42%"] };
    const raw = parseAnswerFile(`${K2}: text=42 %`);
    const answer = toItemAnswer(content, raw.get(K2));
    expect(answer).toEqual({ text: "42 %" });
    expect(scoreItem("SHORT_TEXT", content, key, answer)).toEqual({ score: 1, correct: true });
    expect(toItemAnswer(content, new Map([["text", "..."]]))).toBeNull();
  });
  it("parseTfng accepts the long forms", () => {
    expect(parseTfng("Nicht im Text")).toBe("NG");
    expect(parseTfng("falsch")).toBe("F");
    expect(parseTfng("x")).toBeUndefined();
  });
});
