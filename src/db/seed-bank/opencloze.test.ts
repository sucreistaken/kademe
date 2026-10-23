import { describe, expect, it } from "vitest";
import { scoreItem } from "@/lib/exam/item-scoring";
import { textGapKindOf } from "@/lib/exam/types";
import { validateItem } from "@/lib/exam/validate";
import { openCloze } from "./opencloze";

const spec = {
  title: "Ein Regentag",
  first: "Heute regnet es in Köln.",
  body: "Wir bleiben zu Hause, [[weil/da#nebensatz]] es regnet. Anna liest [[ein]] Buch und Tom kocht [[für#praeposition]] alle.",
  last: "Am Abend schauen wir einen Film.",
};

describe("openCloze", () => {
  const item = openCloze("B1", "MID", spec);
  const score = (gaps: Record<string, string>) => scoreItem("GAP_FILL", item.content, item.key, { gaps });

  it("is an open cloze GAP_FILL item that validates", () => {
    expect(item.type).toBe("GAP_FILL");
    expect(item.section).toBe("GRAMMAR");
    expect(textGapKindOf(item)).toBe("OPEN");
    expect(validateItem(item)).toEqual([]);
  });

  it("writes instruction, title and text with numbered markers and typed gaps", () => {
    const [instruction, title, text] = item.prompt.split("\n\n");
    expect(instruction).toContain("Schreiben Sie in jede Lücke");
    expect(title).toBe("Ein Regentag");
    expect(text).toBe("Heute regnet es in Köln. Wir bleiben zu Hause, {{g1}} es regnet. Anna liest {{g2}} Buch und Tom kocht {{g3}} alle. Am Abend schauen wir einen Film.");
    expect(item.content).toEqual({ kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }, { id: "g3" }] });
  });

  it("keeps every accepted spelling and the topics in the key", () => {
    expect(item.key).toEqual({
      kind: "GAP",
      answers: { g1: ["weil", "da"], g2: ["ein"], g3: ["für"] },
      topics: { g1: "nebensatz", g3: "praeposition" },
    });
  });

  it("has no topics field when no gap names one", () => {
    const plain = openCloze("A2", "EASY", { ...spec, body: "Wir sind [[hier]] und er ist [[dort]]." });
    expect(plain.key).toEqual({ kind: "GAP", answers: { g1: ["hier"], g2: ["dort"] } });
  });

  it("scores: accepts 'Weil ' (case, trailing space), rejects wegen", () => {
    expect(score({ g1: "Weil ", g2: "ein", g3: "für" })).toEqual({ score: 1, correct: true });
    expect(score({ g1: "wegen", g2: "ein", g3: "für" })?.correct).toBe(false);
    expect(score({ g1: "da", g2: "x", g3: "fuer" })?.score).toBeCloseTo(2 / 3);
  });

  it("throws on a stray bracket, no gap, a gap in the first or last sentence", () => {
    expect(() => openCloze("A1", "EASY", { ...spec, body: "Wir sind [[hier]] und {{dort}}." })).toThrow(/stray bracket/);
    expect(() => openCloze("A1", "EASY", { ...spec, body: "Wir sind [[hier]] und dort]]." })).toThrow(/stray bracket/);
    expect(() => openCloze("A1", "EASY", { ...spec, body: "Kein Loch." })).toThrow(/no gap/);
    expect(() => openCloze("A1", "EASY", { ...spec, first: "Heute [[regnet]] es." })).toThrow(/outside the body/);
    expect(() => openCloze("A1", "EASY", { ...spec, last: "Am [[Abend]] schlafen wir." })).toThrow(/outside the body/);
  });

  it("throws on bad gap content", () => {
    const body = (inner: string) => ({ ...spec, body: `Wir sind [[${inner}]] hier.` });
    expect(() => openCloze("A1", "EASY", body(""))).toThrow(/empty answer/);
    expect(() => openCloze("A1", "EASY", body("a//b"))).toThrow(/empty answer/);
    expect(() => openCloze("A1", "EASY", body("in den"))).toThrow(/whole word/);
    expect(() => openCloze("A1", "EASY", body("weil#"))).toThrow(/empty topic/);
    expect(() => openCloze("A1", "EASY", body("weil|da|ob|und"))).toThrow(/"\/"/);
    expect(() => openCloze("A1", "EASY", body("weil/Weil"))).toThrow(/twice/);
  });
});
