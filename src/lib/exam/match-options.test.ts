import { describe, expect, it } from "vitest";
import { holders, matchChoices, moveIndex, typeaheadIndex } from "./match-options";

const targets = [
  { id: "ta", badge: "A" },
  { id: "tb", badge: "B" },
  { id: "tc", badge: "C" },
  { id: "td", badge: "D" },
  { id: "t0", badge: "0" },
];
const rows = ["l1", "l2", "l3"];
const order = (matches: Record<string, string>, rowId: string) => matchChoices(targets, matches, rowId, rows).map((c) => c.target.badge);

describe("matchChoices: a used target sinks to the bottom", () => {
  it("keeps the own order when nothing is chosen", () => {
    expect(order({}, "l1")).toEqual(["A", "B", "C", "D", "0"]);
  });

  it("moves a target another row holds below the free ones, keeping the order inside each group", () => {
    expect(order({ l1: "tb", l3: "ta" }, "l2")).toEqual(["C", "D", "0", "A", "B"]);
  });

  it("says which rows hold the used target", () => {
    const choices = matchChoices(targets, { l1: "tb", l3: "ta" }, "l2", rows);
    expect(choices.filter((c) => c.usedBy.length).map((c) => [c.target.badge, c.usedBy])).toEqual([
      ["A", ["l3"]],
      ["B", ["l1"]],
    ]);
  });

  it("leaves the row's own pick in place and marks it", () => {
    const choices = matchChoices(targets, { l1: "tb", l2: "tc" }, "l2", rows);
    expect(choices.map((c) => c.target.badge)).toEqual(["A", "C", "D", "0", "B"]);
    expect(choices.find((c) => c.selected)?.target.badge).toBe("C");
    expect(choices.find((c) => c.target.badge === "C")?.usedBy).toEqual([]);
  });

  it("never sinks the 'fits nobody' target, however many rows chose it", () => {
    const choices = matchChoices(targets, { l1: "t0", l2: "t0" }, "l3", rows);
    expect(choices.map((c) => c.target.badge)).toEqual(["A", "B", "C", "D", "0"]);
    expect(choices.every((c) => c.usedBy.length === 0)).toBe(true);
  });

  it("gives the sunk target back when its row clears it", () => {
    expect(order({ l1: "tb" }, "l2")).toEqual(["A", "C", "D", "0", "B"]);
    expect(order({}, "l2")).toEqual(["A", "B", "C", "D", "0"]);
  });

  it("lists a target held by two rows once, with both rows", () => {
    const choices = matchChoices(targets, { l1: "ta", l2: "ta" }, "l3", rows);
    expect(choices.find((c) => c.target.badge === "A")?.usedBy).toEqual(["l1", "l2"]);
    expect(choices).toHaveLength(5);
  });
});

describe("holders", () => {
  it("maps targets to rows in row order and skips empty rows", () => {
    expect([...holders(rows, { l3: "ta", l1: "tb", l2: "" })]).toEqual([
      ["tb", ["l1"]],
      ["ta", ["l3"]],
    ]);
  });
});

describe("moveIndex", () => {
  it("steps with the arrows and wraps", () => {
    expect(moveIndex(0, "ArrowDown", 4)).toBe(1);
    expect(moveIndex(3, "ArrowDown", 4)).toBe(0);
    expect(moveIndex(0, "ArrowUp", 4)).toBe(3);
    expect(moveIndex(2, "ArrowUp", 4)).toBe(1);
  });

  it("jumps with Home and End and starts at an end when nothing is focused", () => {
    expect(moveIndex(2, "Home", 4)).toBe(0);
    expect(moveIndex(1, "End", 4)).toBe(3);
    expect(moveIndex(-1, "ArrowDown", 4)).toBe(0);
    expect(moveIndex(-1, "ArrowUp", 4)).toBe(3);
  });

  it("ignores other keys and an empty list", () => {
    expect(moveIndex(0, "Enter", 4)).toBeNull();
    expect(moveIndex(0, "ArrowDown", 0)).toBeNull();
  });
});

describe("typeaheadIndex", () => {
  const badges = ["A", "B", "C", "0", "B"];
  it("finds the next option with that letter, ignoring case", () => {
    expect(typeaheadIndex(badges, "c", -1)).toBe(2);
    expect(typeaheadIndex(badges, "0", 0)).toBe(3);
  });

  it("goes on to the next one when the letter repeats, and wraps", () => {
    expect(typeaheadIndex(badges, "b", 1)).toBe(4);
    expect(typeaheadIndex(badges, "b", 4)).toBe(1);
  });

  it("gives -1 for a letter nobody wears and for a key that is not one character", () => {
    expect(typeaheadIndex(badges, "z", 0)).toBe(-1);
    expect(typeaheadIndex(badges, "Enter", 0)).toBe(-1);
  });
});
