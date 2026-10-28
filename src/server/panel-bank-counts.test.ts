import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => ({ db: (await import("@/server/create/test-fake-db")).proxyDb(fake) }));
vi.mock("@/lib/storage", () => ({ getStorage: () => ({}) }));

import { bankCounts } from "./panel";

beforeEach(() => {
  fake.results = [];
  fake.calls = [];
});

describe("bankCounts", () => {
  it("counts the bank's approved, servable items by section and level", async () => {
    fake.results = [[{ section: "GRAMMAR", level: "B1", n: 40, s: 0, c: 3, cz: 4, wb: 3, op: 0 }]];
    expect(await bankCounts("o1")).toEqual([{ section: "GRAMMAR", level: "B1", items: 40, stimuli: 0, cTests: 3, clozeTexts: 4, wordBanks: 3, openTexts: 0 }]);
  });

  it("ignores course test rows, items and texts alike: a form is never a placement or level check's coverage", async () => {
    await bankCounts("o1");
    const [where] = fake.calls.find(([op]) => op === "where")![1];
    const q = new PgDialect().sqlToQuery(where as never);
    expect(q.sql).toContain('"items"."course_form" is null');
    expect(q.sql).toContain('"stimuli"."course_form" is null');
    expect(q.sql).toContain('"items"."status" = $');
    expect(q.params).toEqual(expect.arrayContaining(["o1", "APPROVED"]));
  });
});
