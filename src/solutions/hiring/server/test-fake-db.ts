import { getTableName, SQL, Table } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

/**
 * Test helper: a fake database that records every statement (table, WHERE
 * with its bound parameters, joins, lock, written values) and answers from
 * `fake.respond`. A test mocks "@/db" with `fakeDb()` and reads `fake.ops`.
 * The one copy every hiring server test uses, shared through this module so
 * the mock factory and the test see one state.
 */
export type Op = {
  kind: "select" | "insert" | "update" | "delete";
  /** True for selectDistinct. */
  distinct?: boolean;
  table: string;
  where: string;
  params: unknown[];
  joins: string[];
  values?: unknown;
  lock?: string;
  /** The keys a select asked for, so a test can prove a column was never read. */
  fields?: string[];
};

export const fake: { ops: Op[]; respond: (op: Op) => unknown[] } = { ops: [], respond: () => [] };

const dialect = new PgDialect();

function sqlOf(condition: unknown) {
  if (!(condition instanceof SQL)) return { sql: "", params: [] as unknown[] };
  return dialect.sqlToQuery(condition);
}

function statement(kind: Op["kind"], table?: unknown, distinct = false, fields?: unknown) {
  const op: Op = {
    kind,
    table: table instanceof Table ? getTableName(table) : "",
    where: "",
    params: [],
    joins: [],
    ...(distinct ? { distinct } : {}),
    ...(fields && typeof fields === "object" ? { fields: Object.keys(fields) } : {}),
  };
  const join = (t: unknown, condition: unknown) => {
    const { sql, params } = sqlOf(condition);
    op.joins.push(`${getTableName(t as Table)} ON ${sql}`);
    op.params.push(...params);
    return chain;
  };
  const chain = {
    from: (t: unknown) => {
      op.table = getTableName(t as Table);
      return chain;
    },
    innerJoin: join,
    leftJoin: join,
    values: (v: unknown) => {
      op.values = v;
      return chain;
    },
    set: (v: unknown) => {
      op.values = v;
      return chain;
    },
    where: (condition: unknown) => {
      const { sql, params } = sqlOf(condition);
      op.where = sql;
      op.params.push(...params);
      return chain;
    },
    for: (lock: string) => {
      op.lock = lock;
      return chain;
    },
    limit: () => chain,
    groupBy: () => chain,
    onConflictDoNothing: () => chain,
    onConflictDoUpdate: () => chain,
    orderBy: () => chain,
    returning: () => chain,
    then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => {
      fake.ops.push(op);
      return Promise.resolve()
        .then(() => fake.respond(op))
        .then(resolve, reject);
    },
  };
  return chain;
}

export function fakeDb() {
  const x = {
    select: (fields?: unknown) => statement("select", undefined, false, fields),
    selectDistinct: (fields?: unknown) => statement("select", undefined, true, fields),
    insert: (t: unknown) => statement("insert", t),
    update: (t: unknown) => statement("update", t),
    delete: (t: unknown) => statement("delete", t),
    /** A raw statement (an advisory lock, for instance): recorded as a read with table "(execute)". */
    execute: async (query: unknown) => {
      const { sql, params } = sqlOf(query);
      const op: Op = { kind: "select", table: "(execute)", where: sql, params, joins: [] };
      fake.ops.push(op);
      return fake.respond(op);
    },
    transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(x),
  };
  return x;
}

export const writesOf = (ops: Op[]) => ops.filter((o) => o.kind !== "select");
