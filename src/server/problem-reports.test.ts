import { beforeEach, describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => ({ where: "", params: [] as unknown[], order: "" }));

vi.mock("@/db", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  const chain: Record<string, unknown> = {};
  for (const name of ["from", "innerJoin"]) chain[name] = () => chain;
  chain.where = (condition: unknown) => {
    const q = dialect.sqlToQuery(condition as never);
    seen.where = q.sql;
    seen.params = q.params;
    return chain;
  };
  chain.orderBy = (order: unknown) => {
    seen.order = dialect.sqlToQuery(order as never).sql;
    return Promise.resolve([]);
  };
  return { db: { select: () => chain } };
});

import { listProblemReports, recentProblemReports } from "./problem-reports";

beforeEach(() => {
  seen.where = "";
  seen.params = [];
  seen.order = "";
});

describe("problem reports queries", () => {
  it("lists one student's PROBLEM requests of the caller's organisation, newest first", async () => {
    await listProblemReports("o1", "c1");
    expect(seen.where).toContain('"candidate_requests"."org_id" = $');
    expect(seen.where).toContain('"candidate_requests"."kind" = $');
    expect(seen.where).toContain('"assessments"."candidate_id" = $');
    expect(seen.params).toEqual(expect.arrayContaining(["o1", "PROBLEM", "c1"]));
    expect(seen.order).toContain('"candidate_requests"."created_at" desc');
    expect(seen.where).toContain('"candidates"."deleted_at" is null');
  });

  it("lists the PROBLEM requests since a date, in the caller's organisation, newest first", async () => {
    const since = new Date("2026-10-11T00:00:00Z");
    await recentProblemReports("o1", since);
    expect(seen.where).toContain('"candidate_requests"."org_id" = $');
    expect(seen.where).toContain('"candidate_requests"."created_at" >= $');
    expect(seen.params).toEqual(expect.arrayContaining(["o1", "PROBLEM"]));
    expect(seen.order).toContain("desc");
    expect(seen.where).toContain('"candidates"."deleted_at" is null');
  });
});
