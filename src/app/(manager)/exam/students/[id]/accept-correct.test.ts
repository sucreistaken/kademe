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
  content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }, { id: "g3" }, { id: "g4" }] },
  key: { kind: "GAP", answers: { g1: ["dem"], g2: ["ins"], g3: ["auf"], g4: ["macht"] } },
};
const shortSnapshot = { type: "SHORT_TEXT", content: { kind: "SHORT_TEXT", maxChars: 30 }, key: { kind: "SHORT_TEXT", accepted: ["Berlin"] } };
const found = (over: Partial<NonNullable<Found>> = {}, response: Record<string, unknown> = {}): Found => ({
  // Four gaps; the student filled g1 (key takes it), g2 (a variant) and left g3, g4 empty.
  response: { id: "r1", sequence: 3, score: 0.25, isCorrect: false, answer: { gaps: { g1: "dem", g2: "im" } }, itemSnapshot: gapSnapshot, ...response },
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
  it("accepting one filled gap raises the score to (key-correct + accepted) / all gaps, never to 1", async () => {
    await expect(acceptAsCorrect(form({ responseId: "r1", gapId: "g2", tab: "READING" }))).rejects.toThrow(/^REDIRECT .*undo=accept&response=r1&gap=g2/);
    expect(calls).toHaveBeenCalledWith("requireUser", "result:grade");
    expect(writes[0]).toMatchObject({ kind: "update", values: { score: 0.5, isCorrect: false } });
    expect(writes[1]).toMatchObject({
      kind: "insert",
      values: {
        action: "response.accept_correct",
        subjectType: "item_response",
        subjectId: "r1",
        meta: { originalScore: 0.25, originalCorrect: false, gapId: "g2" },
      },
    });
    expect(calls).toHaveBeenCalledWith("reestimateRun", "run1");
    expect(calls).toHaveBeenCalledWith("recomputeResult", "t1");
  });

  it("a gap item cannot be accepted whole, and an empty gap, a key-correct gap or an unknown gap is refused", async () => {
    for (const gapId of [undefined, "g3", "g1", "zz"]) {
      await expect(acceptAsCorrect(form(gapId ? { responseId: "r1", gapId } : { responseId: "r1" }))).rejects.toThrow(/^REDIRECT /);
    }
    expect(writes).toEqual([]);
  });

  it("a second gap adds to the first: both accepted gives 3 of 4", async () => {
    store.found = found({}, { score: 0.5, answer: { gaps: { g1: "dem", g2: "im", g3: "aufs" } } });
    store.accepted = { r1: { originalScore: 0.25, originalCorrect: false, gapIds: ["g2"] } };
    await expect(acceptAsCorrect(form({ responseId: "r1", gapId: "g3" }))).rejects.toThrow(/^REDIRECT /);
    expect(writes[0]).toMatchObject({ kind: "update", values: { score: 0.75 } });
    // the same gap twice is refused
    writes.length = 0;
    await expect(acceptAsCorrect(form({ responseId: "r1", gapId: "g2" }))).rejects.toThrow(/^REDIRECT /);
    expect(writes).toEqual([]);
  });

  it("a short text is accepted whole: score 1, original kept", async () => {
    store.found = found({}, { score: 0, itemSnapshot: shortSnapshot, answer: { text: "Berlin!!" } });
    await expect(acceptAsCorrect(form({ responseId: "r1" }))).rejects.toThrow(/^REDIRECT .*undo=accept&response=r1$/);
    expect(writes[0]).toMatchObject({ kind: "update", values: { score: 1, isCorrect: true } });
    expect(writes[1]).toMatchObject({ kind: "insert", values: { meta: { originalScore: 0, originalCorrect: false } } });
    expect((writes[1].values as { meta: Record<string, unknown> }).meta.gapId).toBeUndefined();
  });

  it("changes nothing once the result is final, while the exam runs, or for an unknown id", async () => {
    for (const f of [found({ final: true }), found({ ended: false }), null]) {
      store.found = f;
      await expect(acceptAsCorrect(form({ responseId: "r1", gapId: "g2" }))).rejects.toThrow(/^REDIRECT /);
    }
    expect(writes).toEqual([]);
    expect(calls).not.toHaveBeenCalledWith("recomputeResult", expect.anything());
  });

  it("refuses answers that are not typed objective, a full-mark short text, or an empty short text", async () => {
    const matching = { type: "MATCHING", content: { kind: "MATCHING", left: [], right: [] }, key: { kind: "MATCHING", pairs: {} } };
    for (const r of [
      { itemSnapshot: matching, answer: { matches: { l1: "b" } } },
      { itemSnapshot: shortSnapshot, score: 1, isCorrect: true, answer: { text: "Berlin" } },
      { itemSnapshot: shortSnapshot, answer: { text: " " } },
    ]) {
      store.found = found({}, r);
      await expect(acceptAsCorrect(form({ responseId: "r1", gapId: "g2" }))).rejects.toThrow(/^REDIRECT /);
    }
    expect(writes).toEqual([]);
  });

  it("does not accept a short text twice", async () => {
    store.found = found({}, { score: 0, itemSnapshot: shortSnapshot, answer: { text: "Bonn" } });
    store.accepted = { r1: { originalScore: 0, originalCorrect: false, gapIds: [] } };
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
    store.found = found({}, { score: 1, isCorrect: true, itemSnapshot: shortSnapshot, answer: { text: "Bonn" } });
    store.accepted = { r1: { originalScore: 0.5, originalCorrect: false, gapIds: [] } };
    await expect(undoAcceptAsCorrect(form({ responseId: "r1", tab: "READING" }))).rejects.toThrow(/^REDIRECT /);
    expect(writes[0]).toMatchObject({ kind: "update", values: { score: 0.5, isCorrect: false } });
    expect(writes[1]).toMatchObject({ kind: "insert", values: { action: "response.accept_undo", subjectId: "r1" } });
    expect(calls).toHaveBeenCalledWith("reestimateRun", "run1");
    expect(calls).toHaveBeenCalledWith("recomputeResult", "t1");
  });

  it("undoing one gap among two accepted keeps the other: score follows the remaining accepted gap", async () => {
    // g1 key-correct, g2 and g3 accepted: 3/4 now; undo g2 leaves g1 + g3 = 2/4.
    store.found = found({}, { score: 0.75, answer: { gaps: { g1: "dem", g2: "im", g3: "aufs" } } });
    store.accepted = { r1: { originalScore: 0.25, originalCorrect: false, gapIds: ["g2", "g3"] } };
    await expect(undoAcceptAsCorrect(form({ responseId: "r1", gapId: "g2" }))).rejects.toThrow(/^REDIRECT /);
    expect(writes[0]).toMatchObject({ kind: "update", values: { score: 0.5, isCorrect: false } });
    expect(writes[1]).toMatchObject({ kind: "insert", values: { action: "response.accept_undo", meta: { gapId: "g2", restoredScore: 0.5 } } });
  });

  it("undoing the last accepted gap restores the original score exactly", async () => {
    store.found = found({}, { score: 0.5, answer: { gaps: { g1: "dem", g2: "im" } } });
    store.accepted = { r1: { originalScore: 0.25, originalCorrect: false, gapIds: ["g2"] } };
    await expect(undoAcceptAsCorrect(form({ responseId: "r1", gapId: "g2" }))).rejects.toThrow(/^REDIRECT /);
    expect(writes[0]).toMatchObject({ kind: "update", values: { score: 0.25, isCorrect: false } });
  });

  it("refuses to undo a gap that was not accepted", async () => {
    store.accepted = { r1: { originalScore: 0.25, originalCorrect: false, gapIds: ["g2"] } };
    await expect(undoAcceptAsCorrect(form({ responseId: "r1", gapId: "g3" }))).rejects.toThrow(/^REDIRECT /);
    expect(writes).toEqual([]);
  });

  it("does nothing when there is no acceptance to undo", async () => {
    await expect(undoAcceptAsCorrect(form({ responseId: "r1" }))).rejects.toThrow(/^REDIRECT /);
    expect(writes).toEqual([]);
  });

  it("does nothing on a final result", async () => {
    store.found = found({ final: true });
    store.accepted = { r1: { originalScore: 0, originalCorrect: false, gapIds: ["g2"] } };
    await expect(undoAcceptAsCorrect(form({ responseId: "r1", gapId: "g2" }))).rejects.toThrow(/^REDIRECT /);
    expect(writes).toEqual([]);
  });
});
