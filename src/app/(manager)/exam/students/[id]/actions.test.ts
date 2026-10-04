import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * The exam panel's actions take an id from a form and must only ever touch the
 * language exam's rows. The fake database below holds exactly one invitation in
 * the user's own organisation; a query finds it unless its WHERE clause filters
 * on another solution, which is how Postgres would answer the same query.
 */
type Solution = "LANGUAGE_EXAM" | "HIRING";
const store = { solution: "HIRING" as Solution, resultStatus: "DRAFT" as "DRAFT" | "FINAL" };
const writes: string[] = [];
const dialect = new PgDialect();

function matches(where: SQL): boolean {
  const { sql, params } = dialect.sqlToQuery(where);
  const filter = /"assessments"\."solution" = \$(\d+)/.exec(sql);
  return !filter || params[Number(filter[1]) - 1] === store.solution;
}

function row() {
  const ended = new Date("2026-10-01T10:00:00Z");
  return {
    // gradingInOrg
    grading: { id: "g1", status: "AI_PROPOSED", aiLevel: "B1", finalLevel: null },
    attemptId: "t1",
    assessmentId: "a1",
    ended: true,
    final: false,
    // resultInOrg
    result: { id: "r1", status: store.resultStatus, overallOverride: null, computed: null },
    attempt: { id: "t1", completedAt: ended, terminatedAt: null, integrityOutcome: null },
    assessment: { id: "a1", orgId: "o1", solution: store.solution },
    // decideFlag
    event: { id: "e1", type: "TAB_HIDDEN", attemptId: "t1" },
  };
}

function selectChain() {
  let where: SQL | undefined;
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: (condition: SQL) => {
      where = condition;
      return chain;
    },
    then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(where && matches(where) ? [row()] : []).then(resolve, reject),
  };
  return chain;
}

function writeChain(kind: string) {
  const chain = {
    set: () => chain,
    values: () => chain,
    where: () => chain,
    returning: () => chain,
    then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => {
      writes.push(kind);
      return Promise.resolve([]).then(resolve, reject);
    },
  };
  return chain;
}

vi.mock("@/db", () => ({
  db: {
    select: () => selectChain(),
    update: () => writeChain("update"),
    insert: () => writeChain("insert"),
    delete: () => writeChain("delete"),
  },
}));

const sideEffects = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("@/server/session", () => ({
  requireUser: async () => ({ id: "u1", orgId: "o1", email: "m@x", name: "M", role: "MANAGER" }),
}));
vi.mock("@/lib/exam-results", () => ({
  recomputeResult: async (...args: unknown[]) => sideEffects("recomputeResult", ...args),
  finalizeResult: async (...args: unknown[]) => {
    sideEffects("finalizeResult", ...args);
    return { ok: true };
  },
}));
vi.mock("@/server/proctoring", () => ({
  recomputeIntegrity: async (...args: unknown[]) => sideEffects("recomputeIntegrity", ...args),
}));

import {
  confirmGrading,
  decideFlag,
  finalize,
  overrideGrading,
  overrideOverall,
  release,
  setIntegrityOutcome,
} from "./actions";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

const cases: Array<[string, (f: FormData) => Promise<void>, Record<string, string>, "DRAFT" | "FINAL"]> = [
  ["confirmGrading", confirmGrading, { gradingId: "g1" }, "DRAFT"],
  ["overrideGrading", overrideGrading, { gradingId: "g1", level: "B2", reason: "listened again" }, "DRAFT"],
  ["overrideOverall", overrideOverall, { assessmentId: "a1", level: "B2", reason: "listened again" }, "DRAFT"],
  ["finalize", finalize, { assessmentId: "a1" }, "DRAFT"],
  ["release", release, { assessmentId: "a1" }, "FINAL"],
  ["decideFlag", decideFlag, { eventId: "e1", status: "CONFIRMED", note: "seen" }, "DRAFT"],
  ["setIntegrityOutcome", setIntegrityOutcome, { assessmentId: "a1", outcome: "INVALID" }, "DRAFT"],
];

beforeEach(() => {
  writes.length = 0;
  sideEffects.mockClear();
});

describe("exam panel actions on another solution's invitation", () => {
  it.each(cases)("%s changes nothing on a HIRING invitation in the same organisation", async (_name, action, fields, status) => {
    store.solution = "HIRING";
    store.resultStatus = status;
    await expect(action(form(fields))).rejects.toThrow(/^REDIRECT /);
    expect(writes).toEqual([]);
    expect(sideEffects).not.toHaveBeenCalled();
  });

  it.each(cases)("%s still acts on a LANGUAGE_EXAM invitation", async (_name, action, fields, status) => {
    store.solution = "LANGUAGE_EXAM";
    store.resultStatus = status;
    await expect(action(form(fields))).rejects.toThrow(/^REDIRECT /);
    expect(writes.length).toBeGreaterThan(0);
  });
});
