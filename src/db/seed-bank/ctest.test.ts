import { describe, expect, it } from "vitest";
import { scoreItem } from "@/lib/exam/item-scoring";
import { validateItem } from "@/lib/exam/validate";
import { cTest, damageWord } from "./ctest";

describe("damageWord", () => {
  it("keeps the first half of an even word", () => {
    expect(damageWord("Haus")).toEqual({ kept: "Ha", missing: "us" });
  });
  it("deletes the larger half of an odd word", () => {
    expect(damageWord("und")).toEqual({ kept: "u", missing: "nd" });
    expect(damageWord("Arbeit")).toEqual({ kept: "Arb", missing: "eit" });
    expect(damageWord("schön")).toEqual({ kept: "sc", missing: "hön" });
  });
  it("deletes one letter of a two-letter word", () => {
    expect(damageWord("um")).toEqual({ kept: "u", missing: "m" });
  });
});

describe("cTest", () => {
  const item = cTest("A1", "MID", {
    first: "Ich heiße Lena.",
    body: "Ich bin 24 Jahre alt und arbeite in Köln.",
    last: "Das ist schön.",
  });

  it("keeps the first and the last sentence intact", () => {
    expect(item.prompt).toContain("Ich heiße Lena.");
    expect(item.prompt.trimEnd().endsWith("Das ist schön.")).toBe(true);
  });

  it("damages every second word from the second word on, skipping numbers and one-letter words", () => {
    // Ich [bin] 24 Jahre [alt] und [arbeite] in [Köln].
    expect(item.prompt).toContain("Ich b{{g1}} 24 Jahre a{{g2}} und arb{{g3}} in Kö{{g4}}.");
    expect(item.key).toEqual({
      kind: "GAP",
      answers: { g1: ["in", "bin"], g2: ["lt", "alt"], g3: ["eite", "arbeite"], g4: ["ln", "Köln"] },
    });
  });

  it("is a typed gap item that validates and scores per gap", () => {
    expect(item.type).toBe("GAP_FILL");
    expect(item.skillTag).toBe("grammar.ctest");
    expect(validateItem(item)).toEqual([]);
    const s = scoreItem(item.type, item.content, item.key, { gaps: { g1: "in", g2: "lt", g3: "x", g4: "" } });
    expect(s?.score).toBe(0.5);
  });

  it("adds extra accepted completions by gap number", () => {
    const v = cTest("A1", "MID", { first: "A b.", body: "Wir sehen das.", last: "C d.", variants: { 1: ["hn"] } });
    expect(v.key).toEqual({ kind: "GAP", answers: { g1: ["hen", "sehen", "hn", "sehn"] } });
  });

  it("scores the missing letters and the whole typed word alike, also for variants", () => {
    const v = cTest("A1", "MID", { first: "A b.", body: "Wir sehen das.", last: "C d.", variants: { 1: ["hn"] } });
    for (const typed of ["hen", "sehen", "Sehen", "hn", "sehn"]) {
      expect(scoreItem(v.type, v.content, v.key, { gaps: { g1: typed } })?.score, typed).toBe(1);
    }
    expect(scoreItem(v.type, v.content, v.key, { gaps: { g1: "sehe" } })?.score).toBe(0);
    const both = scoreItem(item.type, item.content, item.key, { gaps: { g1: "in", g2: "alt", g3: "arbeite", g4: "ln" } });
    expect(both?.score).toBe(1);
  });

  it("tells the student to type only the missing letters, in its own paragraph", () => {
    const [instruction, text] = item.prompt.split("\n\n");
    expect(instruction).toContain("Schreiben Sie nur die fehlenden Buchstaben.");
    expect(text.startsWith("Ich heiße Lena.")).toBe(true);
  });
});
