import { describe, expect, it } from "vitest";
import { scoreItem } from "@/lib/exam/item-scoring";
import { textGapKindOf } from "@/lib/exam/types";
import { validateItem } from "@/lib/exam/validate";
import { cloze } from "./cloze";
import { seedItemKey } from "./seed-key";

const spec = {
  title: "Im Café",
  first: "Lena geht ins Café.",
  body: "Sie [[trinkt|trinke|trinken|trinkst]] einen Tee und isst [[ein|eine|einen|einem]] Brot.",
  last: "Dann geht sie nach Hause.",
};

describe("cloze", () => {
  const item = cloze("A1", "EASY", spec);

  it("is a GAP_FILL cloze item that validates", () => {
    expect(item.type).toBe("GAP_FILL");
    expect(item.section).toBe("GRAMMAR");
    expect(textGapKindOf(item)).toBe("CLOZE");
    expect(validateItem(item)).toEqual([]);
  });

  it("writes instruction, title and text as paragraphs with numbered markers", () => {
    const [instruction, title, text] = item.prompt.split("\n\n");
    expect(instruction).toContain("Wählen Sie");
    expect(title).toBe("Im Café");
    expect(text).toBe("Lena geht ins Café. Sie {{g1}} einen Tee und isst {{g2}} Brot. Dann geht sie nach Hause.");
  });

  it("stores the answer and its three distractors as the choices, one answer per gap in the key", () => {
    if (item.content.kind !== "GAP" || item.key.kind !== "GAP") throw new Error("not a gap item");
    expect(item.content.gaps.map((g) => [...(g.choices ?? [])].sort())).toEqual([
      ["trinke", "trinken", "trinkst", "trinkt"],
      ["ein", "eine", "einem", "einen"],
    ]);
    expect(item.key.answers).toEqual({ g1: ["trinkt"], g2: ["ein"] });
  });

  it("builds the same item every time, so the seed key is stable", () => {
    expect(cloze("A1", "EASY", spec)).toEqual(item);
    expect(seedItemKey(cloze("A1", "EASY", spec))).toBe(seedItemKey(item));
  });

  it("scores each gap on its own", () => {
    const s = scoreItem(item.type, item.content, item.key, { gaps: { g1: "trinkt", g2: "einen" } });
    expect(s?.score).toBe(0.5);
  });

  it("puts the teacher note into the explanation", () => {
    expect(cloze("A1", "EASY", { ...spec, note: "Verbformen." }).explanation).toContain("Geprüft: Verbformen.");
  });

  it("rejects a gap without exactly three distractors", () => {
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[trinkt|trinke|trinken]] Tee." })).toThrow(/exactly 3/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[trinkt|a|b|c|d]] Tee." })).toThrow(/exactly 3/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[trinkt]] Tee." })).toThrow(/exactly 3/);
  });

  it("rejects options that repeat, also by case, ß or umlaut spelling", () => {
    expect(() => cloze("A1", "EASY", { ...spec, body: "[[Der|der|die|das]] Tee." })).toThrow(/equal/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Er [[heißt|heisst|heiße|heißen]] Tom." })).toThrow(/equal/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Ich [[möchte|moechte|mag|will]] Tee." })).toThrow(/equal/);
  });

  it("rejects an empty answer or distractor", () => {
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[ |a|b|c]] Tee." })).toThrow(/no answer/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[trinkt|a||c]] Tee." })).toThrow(/empty/);
  });

  it("rejects a body without gaps, stray brackets and gaps in the intact sentences", () => {
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie trinkt Tee." })).toThrow(/no gap/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[trinkt|a|b|c]] Tee ]]." })).toThrow(/stray/);
    expect(() => cloze("A1", "EASY", { ...spec, first: "Lena [[geht|a|b|c]]." })).toThrow(/outside the body/);
    expect(() => cloze("A1", "EASY", { ...spec, last: "Dann {{g9}}." })).toThrow(/outside the body/);
  });
});
