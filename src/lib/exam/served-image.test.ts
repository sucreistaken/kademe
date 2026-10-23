import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: new Proxy({}, { get: () => () => { throw new Error("database reached"); } }) }));

import { servedImageKey, type ImageLookupData } from "./served-image";
import type { ItemSnapshot } from "./types";

const pic = (n: string) => ({ storageKey: `bank/images/${n.repeat(16)}.webp`, w: 1, h: 1, alt: `Alt ${n}` });
const task = (kind: "WRITING" | "SPEAKING", n: string) =>
  ({
    section: kind,
    content: kind === "WRITING" ? { kind, minWords: 20, maxWords: 40, images: [pic(n)] } : { kind, thinkSeconds: 1, answerSeconds: 30, maxTakes: 1, images: [pic(n)] },
  }) as unknown as ItemSnapshot;

// Config: only the enabled sections count, in order. Writing is position 1, speaking position 2.
const ctx = { assessment: { id: "a1", config: { sections: [], writing: { enabled: true }, speaking: { enabled: true } } } } as never;

vi.mock("./blueprint", () => ({ enabledSections: () => [{ section: "WRITING" }, { section: "SPEAKING" }] }));

// Both runs have an item with sequence 1 and a picture in slot p0.
const rows: Record<string, ReturnType<typeof task>> = { runW: task("WRITING", "a"), runS: task("SPEAKING", "b") };
const data = (): ImageLookupData & { asked: Array<[string, number]> } => {
  const asked: Array<[string, number]> = [];
  return {
    asked,
    runsOfLatestAttempt: async () => [{ id: "runW", section: "WRITING" }, { id: "runS", section: "SPEAKING" }],
    servedItem: async (runId, sequence) => {
      asked.push([runId, sequence]);
      return rows[runId] && sequence === 1 ? [{ snapshot: rows[runId], presentation: {} }] : [];
    },
  };
};

describe("servedImageKey is scoped to the named section run", () => {
  it("two runs share sequence 1 and slot p0: each position gets its own picture", async () => {
    const d = data();
    expect(await servedImageKey(ctx, 1, 1, "p0", d)).toBe(`bank/images/${"a".repeat(16)}.webp`);
    expect(await servedImageKey(ctx, 2, 1, "p0", d)).toBe(`bank/images/${"b".repeat(16)}.webp`);
    expect(d.asked).toEqual([["runW", 1], ["runS", 1]]);
  });

  it("never reads another run, and answers null for an unknown position, a missing run or sequence", async () => {
    const d = data();
    expect(await servedImageKey(ctx, 3, 1, "p0", d)).toBeNull();
    expect(await servedImageKey(ctx, 0, 1, "p0", d)).toBeNull();
    expect(d.asked).toEqual([]);
    expect(await servedImageKey(ctx, 2, 5, "p0", d)).toBeNull();
    expect(d.asked).toEqual([["runS", 5]]);
    expect(await servedImageKey(ctx, 2, 1, "p1", d)).toBeNull();
    expect(await servedImageKey(ctx, 1, 1, "p0", { ...d, runsOfLatestAttempt: async () => [{ id: "runS", section: "SPEAKING" }] })).toBeNull();
  });
});
