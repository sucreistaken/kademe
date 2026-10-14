import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Accept as correct" on a typed objective answer: score to 1, the original
 * kept in the audit row, estimate and result recomputed; refused on a final
 * result, on answers that are not typed, and without the grading permission.
 */
type Found = { response: Record<string, unknown>; run: Record<string, unknown>; assessmentId: string; ended: boolean; final: boolean } | null;
const store: { found: Found; accepted: Record<string, unknown> } = { found: null, accepted: {} };
const writes: Array<{ kind: string; values: unknown }> = [];
const calls = vi.fn();

function writeChain(kind: string) {
  let values: unknown;
  const chain = {
    set: (v: unknown) => {
      values = v;
      return chain;
    },
    values: (v: unknown) => {
      values = v;
      return chain;
    },
    where: () => chain,
    then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => {
      writes.push({ kind, values });
      return Promise.resolve([]).then(resolve, reject);
    },
  };
  return chain;
}

vi.mock("@/db", () => ({
  db: {
    select: () => {
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(store.found ? [store.found] : []).then(resolve, reject),
      };
      return chain;
    },
    update: () => writeChain("update"),
    insert: () => writeChain("insert"),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
const requireUser = vi.fn(async (permission?: string) => {
  calls("requireUser", permission);
  return { id: "u1", orgId: "o1", email: "m@x", name: "M", role: "MANAGER" };
});
vi.mock("@/server/session", () => ({ requireUser: (p?: string) => requireUser(p) }));
vi.mock("@/lib/exam-results", () => ({
  recomputeResult: async (...a: unknown[]) => calls("recomputeResult", ...a),
  finalizeResult: async () => ({ ok: true }),
}));
vi.mock("@/lib/exam/reestimate-run", () => ({ reestimateRun: async (...a: unknown[]) => calls("reestimateRun", ...a) }));
vi.mock("@/server/proctoring", () => ({ recomputeIntegrity: async () => undefined }));
vi.mock("@/server/result-review", async (orig) => ({
  ...(await orig<typeof import("@/server/result-review")>()),
  loadAcceptances: async () => store.accepted,
}));

import { acceptAsCorrect, undoAcceptAsCorrect } from "./actions";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

const gapSnapshot = {
  type: "GAP_FILL",
  content: { kind: "GAP", gaps: [{ id: "g1" }] },
  key: { kind: "GAP", answers: { g1: ["dem"] } },
};
const found = (over: Partial<NonNullable<Found>> = {}, response: Record<string, unknown> = {}): Found => ({
  response: { id: "r1", sequence: 3, score: 0, isCorrect: false, answer: { gaps: { g1: "dem hier" } }, itemSnapshot: gapSnapshot, ...response },
  run: { id: "run1", attemptId: "t1", section: "READING" },
  assessmentId: "a1",
  ended: true,
  final: false,
  ...over,
});

beforeEach(() => {
  writes.length = 0;
  calls.mockClear();
  store.accepted = {};
  store.found = found();
});

describe("acceptAsCorrect", () => {
  it("sets the score to 1, keeps the original in the audit row, then re-estimates and recomputes", async () => {
    await expect(acceptAsCorrect(form({ responseId: "r1", tab: "READING" }))).rejects.toThrow(/^REDIRECT .*undo=accept&response=r1/);
    expect(calls).toHaveBeenCalledWith("requireUser", "result:grade");
    expect(writes[0]).toMatchObject({ kind: "update", values: { score: 1, isCorrect: true } });
    expect(writes[1]).toMatchObject({
      kind: "insert",
      values: { action: "response.accept_correct", subjectType: "item_response", subjectId: "r1", meta: { originalScore: 0, originalCorrect: false } },
    });
    expect(calls).toHaveBeenCalledWith("reestimateRun", "run1");
    expect(calls).toHaveBeenCalledWith("recomputeResult", "t1");
  });

  it("changes nothing once the result is final, while the exam runs, or for an unknown id", async () => {
    for (const f of [found({ final: true }), found({ ended: false }), null]) {
      store.found = f;
      await expect(acceptAsCorrect(form({ responseId: "r1" }))).rejects.toThrow(/^REDIRECT /);
    }
    expect(writes).toEqual([]);
    expect(calls).not.toHaveBeenCalledWith("recomputeResult", expect.anything());
  });

  it("refuses answers that are not typed, already full marks, or empty", async () => {
    const matching = { type: "MATCHING", content: { kind: "MATCHING", left: [], right: [] }, key: { kind: "MATCHING", pairs: {} } };
    for (const r of [
      { itemSnapshot: matching, answer: { matches: { l1: "b" } } },
      { score: 1, isCorrect: true },
      { answer: { gaps: { g1: " " } } },
    ]) {
      store.found = found({}, r);
      await expect(acceptAsCorrect(form({ responseId: "r1" }))).rejects.toThrow(/^REDIRECT /);
    }
    expect(writes).toEqual([]);
  });

  it("does not accept twice", async () => {
    store.accepted = { r1: { originalScore: 0, originalCorrect: false } };
    await expect(acceptAsCorrect(form({ responseId: "r1" }))).rejects.toThrow(/^REDIRECT /);
    expect(writes).toEqual([]);
  });

  it("refuses a user without the grading permission", async () => {
    requireUser.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(acceptAsCorrect(form({ responseId: "r1" }))).rejects.toThrow("FORBIDDEN");
    expect(writes).toEqual([]);
  });
});

describe("undoAcceptAsCorrect", () => {
  it("restores the original score, logs the undo and recomputes", async () => {
    store.found = found({}, { score: 1, isCorrect: true });
    store.accepted = { r1: { originalScore: 0.5, originalCorrect: false } };
    await expect(undoAcceptAsCorrect(form({ responseId: "r1", tab: "READING" }))).rejects.toThrow(/^REDIRECT /);
    expect(writes[0]).toMatchObject({ kind: "update", values: { score: 0.5, isCorrect: false } });
    expect(writes[1]).toMatchObject({ kind: "insert", values: { action: "response.accept_undo", subjectId: "r1" } });
    expect(calls).toHaveBeenCalledWith("reestimateRun", "run1");
    expect(calls).toHaveBeenCalledWith("recomputeResult", "t1");
  });

  it("does nothing when there is no acceptance to undo", async () => {
    await expect(undoAcceptAsCorrect(form({ responseId: "r1" }))).rejects.toThrow(/^REDIRECT /);
    expect(writes).toEqual([]);
  });

  it("does nothing on a final result", async () => {
    store.found = found({ final: true });
    store.accepted = { r1: { originalScore: 0, originalCorrect: false } };
    await expect(undoAcceptAsCorrect(form({ responseId: "r1" }))).rejects.toThrow(/^REDIRECT /);
    expect(writes).toEqual([]);
  });
});
