import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * seenBy and courseFormsSeenBy over a stand-in database (every awaited chain
 * resolves the next queued result, every call is recorded): which rows each
 * query asks for, and how the answers are folded.
 */
const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => ({ db: (await import("@/server/create/test-fake-db")).proxyDb(fake) }));

import { courseFormsSeenBy, seenBy } from "./exam-exposure";

const whereOf = () => {
  const w = fake.calls.filter(([m]) => m === "where").map(([, a]) => new PgDialect().sqlToQuery(a[0] as SQL));
  expect(w).toHaveLength(1);
  return w[0];
};

beforeEach(() => {
  fake.results = [];
  fake.calls = [];
});

describe("seenBy", () => {
  it("collects the items and texts the student was served, and leaves course items out", async () => {
    fake.results = [[{ itemId: "i1", stimulusId: "s1" }, { itemId: "i2", stimulusId: null }]];
    const avoid = await seenBy("o1", "Ayse@Ornek.com", "a1");
    expect([...avoid.itemIds]).toEqual(["i1", "i2"]);
    expect([...avoid.stimulusIds]).toEqual(["s1"]);
    // A course form is served whole and never avoided: its items do not enter the bank's avoid set.
    expect(whereOf().sql).toContain('"items"."course_form" is null');
  });

  it("asks nothing without an e-mail", async () => {
    for (const email of [null, undefined, "", "  "]) {
      const avoid = await seenBy("o1", email, "a1");
      expect(avoid.itemIds.size + avoid.stimulusIds.size).toBe(0);
    }
    expect(fake.calls).toEqual([]);
  });
});

describe("courseFormsSeenBy", () => {
  it("folds the served items into the forms each e-mail sat, matched without regard to letter case", async () => {
    fake.results = [
      [
        { email: "ayse@ornek.com", courseForm: "B1.1:A" },
        { email: "can@ornek.com", courseForm: "B1.1:A" },
        { email: "can@ornek.com", courseForm: "B1.1:B" },
        { email: "ayse@ornek.com", courseForm: "B1.1:X" },
        { email: "ayse@ornek.com", courseForm: null },
      ],
    ];
    const seen = await courseFormsSeenBy("o1", ["Ayse@Ornek.com", "can@ornek.com", " DENIZ@ornek.com "], "B1.1");
    expect([...seen.keys()]).toEqual(["ayse@ornek.com", "can@ornek.com", "deniz@ornek.com"]);
    expect([...seen.get("ayse@ornek.com")!]).toEqual(["A"]);
    expect([...seen.get("can@ornek.com")!].sort()).toEqual(["A", "B"]);
    // Asked about and never sat anything: an empty entry, so the caller needs no special case.
    expect(seen.get("deniz@ornek.com")).toEqual(new Set());
  });

  it("asks for the two forms of this course test in this school, for these e-mails, without the assessment being started", async () => {
    await courseFormsSeenBy("o1", ["ayse@ornek.com", "AYSE@ornek.com", "can@ornek.com"], "A2", "a-now");
    const w = whereOf();
    expect(w.sql).toContain("lower(");
    expect(w.sql).toContain('"items"."course_form" in');
    expect(w.sql).toContain('"assessments"."id" <>');
    // Both forms of this test only, the e-mails once each, lower-cased.
    expect(w.params).toEqual(expect.arrayContaining(["o1", "A2:A", "A2:B", "ayse@ornek.com", "can@ornek.com", "a-now"]));
    expect(w.params.filter((p) => p === "ayse@ornek.com")).toHaveLength(1);
    expect(w.params).not.toContain("B1:A");
  });

  it("does not leave an assessment out when none is named", async () => {
    await courseFormsSeenBy("o1", ["ayse@ornek.com"], "B1");
    expect(whereOf().sql).not.toContain('"assessments"."id" <>');
  });

  it("asks nothing for an empty list or blank e-mails", async () => {
    expect((await courseFormsSeenBy("o1", [], "B1")).size).toBe(0);
    expect((await courseFormsSeenBy("o1", ["", "  ", null, undefined], "B1")).size).toBe(0);
    expect(fake.calls).toEqual([]);
  });
});
