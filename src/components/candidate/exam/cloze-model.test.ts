import { describe, expect, it } from "vitest";
import { activeGap, clozeParts, gapOrder, nextAfterPick, optionOfKey } from "./cloze-model";

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
});
