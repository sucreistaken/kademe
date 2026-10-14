import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { getTableName, type SQL, type Table } from "drizzle-orm";

/**
 * What the candidate hard delete removes from storage before the row goes.
 * Deleting the candidate cascades down to every attempt-scoped table, so any
 * object those rows point at and this list misses is orphaned in the bucket.
 * The database is faked per table: each query is answered with that table's
 * rows, and its filter is rendered to check it is the candidate's own.
 */

const h = vi.hoisted(() => ({
  rows: {} as Record<string, Array<{ id: string; candidateId: string; storageKey: string }>>,
  asked: [] as Array<{ table: string; sql: string; params: unknown[] }>,
}));

const dialect = new PgDialect();

vi.mock("@/db", () => {
  const select = (fields: Record<string, unknown>) => {
    let table = "";
    const c = {
      from: (t: Table) => {
        table = getTableName(t);
        return c;
      },
      innerJoin: () => c,
      where: (w: SQL) => {
        h.asked.push({ table, ...dialect.sqlToQuery(w) });
        return c;
      },
      then: (resolve: (rows: unknown[]) => unknown) => {
        const rows = h.rows[table] ?? [];
        return Promise.resolve("n" in fields ? [{ n: rows.length }] : rows).then(resolve);
      },
    };
    return c;
  };
  return { db: { select } };
});
vi.mock("@/lib/storage", () => ({ getStorage: () => ({}) }));

import { candidateMediaKeys, countCandidateObjects } from "./retention";

beforeEach(() => {
  h.asked = [];
  h.rows = {
    media_assets: [{ id: "m1", candidateId: "cand-1", storageKey: "media/org-1/answer.webm" }],
    proctor_evidence: [
      { id: "e1", candidateId: "cand-1", storageKey: "proctor/org-1/asm-1/e1.jpg" },
      { id: "e2", candidateId: "cand-1", storageKey: "proctor/org-1/asm-1/e2.webp" },
    ],
    proctor_recordings: [{ id: "r1", candidateId: "cand-1", storageKey: "proctor/org-1/asm-1/rec/att-1/camera-run-a-00000.webm" }],
  };
});

describe("candidate hard delete: storage objects", () => {
  it("collects the answers, the proctoring frames and the exam recording", async () => {
    const objects = await candidateMediaKeys(["cand-1"]);
    expect(objects.map((o) => o.storageKey).sort()).toEqual([
      "media/org-1/answer.webm",
      "proctor/org-1/asm-1/e1.jpg",
      "proctor/org-1/asm-1/e2.webp",
      "proctor/org-1/asm-1/rec/att-1/camera-run-a-00000.webm",
    ]);
    expect(h.asked.map((q) => q.table)).toEqual(["media_assets", "proctor_evidence", "proctor_recordings"]);
  });

  it("asks each table only for the candidates being deleted", async () => {
    await candidateMediaKeys(["cand-1", "cand-2"]);
    for (const q of h.asked) {
      expect(q.sql).toBe('"assessments"."candidate_id" in ($1, $2)');
      expect(q.params).toEqual(["cand-1", "cand-2"]);
    }
  });

  it("counts the same objects for the report", async () => {
    expect(await countCandidateObjects(["cand-1"])).toBe(4);
  });

  it("asks nothing for no candidates", async () => {
    expect(await candidateMediaKeys([])).toEqual([]);
    expect(await countCandidateObjects([])).toBe(0);
    expect(h.asked).toEqual([]);
  });
});
