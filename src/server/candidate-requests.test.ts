import { beforeEach, describe, expect, it, vi } from "vitest";

type Op = { kind: string; table: string; where: string; params: unknown[]; values?: unknown };

const seen = vi.hoisted(() => ({
  ops: [] as Op[],
  /** What the look for an open request answers. */
  open: [] as unknown[],
}));

vi.mock("@/db", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const { SQL, getTableName } = await import("drizzle-orm");
  const dialect = new PgDialect();
  const render = (condition: unknown) => (condition instanceof SQL ? dialect.sqlToQuery(condition) : { sql: "", params: [] as unknown[] });
  const statement = (kind: string, target?: unknown) => {
    const op: Op = { kind, table: target ? getTableName(target as never) : "", where: "", params: [] };
    const chain: Record<string, unknown> = {};
    chain.limit = () => chain;
    chain.from = (t: unknown) => {
      op.table = getTableName(t as never);
      return chain;
    };
    chain.values = (values: unknown) => {
      op.values = values;
      return chain;
    };
    chain.where = (condition: unknown) => {
      const { sql, params } = render(condition);
      op.where = sql;
      op.params = params;
      return chain;
    };
    chain.then = (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => {
      seen.ops.push(op);
      return Promise.resolve(kind === "select" ? seen.open : []).then(resolve, reject);
    };
    return chain;
  };
  const x = {
    select: () => statement("select"),
    insert: (t: unknown) => statement("insert", t),
    execute: async (query: unknown) => {
      const { sql, params } = render(query);
      seen.ops.push({ kind: "execute", table: "", where: sql, params });
      return [];
    },
    transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(x),
  };
  return { db: x };
});

import { fileCandidateRequest } from "./candidate-requests";

const input = { orgId: "o1", assessmentId: "a1", kind: "NEW_LINK" as const, message: "Linkim açılmıyor." };
const writes = () => seen.ops.filter((o) => o.kind === "insert");

beforeEach(() => {
  seen.ops = [];
  seen.open = [];
});

/** Ledger carry (Task 3): one open request of a kind per invitation; a second click files nothing new. */
describe("fileCandidateRequest", () => {
  it("files the request in the invitation's organisation when none of its kind is open", async () => {
    expect(await fileCandidateRequest(input)).toEqual({ filed: true });
    expect(writes()).toHaveLength(1);
    expect(writes()[0]).toMatchObject({ table: "candidate_requests", values: { orgId: "o1", assessmentId: "a1", kind: "NEW_LINK", message: "Linkim açılmıyor." } });
  });

  it("looks for an open request of the same kind of the same invitation under a lock on that pair", async () => {
    await fileCandidateRequest({ ...input, kind: "ACCOMMODATION" });
    const lock = seen.ops.find((o) => o.kind === "execute")!;
    expect(lock.where).toContain("pg_advisory_xact_lock");
    expect(lock.params).toEqual(expect.arrayContaining(["a1", "ACCOMMODATION"]));
    const open = seen.ops.find((o) => o.kind === "select")!;
    expect(open.table).toBe("candidate_requests");
    expect(open.where).toContain('"candidate_requests"."org_id" = $');
    expect(open.where).toContain('"candidate_requests"."handled_at" is null');
    expect(open.params).toEqual(expect.arrayContaining(["o1", "a1", "ACCOMMODATION"]));
    // The lock comes before the look.
    expect(seen.ops.indexOf(lock)).toBeLessThan(seen.ops.indexOf(open));
  });

  it("skips the insert when one is already open", async () => {
    seen.open = [{ id: "r1" }];
    expect(await fileCandidateRequest(input)).toEqual({ filed: false });
    expect(writes()).toEqual([]);
  });
});
