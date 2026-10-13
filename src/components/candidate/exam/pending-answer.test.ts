import { describe, expect, it } from "vitest";
import { clearPending, readPending, writePending, type StorageLike } from "./pending-answer";

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
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

describe("pending answer slot", () => {
  it("keeps one answer per invitation and reads it back", () => {
    const s = memory();
    writePending(s, "tok-a", { sectionPosition: 1, sequence: 3, answer: { choiceIds: ["o1"] } });
    writePending(s, "tok-b", { sectionPosition: 2, sequence: 1, answer: { text: "Hallo" } });
    expect(readPending(s, "tok-a")).toEqual({ sectionPosition: 1, sequence: 3, answer: { choiceIds: ["o1"] } });
    expect(readPending(s, "tok-b")?.answer).toEqual({ text: "Hallo" });
    expect(readPending(s, "tok-c")).toBeNull();
  });

  it("clears only the item that was saved, not a newer one", () => {
    const s = memory();
    writePending(s, "t", { sectionPosition: 1, sequence: 4, answer: { gaps: { g1: "x" } } });
    clearPending(s, "t", { sectionPosition: 1, sequence: 3 });
    expect(readPending(s, "t")?.sequence).toBe(4);
    clearPending(s, "t", { sectionPosition: 1, sequence: 4 });
    expect(readPending(s, "t")).toBeNull();
  });

  it("ignores broken or foreign data", () => {
    const s = memory();
    s.setItem("kademe.exam.pending.t", "{not json");
    expect(readPending(s, "t")).toBeNull();
    s.setItem("kademe.exam.pending.t", JSON.stringify({ sequence: "3", answer: {} }));
    expect(readPending(s, "t")).toBeNull();
    s.setItem("kademe.exam.pending.t", JSON.stringify({ sectionPosition: 1, sequence: 3, answer: [] }));
    expect(readPending(s, "t")).toBeNull();
  });

  it("never throws when storage is missing or blocked", () => {
    expect(() => writePending(throwing, "t", { sectionPosition: 1, sequence: 1, answer: {} })).not.toThrow();
    expect(readPending(throwing, "t")).toBeNull();
    expect(() => clearPending(throwing, "t", { sectionPosition: 1, sequence: 1 })).not.toThrow();
    expect(readPending(null, "t")).toBeNull();
  });
});
