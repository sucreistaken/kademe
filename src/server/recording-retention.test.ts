import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * Which recording segments the purge takes, and what it does with them. The
 * fake database below answers the purge's selects with the same rule the SQL
 * states (purge_after set and passed), so the order of operations, the two
 * switches and the round logic are checked without Postgres; the SQL itself
 * is checked by rendering it.
 */

type Row = { id: string; orgId: string; attemptId: string; storageKey: string; bytes: number; purgeAfter: Date | null };

const h = vi.hoisted(() => ({
  rows: [] as Row[],
  log: [] as string[],
  audit: [] as Array<Record<string, unknown>>,
  failKeys: new Set<string>(),
}));

const dialect = new PgDialect();
const NOW = new Date("2026-10-14T03:00:00Z");

vi.mock("@/db", async () => {
  const { isRecordingDue } = await vi.importActual<typeof import("./recording-retention")>("./recording-retention");
  const select = (fields: Record<string, unknown>) => {
    let where: SQL | undefined;
    let limit = Infinity;
    const due = () => {
      const params = where ? dialect.sqlToQuery(where).params : [];
      return h.rows
        .filter((r) => isRecordingDue(r, NOW) && !params.includes(r.id))
        .sort((a, b) => a.purgeAfter!.getTime() - b.purgeAfter!.getTime());
    };
    const chain = {
      from: () => chain,
      where: (w: SQL) => {
        where = w;
        return chain;
      },
      orderBy: () => chain,
      limit: (n: number) => {
        limit = n;
        return chain;
      },
      then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => {
        const rows = "n" in fields ? [{ n: due().length, bytes: String(due().reduce((s, r) => s + r.bytes, 0)) }] : due().slice(0, limit);
        if (!("n" in fields)) h.log.push(`select ${rows.length}`);
        return Promise.resolve(rows).then(resolve, reject);
      },
    };
    return chain;
  };
  return {
    db: {
      select,
      delete: () => ({
        where: (w: SQL) => {
          const ids = dialect.sqlToQuery(w).params as string[];
          h.log.push(`delete rows ${ids.length}`);
          h.rows = h.rows.filter((r) => !ids.includes(r.id));
          return Promise.resolve();
        },
      }),
      insert: () => ({
        values: (v: Array<Record<string, unknown>>) => {
          h.audit.push(...v);
          h.log.push(`audit ${v.length}`);
          return Promise.resolve();
        },
      }),
      update: () => {
        throw new Error("the purge never updates");
      },
    },
  };
});

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    delete: async (key: string) => {
      if (h.failKeys.has(key)) throw new Error("bucket says no");
      h.log.push(`object ${key.split("/").pop()}`);
    },
  }),
}));

import { RECORDING_ROUND, isRecordingDue, purgeRecordings, recordingPurgeWhere, selectDue } from "./recording-retention";

const day = 86_400_000;
const row = (id: string, purgeOffsetMs: number | null, attemptId = "att-1"): Row => ({
  id,
  orgId: "org-1",
  attemptId,
  storageKey: `proctor/org-1/asm-1/rec/${attemptId}/camera-run-${id}.webm`,
  bytes: 100,
  purgeAfter: purgeOffsetMs === null ? null : new Date(NOW.getTime() + purgeOffsetMs),
});

beforeEach(() => {
  h.rows = [];
  h.log = [];
  h.audit = [];
  h.failKeys = new Set();
});

