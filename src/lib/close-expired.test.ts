import { beforeEach, describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => ({
  wheres: [] as string[],
  /** Rows each awaited statement answers, in order; an empty queue answers []. */
  results: [] as unknown[][],
  writes: [] as Array<{ kind: string; table: string; values: unknown }>,
}));

vi.mock("@/db", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const { SQL, getTableName } = await import("drizzle-orm");
  const dialect = new PgDialect();
  const statement = (kind: string, target?: unknown) => {
    const op = { kind, table: target ? getTableName(target as never) : "", values: undefined as unknown };
    const chain: Record<string, unknown> = {};
    for (const name of ["leftJoin", "innerJoin", "orderBy", "limit", "returning"]) chain[name] = () => chain;
    chain.from = (t: unknown) => {
      op.table = getTableName(t as never);
      return chain;
    };
    chain.set = (values: unknown) => {
      op.values = values;
      return chain;
    };
    chain.where = (condition: unknown) => {
      if (condition instanceof SQL) seen.wheres.push(dialect.sqlToQuery(condition).sql);
      return chain;
    };
    chain.then = (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => {
      if (kind !== "select") seen.writes.push({ kind, table: op.table, values: op.values });
      return Promise.resolve(seen.results.shift() ?? []).then(resolve, reject);
    };
    return chain;
  };
  return { db: { select: () => statement("select"), update: (t: unknown) => statement("update", t) } };
});

const io = vi.hoisted(() => ({
  salvage: vi.fn<(key: string, uploadId: string) => Promise<{ bytes: number; parts: Array<{ partNumber: number; etag: string; bytes: number }> }>>(),
  enqueueTranscription: vi.fn<(id: string) => Promise<boolean>>(async () => true),
  reopenGradingForMedia: vi.fn<(id: string) => Promise<void>>(async () => undefined),
}));

vi.mock("@/lib/storage", () => ({ getStorage: () => ({ salvage: io.salvage }) }));
vi.mock("@/lib/queue", () => ({ enqueueTranscription: io.enqueueTranscription }));
vi.mock("@/lib/exam-results", () => ({ reopenGradingForMedia: io.reopenGradingForMedia }));
vi.mock("@/lib/exam-flow", () => ({ closeSectionRun: async () => undefined }));

import { salvageAbandonedUploads } from "./close-expired";

const NOW = new Date("2026-10-05T09:00:00Z");

beforeEach(() => {
  seen.wheres = [];
  seen.results = [];
  seen.writes = [];
  io.salvage.mockReset();
  io.enqueueTranscription.mockClear();
  io.reopenGradingForMedia.mockClear();
});

describe("the exam's upload salvage", () => {
  it("takes only uploads that belong to an exam section; other solutions salvage their own", async () => {
    await salvageAbandonedUploads(new Date("2026-10-05T09:00:00Z"), 5);
    expect(seen.wheres[0]).toContain('"media_assets"."section_run_id" is not null');
  });

  it("otherwise salvages an exam recording exactly as before: INCOMPLETE, attached to its answer, regraded, transcribed", async () => {
    const old = new Date(NOW.getTime() - 60 * 60 * 1000);
    const asset = { id: "m1", createdAt: old, storageKey: "media/o/a/sr1/m1.webm", uploadId: "u1", mime: "audio/webm", itemResponseId: "ir1", sectionRunId: "sr1" };
    io.salvage.mockResolvedValueOnce({ bytes: 300, parts: [{ partNumber: 1, etag: "e", bytes: 300 }] });
    seen.results = [
      [{ asset, run: { id: "sr1", completion: "EXPIRED", deadlineAt: old, lastHeartbeatAt: null } }],
      [{ id: "m1" }],
      [{ id: "ir1", answer: { text: "" } }],
      [],
    ];
    const result = await salvageAbandonedUploads(NOW, 20);
    expect(result).toEqual({ scanned: 1, salvaged: 1, failed: 0, skipped: 0, errors: 0, details: [{ mediaAssetId: "m1", outcome: "INCOMPLETE: 300 bytes from 1 parts" }] });
    expect(io.salvage).toHaveBeenCalledWith("media/o/a/sr1/m1.webm", "u1");
    expect(seen.writes).toEqual([
      { kind: "update", table: "media_assets", values: { status: "INCOMPLETE", bytes: 300, parts: [{ partNumber: 1, etag: "e", bytes: 300 }] } },
      { kind: "update", table: "item_responses", values: { answer: { text: "", mediaAssetId: "m1" }, updatedAt: NOW } },
    ]);
    expect(io.reopenGradingForMedia).toHaveBeenCalledWith("ir1");
    expect(io.enqueueTranscription).toHaveBeenCalledWith("m1");
  });
});
