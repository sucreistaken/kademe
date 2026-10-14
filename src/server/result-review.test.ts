import { describe, expect, it, vi } from "vitest";

let rows: Array<Record<string, unknown>> = [];
vi.mock("@/db", () => ({
  db: {
    select: () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
      };
      return chain;
    },
  },
}));

import { ACCEPT_ACTION, UNDO_ACCEPT_ACTION, loadAcceptances } from "./result-review";

const at = (n: number) => new Date(2026, 9, 14, 10, n);
const accept = (n: number, gapId: string | null, originalScore = 0.25) => ({
  action: ACCEPT_ACTION,
  subjectId: "r1",
  actorId: "u1",
  at: at(n),
  meta: { originalScore, originalCorrect: false, ...(gapId ? { gapId } : {}) },
});
const undo = (n: number, gapId: string | null) => ({ action: UNDO_ACCEPT_ACTION, subjectId: "r1", actorId: "u1", at: at(n), meta: gapId ? { gapId } : {} });

describe("loadAcceptances", () => {
  it("collects accepted gaps and keeps the score from before the first acceptance", async () => {
    rows = [accept(1, "g2", 0.25), accept(2, "g3", 0.5)];
    const a = (await loadAcceptances("o1", ["r1"])).r1;
    expect(a.gapIds).toEqual(["g2", "g3"]);
    expect(a.originalScore).toBe(0.25);
  });
  it("an undo with a gap id removes only that gap; the last one removes the acceptance", async () => {
    rows = [accept(1, "g2"), accept(2, "g3"), undo(3, "g2")];
    expect((await loadAcceptances("o1", ["r1"])).r1.gapIds).toEqual(["g3"]);
    rows = [accept(1, "g2"), undo(2, "g2")];
    expect((await loadAcceptances("o1", ["r1"])).r1).toBeUndefined();
  });
  it("a whole short-text acceptance has no gaps, and an undo without a gap clears everything", async () => {
    rows = [accept(1, null, 0)];
    expect((await loadAcceptances("o1", ["r1"])).r1).toMatchObject({ gapIds: [], originalScore: 0 });
    rows = [accept(1, "g2"), accept(2, "g3"), undo(3, null)];
    expect((await loadAcceptances("o1", ["r1"])).r1).toBeUndefined();
  });
  it("a gap accepted again after an undo starts a fresh acceptance with the then-current original", async () => {
    rows = [accept(1, "g2", 0.25), undo(2, "g2"), accept(3, "g2", 0.25)];
    expect((await loadAcceptances("o1", ["r1"])).r1).toMatchObject({ gapIds: ["g2"], originalScore: 0.25 });
  });
});
