import { describe, expect, it } from "vitest";
import { gateKey, isGateOpen, markRevealed, readRevealed } from "./listening-gate";
import type { StorageLike } from "./pending-answer";

function memory(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("isGateOpen", () => {
  it("is closed for a recording that was neither revealed nor played", () => {
    expect(isGateOpen({ revealed: false, playsLeft: 2, maxPlays: 2 })).toBe(false);
  });

  it("is open once revealed", () => {
    expect(isGateOpen({ revealed: true, playsLeft: 2, maxPlays: 2 })).toBe(true);
  });

  it("is open when the server already counted a play, even on a fresh tab", () => {
    expect(isGateOpen({ revealed: false, playsLeft: 1, maxPlays: 2 })).toBe(true);
    expect(isGateOpen({ revealed: false, playsLeft: 0, maxPlays: 2 })).toBe(true);
  });

  it("does not treat a recording with no plays allowed as played", () => {
    expect(isGateOpen({ revealed: false, playsLeft: 0, maxPlays: 0 })).toBe(false);
  });
});

describe("revealed flag", () => {
  it("is remembered per invitation, section and recording", () => {
    const s = memory();
    const key = gateKey("tok", 2, 5);
    expect(readRevealed(s, key)).toBe(false);
    markRevealed(s, key);
    expect(readRevealed(s, key)).toBe(true);
    expect(readRevealed(s, gateKey("tok", 2, 9))).toBe(false);
    expect(readRevealed(s, gateKey("tok", 3, 5))).toBe(false);
    expect(readRevealed(s, gateKey("other", 2, 5))).toBe(false);
  });

  it("survives missing or blocked storage without throwing", () => {
    expect(() => markRevealed(null, "k")).not.toThrow();
    expect(readRevealed(null, "k")).toBe(false);
    expect(() => markRevealed(throwing, "k")).not.toThrow();
    expect(readRevealed(throwing, "k")).toBe(false);
  });
});
