import { describe, expect, it } from "vitest";
import { activeGap, clickedFor, clozeParts, focusTarget, gapOrder, gapPosition, clozeKeyApplies, nextAfterPick, optionOfKey, tabStop } from "./cloze-model";

const ORDER = ["g1", "g2", "g3", "g4"];

describe("cloze text parts", () => {
  it("splits the passage into text and gap markers, in order", () => {
    expect(clozeParts("Heute {{g1}} die Sonne {{g2}}.")).toEqual([
      { text: "Heute " },
      { gapId: "g1" },
      { text: " die Sonne " },
      { gapId: "g2" },
      { text: "." },
    ]);
  });

  it("numbers gaps by their place in the text, not by id, and skips unknown ids", () => {
    const parts = clozeParts("A {{g3}} B {{g1}} C {{gx}} D {{g3}}");
    expect(gapOrder(parts, new Set(["g1", "g3"]))).toEqual(["g3", "g1"]);
  });
});

describe("the open gap", () => {
  it("is the first empty gap when nothing was clicked", () => {
    expect(activeGap(ORDER, {}, null)).toBe("g1");
    expect(activeGap(ORDER, { g1: "a", g2: "b" }, null)).toBe("g3");
    // A blank string is an empty gap.
    expect(activeGap(ORDER, { g1: "  " }, null)).toBe("g1");
  });

  it("is the clicked gap, even a filled one", () => {
    expect(activeGap(ORDER, { g1: "a", g2: "b" }, "g1")).toBe("g1");
  });

  it("falls back to the first gap when every gap is filled", () => {
    expect(activeGap(ORDER, { g1: "a", g2: "b", g3: "c", g4: "d" }, null)).toBe("g1");
  });

  it("ignores a clicked id the text does not have, and has none for a text without gaps", () => {
    expect(activeGap(ORDER, {}, "zz")).toBe("g1");
    expect(activeGap([], {}, null)).toBeNull();
  });
});

describe("moving on after a pick", () => {
  it("goes to the next empty gap after the one just filled", () => {
    expect(nextAfterPick(ORDER, { g1: "a" }, "g1")).toBe("g2");
    expect(nextAfterPick(ORDER, { g1: "a", g2: "b" }, "g2")).toBe("g3");
  });

  it("skips filled gaps and wraps round to an empty one before it", () => {
    expect(nextAfterPick(ORDER, { g2: "b", g3: "c", g4: "d" }, "g3")).toBe("g1");
    expect(nextAfterPick(ORDER, { g1: "a", g3: "c" }, "g1")).toBe("g2");
  });

  it("stays where it is when no other gap is empty", () => {
    expect(nextAfterPick(ORDER, { g1: "a", g2: "b", g3: "c", g4: "d" }, "g3")).toBe("g3");
  });

  it("changing a filled gap moves on to the next empty one, not back to a filled one", () => {
    expect(nextAfterPick(ORDER, { g1: "new", g2: "b" }, "g1")).toBe("g3");
  });
});

describe("option keys", () => {
  it("1 to 4 pick the option at that place", () => {
    expect([1, 2, 3, 4].map((k) => optionOfKey(String(k), 4))).toEqual([0, 1, 2, 3]);
  });

  it("ignores every other key and a place the gap does not have", () => {
    for (const k of ["0", "5", "a", "Enter", "ArrowDown", "11", ""]) expect(optionOfKey(k, 4), k).toBeNull();
    expect(optionOfKey("4", 3)).toBeNull();
  });

  it("a gap with three words (a course test) is picked by 1 to 3, and 4 is left alone", () => {
    expect([1, 2, 3].map((k) => optionOfKey(String(k), 3))).toEqual([0, 1, 2]);
    for (const k of ["0", "4", "5", "9"]) expect(optionOfKey(k, 3), k).toBeNull();
  });

  it("no key picks when the gap has no words (no open gap)", () => {
    for (const k of ["1", "2", "3", "4"]) expect(optionOfKey(k, 0), k).toBeNull();
  });
});

describe("arrow keys with three words", () => {
  it("wrap round the three, and End lands on the third", () => {
    expect(focusTarget("ArrowDown", 2, 3)).toBe(0);
    expect(focusTarget("ArrowUp", 0, 3)).toBe(2);
    expect(focusTarget("End", 0, 3)).toBe(2);
    expect(tabStop(["a", "b", "c"], "c")).toBe(2);
    expect(tabStop(["a", "b", "c"], "d")).toBe(0);
  });
});

describe("a click belongs to its question", () => {
  it("is used on the question it was made on and ignored on any other, so a new text opens on its first empty gap", () => {
    const clicked = { sequence: 3, gapId: "g6" };
    expect(clickedFor(clicked, 3)).toBe("g6");
    expect(clickedFor(clicked, 4)).toBeNull();
    expect(clickedFor(null, 3)).toBeNull();
    // Gap ids repeat from text to text (g1..gN): the next text must not inherit "g6".
    expect(activeGap(ORDER, {}, clickedFor(clicked, 4))).toBe("g1");
  });
});

describe("where the student is", () => {
  it("is the place of the open gap in the text and the number of gaps", () => {
    expect(gapPosition(ORDER, "g3")).toEqual({ n: 3, total: 4 });
    expect(gapPosition(ORDER, null)).toEqual({ n: 0, total: 4 });
  });
});

describe("arrow keys on the options", () => {
  it("only move focus, wrapping round, and Home and End jump", () => {
    expect(focusTarget("ArrowDown", 0, 4)).toBe(1);
    expect(focusTarget("ArrowRight", 3, 4)).toBe(0);
    expect(focusTarget("ArrowUp", 0, 4)).toBe(3);
    expect(focusTarget("ArrowLeft", 2, 4)).toBe(1);
    expect(focusTarget("Home", 2, 4)).toBe(0);
    expect(focusTarget("End", 1, 4)).toBe(3);
  });

  it("leave Enter, Space, digits and every other key alone, so they keep picking (or doing nothing) natively", () => {
    for (const k of ["Enter", " ", "1", "Tab", "a"]) expect(focusTarget(k, 1, 4), k).toBeNull();
    expect(focusTarget("ArrowDown", 0, 0)).toBeNull();
  });

  it("keep one Tab stop: the picked word, or the first when the saved word is not an option", () => {
    expect(tabStop(["a", "b", "c", "d"], "c")).toBe(2);
    expect(tabStop(["a", "b", "c", "d"], "")).toBe(0);
    expect(tabStop(["a", "b", "c", "d"], "zzz")).toBe(0);
  });
});

describe("clozeKeyApplies", () => {
  it("acts inside the item and on non-controls (body, a heading), not on a control elsewhere", () => {
    expect(clozeKeyApplies({ insideItem: true, onOutsideControl: false })).toBe(true);
    expect(clozeKeyApplies({ insideItem: false, onOutsideControl: false })).toBe(true);
    expect(clozeKeyApplies({ insideItem: false, onOutsideControl: true })).toBe(false);
  });
});