describe("selection", () => {
  it("takes a segment once its purge date has passed, inclusive, and never one without a date", () => {
    expect(isRecordingDue({ purgeAfter: new Date(NOW.getTime() - 1) }, NOW)).toBe(true);
    expect(isRecordingDue({ purgeAfter: NOW }, NOW)).toBe(true);
    expect(isRecordingDue({ purgeAfter: new Date(NOW.getTime() + 1) }, NOW)).toBe(false);
    expect(isRecordingDue({ purgeAfter: null }, NOW)).toBe(false);
  });

  it("works oldest first and stops at the batch", () => {
    const rows = [row("b", -1 * day), row("a", -3 * day), row("future", 1 * day), row("never", null), row("c", -2 * day)];
    expect(selectDue(rows, NOW, 2).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("says the same thing in SQL", () => {
    const { sql, params } = dialect.sqlToQuery(recordingPurgeWhere(NOW));
    expect(sql).toBe('("proctor_recordings"."purge_after" is not null and "proctor_recordings"."purge_after" <= $1)');
    expect(params).toEqual([NOW.toISOString()]);
  });
});

describe("purgeRecordings", () => {
  it("reports and writes nothing by default", async () => {
    h.rows = [row("a", -day), row("b", -day), row("keep", day)];
    const report = await purgeRecordings({ now: NOW });
    expect(report).toMatchObject({ mode: "REPORT", due: 2, bytesDue: 200, inBatch: 2, remaining: 0, applied: null });
    expect(h.log).toEqual(["select 2"]);
    expect(h.rows).toHaveLength(3);
  });

  it("with apply, removes the object first and the row second, and writes one audit row per attempt", async () => {
    h.rows = [row("a", -2 * day), row("b", -day, "att-2"), row("c", -day), row("keep", day)];
    const report = await purgeRecordings({ now: NOW, apply: true });
    expect(report.applied).toMatchObject({ segmentsDeleted: 3, bytesDeleted: 300, keysSkipped: 0, storageFailures: [] });
    expect(h.log).toEqual(["select 3", "object camera-run-a.webm", "object camera-run-b.webm", "object camera-run-c.webm", "delete rows 3", "audit 2"]);
    expect(h.rows.map((r) => r.id)).toEqual(["keep"]);
    expect(h.audit.map((a) => [a.subjectId, (a.meta as { segments: number }).segments])).toEqual([
      ["att-1", 2],
      ["att-2", 1],
    ]);
    expect(h.audit.every((a) => a.action === "retention.recording.purge" && a.actorId === null)).toBe(true);
  });

  it("keeps the row of a segment whose object could not be removed", async () => {
    h.rows = [row("a", -2 * day), row("b", -day)];
    h.failKeys.add(h.rows[0].storageKey);
    const report = await purgeRecordings({ now: NOW, apply: true });
    expect(report.applied?.storageFailures).toHaveLength(1);
    expect(report.applied?.segmentsDeleted).toBe(1);
    expect(h.rows.map((r) => r.id)).toEqual(["a"]);
    expect(report.remaining).toBe(1);
  });

  it("goes round after round through a backlog bigger than one round, skipping what it could not remove", async () => {
    h.rows = Array.from({ length: RECORDING_ROUND + 5 }, (_, i) => row(`r${String(i).padStart(5, "0")}`, -day - (RECORDING_ROUND + 5 - i)));
    const stuckKey = h.rows[0].storageKey;
    h.failKeys.add(stuckKey);
    const report = await purgeRecordings({ now: NOW, apply: true });
    expect(report.applied?.segmentsDeleted).toBe(RECORDING_ROUND + 4);
    expect(report.applied?.storageFailures.map((f) => f.key)).toEqual([stuckKey]);
    expect(h.rows.map((r) => r.id)).toEqual(["r00000"]);
    expect(h.log.filter((l) => l.startsWith("select"))).toEqual([`select ${RECORDING_ROUND}`, "select 5"]);
  });

  it("never hands storage a key it did not write", async () => {
    h.rows = [{ ...row("x", -day), storageKey: "media/org-1/something-else.webm" }];
    const report = await purgeRecordings({ now: NOW, apply: true });
    expect(report.applied).toMatchObject({ keysSkipped: 1, segmentsDeleted: 0 });
    expect(h.rows).toHaveLength(1);
    expect(h.log.some((l) => l.startsWith("object"))).toBe(false);
  });

  it("an explicit batch is one round of that size (how an operator tries the switch on one segment)", async () => {
    h.rows = [row("a", -3 * day), row("b", -2 * day), row("c", -day)];
    const report = await purgeRecordings({ now: NOW, apply: true, batch: 1 });
    expect(report.applied?.segmentsDeleted).toBe(1);
    expect(h.rows.map((r) => r.id)).toEqual(["b", "c"]);
    expect(report.remaining).toBe(2);
  });
});
