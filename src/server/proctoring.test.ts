import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * The AI review budget: a review that ended SKIPPED (no frames, no vision
 * model) made no model call, so it does not use up the place a later
 * PHONE_DETECTED or MULTIPLE_FACES needs. Checked against the SQL the count
 * renders to, with the database mocked.
 */

const h = vi.hoisted(() => ({
  queries: [] as Array<{ sql: string; params: unknown[] }>,
  used: 0,
  inserts: [] as Array<Record<string, unknown>>,
  enqueued: [] as string[],
}));

const dialect = new PgDialect();

vi.mock("@/db", () => {
  const select = () => {
    const c = {
      from: () => c,
      innerJoin: () => c,
      where: (w: SQL) => {
        h.queries.push(dialect.sqlToQuery(w));
        return c;
      },
      then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve([{ n: h.used }]).then(resolve),
    };
    return c;
  };
  const insert = () => {
    const c = {
      values: (v: Record<string, unknown>) => {
        h.inserts.push(v);
        return c;
      },
      onConflictDoNothing: () => c,
      returning: () => Promise.resolve([{ id: "review-1" }]),
    };
    return c;
  };
  return { db: { select, insert } };
});
vi.mock("@/lib/queue", () => ({ enqueueProctorReview: async (id: string) => void h.enqueued.push(id) }));
vi.mock("@/lib/storage", () => ({ getStorage: () => ({}), proctorEvidenceKey: () => "" }));

import { maybeQueueReview } from "./proctoring";

beforeEach(() => {
  h.queries = [];
  h.used = 0;
  h.inserts = [];
  h.enqueued = [];
});

describe("maybeQueueReview", () => {
  it("counts only reviews that made or may make a model call", async () => {
    await maybeQueueReview("att-1", "evt-1", 30);
    const { sql, params } = h.queries[0];
    expect(sql).toBe('("proctor_events"."attempt_id" = $1 and "proctor_ai_reviews"."status" in ($2, $3, $4))');
    expect(params).toEqual(["att-1", "QUEUED", "DONE", "FAILED"]);
    expect(h.inserts).toEqual([{ eventId: "evt-1", status: "QUEUED" }]);
    expect(h.enqueued).toEqual(["evt-1"]);
  });

  it("queues nothing once the counted reviews reach the budget", async () => {
    h.used = 30;
    await maybeQueueReview("att-1", "evt-2", 30);
    expect(h.inserts).toEqual([]);
    expect(h.enqueued).toEqual([]);
  });
});
