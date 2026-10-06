import { describe, expect, it } from "vitest";
import { itemPreview } from "./item-preview";

describe("itemPreview", () => {
  it("marks the correct option", () => {
    expect(itemPreview({ kind: "CHOICE", options: [{ id: "a", text: "bin" }, { id: "b", text: "bist" }] }, { kind: "CHOICE", correct: ["a"] })).toEqual({
      lines: [{ text: "bin", correct: true }, { text: "bist", correct: false }],
    });
  });

  it("writes the answer next to each statement, gap and pair", () => {
    expect(itemPreview({ kind: "TFNG", statements: [{ id: "s1", text: "Er kommt." }] }, { kind: "TFNG", answers: { s1: "F" } }).lines[0].text).toBe("Er kommt. (F)");
    expect(itemPreview({ kind: "GAP", gaps: [{ id: "g1" }] }, { kind: "GAP", answers: { g1: ["bin", "war"] } }).lines[0].text).toBe("g1: bin / war");
    expect(
      itemPreview({ kind: "MATCHING", left: [{ id: "l1", text: "Hund" }], right: [{ id: "r1", text: "dog" }] }, { kind: "MATCHING", pairs: { l1: "r1" } }).lines[0].text,
    ).toBe("Hund -> dog");
  });

  it("shows nothing extra for open tasks", () => {
    expect(itemPreview({ kind: "WRITING", minWords: 80, maxWords: 120 }, { kind: "NONE" })).toEqual({ lines: [] });
  });
});
