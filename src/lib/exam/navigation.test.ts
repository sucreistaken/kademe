import { describe, expect, it } from "vitest";
import { section } from "./blueprint";
import {
  canFinish,
  canFlag,
  canWrite,
  currentSequence,
  decideMove,
  isNavigableConfig,
  isNavigableRun,
  navEntries,
  neighbour,
  type NavTarget,
} from "./navigation";

const open = (sequence: number): NavTarget => ({ sequence, answered: false, notReached: false });
const answered = (sequence: number): NavTarget => ({ sequence, answered: true, notReached: false });
const notReached = (sequence: number): NavTarget => ({ sequence, answered: false, notReached: true });

describe("which sections are navigable", () => {
  it("a run with a plan is navigable, except speaking; an adaptive run has no plan", () => {
    expect(isNavigableRun("GRAMMAR", true)).toBe(true);
    expect(isNavigableRun("READING", true)).toBe(true);
    expect(isNavigableRun("LISTENING", true)).toBe(true);
    expect(isNavigableRun("WRITING", true)).toBe(true);
    expect(isNavigableRun("SPEAKING", true)).toBe(false);
    expect(isNavigableRun("GRAMMAR", false)).toBe(false);
  });

  it("the blueprint says the same before the section starts", () => {
    expect(isNavigableConfig(section("GRAMMAR", 10))).toBe(true);
    expect(isNavigableConfig(section("GRAMMAR", 10, { adaptive: true }))).toBe(false);
    expect(isNavigableConfig(section("READING", 10, { adaptive: true }))).toBe(false);
    expect(isNavigableConfig(section("WRITING", 10))).toBe(true);
    // Productive sections are never adaptive; a stray flag does not change that.
    expect(isNavigableConfig(section("WRITING", 10, { adaptive: true }))).toBe(true);
    expect(isNavigableConfig(section("SPEAKING", 10))).toBe(false);
  });
});

describe("canWrite", () => {
  it("one way (adaptive): only the first open item takes a write; no going back", () => {
    expect(canWrite({ navigable: false, target: open(3), firstOpen: 3 })).toBe(true);
    // The open item is 3; writing to 2 (already answered) or 4 (not yet open) is refused.
    expect(canWrite({ navigable: false, target: answered(2), firstOpen: 3 })).toBe(false);
    expect(canWrite({ navigable: false, target: open(4), firstOpen: 3 })).toBe(false);
  });

  it("navigable: any open item of the section takes a draft, in any order", () => {
    expect(canWrite({ navigable: true, target: open(1), firstOpen: null })).toBe(true);
    expect(canWrite({ navigable: true, target: open(7), firstOpen: null })).toBe(true);
  });

  it("never on an item that is closed, not reached or missing", () => {
    for (const navigable of [true, false]) {
      expect(canWrite({ navigable, target: answered(1), firstOpen: 1 })).toBe(false);
      expect(canWrite({ navigable, target: notReached(1), firstOpen: 1 })).toBe(false);
      expect(canWrite({ navigable, target: null, firstOpen: 1 })).toBe(false);
    }
  });
});

describe("canFlag", () => {
  it("only in navigable sections and only on open items", () => {
    expect(canFlag({ navigable: true, target: open(2) })).toBe(true);
    expect(canFlag({ navigable: false, target: open(2) })).toBe(false);
    expect(canFlag({ navigable: true, target: answered(2) })).toBe(false);
    expect(canFlag({ navigable: true, target: null })).toBe(false);
  });
});

describe("decideMove", () => {
  const sequences = [1, 2, 3, 4];

  it("moves to any served item, backwards included", () => {
    expect(decideMove({ navigable: true, to: 1, sequences })).toEqual({ ok: true, cursor: 1, review: false });
    expect(decideMove({ navigable: true, to: 4, sequences })).toEqual({ ok: true, cursor: 4, review: false });
  });

  it("opens the review step", () => {
    expect(decideMove({ navigable: true, to: "REVIEW", sequences })).toEqual({ ok: true, review: true });
  });

  it("refuses an item the section does not have, and anything that is not a sequence", () => {
    for (const to of [0, 5, 2.5, "2", null, undefined, {}]) {
      expect(decideMove({ navigable: true, to, sequences })).toEqual({ ok: false });
    }
  });

  it("refuses every move in a one-way section, back and review included", () => {
    expect(decideMove({ navigable: false, to: 1, sequences })).toEqual({ ok: false });
    expect(decideMove({ navigable: false, to: "REVIEW", sequences })).toEqual({ ok: false });
  });
});

describe("canFinish", () => {
  it("a navigable section finishes only from its review step", () => {
    expect(canFinish({ navigable: true, review: false })).toBe(false);
    expect(canFinish({ navigable: true, review: true })).toBe(true);
  });

  it("a one-way section may still be ended early at any time", () => {
    expect(canFinish({ navigable: false, review: false })).toBe(true);
  });
});

describe("cursor helpers", () => {
  it("shows the stored item, or the first one when there is none or it is gone", () => {
    expect(currentSequence(3, [1, 2, 3])).toBe(3);
    expect(currentSequence(null, [1, 2, 3])).toBe(1);
    expect(currentSequence(9, [1, 2, 3])).toBe(1);
    expect(currentSequence(null, [])).toBeNull();
  });

  it("finds the next and previous item, and null at either end", () => {
    expect(neighbour([3, 1, 2], 2, 1)).toBe(3);
    expect(neighbour([1, 2, 3], 2, -1)).toBe(1);
    expect(neighbour([1, 2, 3], 3, 1)).toBeNull();
    expect(neighbour([1, 2, 3], 1, -1)).toBeNull();
    expect(neighbour([1, 2, 3], 7, 1)).toBeNull();
  });
});

describe("navEntries", () => {
  it("one cell per item in order: what is filled in and the flag, nothing about right or wrong", () => {
    const entries = navEntries([
      { sequence: 2, content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] }, answer: { gaps: { g1: "x" } }, flagged: true },
      { sequence: 1, content: { kind: "CHOICE" }, answer: null, flagged: false },
    ]);
    expect(entries).toEqual([
      { sequence: 1, filled: 0, total: 1, flagged: false },
      { sequence: 2, filled: 1, total: 2, flagged: true },
    ]);
    expect(Object.keys(entries[0]).sort()).toEqual(["filled", "flagged", "sequence", "total"]);
  });
});
