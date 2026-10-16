import { describe, expect, it } from "vitest";
import { leavesGroup, memberRange, memberSequences, nextAfterGroup, prevBeforeGroup } from "./groups";

const seqs = [1, 2, 3, 4, 5, 6, 7, 8];

describe("memberSequences", () => {
  it("lists the group ascending, or the anchor alone without one", () => {
    expect(memberSequences([{ sequence: 5 }, { sequence: 3 }, { sequence: 4 }], 4)).toEqual([3, 4, 5]);
    expect(memberSequences(null, 2)).toEqual([2]);
    expect(memberSequences([], 2)).toEqual([2]);
    expect(memberSequences([{ sequence: 6 }, { sequence: 6 }], 6)).toEqual([6]);
  });
});

describe("next and previous around a group", () => {
  it("skip over the whole group", () => {
    expect(nextAfterGroup(seqs, [3, 4, 5])).toBe(6);
    expect(prevBeforeGroup(seqs, [3, 4, 5])).toBe(2);
  });

  it("a single-item stimulus or an item without a stimulus moves by one", () => {
    expect(nextAfterGroup(seqs, [4])).toBe(5);
    expect(prevBeforeGroup(seqs, [4])).toBe(3);
  });

  it("end the section: no next after the last group (the review follows), no previous before the first", () => {
    expect(nextAfterGroup(seqs, [6, 7, 8])).toBeNull();
    expect(prevBeforeGroup(seqs, [1, 2])).toBeNull();
  });

  it("do not depend on the order of the members", () => {
    expect(nextAfterGroup(seqs, [5, 3, 4])).toBe(6);
    expect(prevBeforeGroup(seqs, [5, 3, 4])).toBe(2);
  });

  it("never return a member even if the group is not contiguous", () => {
    expect(nextAfterGroup([1, 2, 3, 4, 5], [2, 4])).toBe(5);
    expect(prevBeforeGroup([1, 2, 3, 4, 5], [2, 4])).toBe(1);
  });

  it("an empty group has no neighbours", () => {
    expect(nextAfterGroup(seqs, [])).toBeNull();
    expect(prevBeforeGroup(seqs, [])).toBeNull();
  });
});

describe("leavesGroup", () => {
  it("a jump into the middle of the same group stays on the page", () => {
    expect(leavesGroup([3, 4, 5], 4)).toBe(false);
    expect(leavesGroup([3, 4, 5], 5)).toBe(false);
  });

  it("another item or the review leaves it", () => {
    expect(leavesGroup([3, 4, 5], 6)).toBe(true);
    expect(leavesGroup([3, 4, 5], 2)).toBe(true);
    expect(leavesGroup([3, 4, 5], "REVIEW")).toBe(true);
  });
});

describe("memberRange", () => {
  it("names the first and last question of the page", () => {
    expect(memberRange([3, 4, 5])).toEqual({ from: 3, to: 5 });
    expect(memberRange([7])).toEqual({ from: 7, to: 7 });
  });
});
