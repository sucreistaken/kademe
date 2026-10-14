import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * The storage side of the recording: keys come from the server, a retry does
 * not write twice, and every read for the panel is scoped to the viewer's
 * organisation in the query itself.
 */

const h = vi.hoisted(() => ({
  queries: [] as Array<{ sql: string; params: unknown[] }>,
  answers: [] as unknown[][],
  inserts: [] as Array<Record<string, unknown>>,
  insertReturns: [{ id: "new-row" }] as unknown[],
  puts: [] as string[],
}));

const dialect = new PgDialect();

vi.mock("@/db", () => {
  const chain = () => {
    const c = {
      from: () => c,
      innerJoin: () => c,
      orderBy: () => c,
      limit: () => c,
      where: (w: SQL) => {
        h.queries.push(dialect.sqlToQuery(w));
        return c;
      },
      then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(h.answers.shift() ?? []).then(resolve, reject),
    };
    return c;
  };
  return {
    db: {
      select: () => chain(),
      insert: () => {
        const c = {
          values: (v: Record<string, unknown>) => {
            h.inserts.push(v);
            return c;
          },
          onConflictDoNothing: () => c,
          returning: () => c,
          then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(h.insertReturns).then(resolve),
        };
        return c;
      },
    },
  };
});
vi.mock("@/lib/storage", () => ({ getStorage: () => ({ putObject: async (key: string) => void h.puts.push(key) }) }));

import { auditRecordingView, findSegmentForViewer, isRecordingKey, loadRecordingSegments, recordingConsent, recordingKey, storeRecordingSegment } from "./recordings";

const ORG = "11111111-1111-4111-8111-111111111111";
const ATTEMPT = "22222222-2222-4222-8222-222222222222";
const SEG = "33333333-3333-4333-8333-333333333333";
const ctx = { assessment: { id: "asm-1", orgId: ORG, solution: "LANGUAGE_EXAM" }, evidenceRetentionDays: 90 } as never;
const meta = { kind: "CAMERA" as const, runId: "run-abcdef01", sequence: 7, startedAt: Date.UTC(2026, 9, 14, 9, 0, 0), durationMs: 15_000 };

beforeEach(() => {
  h.queries = [];
  h.answers = [];
  h.inserts = [];
  h.insertReturns = [{ id: "new-row" }];
  h.puts = [];
});

describe("recordingKey", () => {
  it("is derived from rows and validated metadata, the same for the same segment", () => {
    const input = { orgId: ORG, assessmentId: "asm-1", attemptId: ATTEMPT, kind: "SCREEN" as const, runId: "run-abcdef01", sequence: 12, mime: "video/webm" as const };
    expect(recordingKey(input)).toBe(`proctor/${ORG}/asm-1/rec/${ATTEMPT}/screen-run-abcdef01-00012.webm`);
    expect(recordingKey(input)).toBe(recordingKey({ ...input }));
    expect(recordingKey({ ...input, mime: "video/mp4" })).toMatch(/\.mp4$/);
    expect(isRecordingKey(recordingKey(input))).toBe(true);
    expect(isRecordingKey(`proctor/${ORG}/asm-1/frame.jpg`)).toBe(false);
  });
});

describe("storeRecordingSegment", () => {
  it("writes the object, then the row with the recording retention date (the organisation's, capped at 30 days)", async () => {
    h.answers = [[], []]; // no existing segment, no session match
    const out = await storeRecordingSegment(ctx, ATTEMPT, { ...meta, mime: "video/webm", body: new Uint8Array(10), sessionId: null });
    expect(out).toEqual({ id: "new-row", duplicate: false });
    expect(h.puts).toEqual([`proctor/${ORG}/asm-1/rec/${ATTEMPT}/camera-run-abcdef01-00007.webm`]);
    expect(h.inserts[0]).toMatchObject({ orgId: ORG, attemptId: ATTEMPT, kind: "CAMERA", sequence: 7, bytes: 10, durationMs: 15_000 });
    expect((h.inserts[0].purgeAfter as Date).getTime() - meta.startedAt).toBe(30 * 86_400_000);
  });

  it("does not write anything again for a segment it already has (a retry whose answer was lost)", async () => {
    h.answers = [[{ id: "old-row" }]];
    const out = await storeRecordingSegment(ctx, ATTEMPT, { ...meta, mime: "video/webm", body: new Uint8Array(10), sessionId: null });
    expect(out).toEqual({ id: "old-row", duplicate: true });
    expect(h.puts).toEqual([]);
    expect(h.inserts).toEqual([]);
  });

  it("keeps a session id only when it is one of this attempt's sessions", async () => {
    h.answers = [[], []];
    await storeRecordingSegment(ctx, ATTEMPT, { ...meta, mime: "video/webm", body: new Uint8Array(1), sessionId: "not-a-uuid" });
    expect(h.inserts[0].sessionId).toBeNull();
    h.answers = [[], [{ id: SEG }]];
    await storeRecordingSegment(ctx, ATTEMPT, { ...meta, mime: "video/webm", body: new Uint8Array(1), sessionId: SEG });
    expect(h.inserts[1].sessionId).toBe(SEG);
    const sessionQuery = h.queries.at(-1)!;
    expect(sessionQuery.sql).toContain('"proctor_sessions"."attempt_id" = $');
    expect(sessionQuery.params).toContain(ATTEMPT);
  });
});

describe("recordingConsent", () => {
  it("reads the covers_recording flag of the text this invitation accepted", async () => {
    h.answers = [[{ covers: true }]];
    expect(await recordingConsent("asm-1")).toBe(true);
    const q = h.queries[0];
    expect(q.sql).toBe('"consents"."assessment_id" = $1');
    expect(q.params).toEqual(["asm-1"]);
  });

  it("is false for an invitation accepted under the old text and null without any consent", async () => {
    h.answers = [[{ covers: false }], []];
    expect(await recordingConsent("asm-1")).toBe(false);
    expect(await recordingConsent("asm-1")).toBeNull();
  });
});

describe("reads for the panel", () => {
  it("finds a segment only inside the viewer's organisation", async () => {
    h.answers = [[]];
    expect(await findSegmentForViewer(ORG, SEG)).toBeNull();
    const q = h.queries[0];
    expect(q.sql).toContain('"proctor_recordings"."id" = $1');
    expect(q.sql).toContain('"proctor_recordings"."org_id" = $2');
    expect(q.params).toEqual([SEG, ORG]);
  });

  it("does not even ask for an id that is not a uuid", async () => {
    expect(await findSegmentForViewer(ORG, "../../etc")).toBeNull();
    expect(h.queries).toEqual([]);
  });

  it("lists an attempt's segments scoped to the organisation, with the earliest purge date", async () => {
    h.answers = [
      [
        { id: "a", kind: "CAMERA", startedAt: new Date(1000), durationMs: 15_000, bytes: 9, purgeAfter: new Date(5000) },
        { id: "b", kind: "SCREEN", startedAt: new Date(2000), durationMs: 15_000, bytes: 9, purgeAfter: new Date(4000) },
      ],
    ];
    const out = await loadRecordingSegments(ORG, ATTEMPT);
    expect(out.segments).toEqual([
      { id: "a", kind: "CAMERA", start: 1000, durationMs: 15_000, bytes: 9 },
      { id: "b", kind: "SCREEN", start: 2000, durationMs: 15_000, bytes: 9 },
    ]);
    expect(out.purgeAfter?.getTime()).toBe(4000);
    expect(h.queries[0].params).toEqual([ORG, ATTEMPT]);
  });
});

describe("auditRecordingView", () => {
  const user = { id: "44444444-4444-4444-8444-444444444444", orgId: ORG };

  it("writes media.view once for an attempt of the viewer's organisation", async () => {
    h.answers = [[{ id: ATTEMPT }], []];
    expect(await auditRecordingView(user, ATTEMPT)).toBe(true);
    expect(h.inserts).toEqual([
      { orgId: ORG, actorId: user.id, action: "media.view", subjectType: "attempt", subjectId: ATTEMPT, meta: { what: "proctor_recording" } },
    ]);
    expect(h.queries[0].sql).toContain('"assessments"."org_id" = $');
  });

  it("does not write again within the half hour", async () => {
    h.answers = [[{ id: ATTEMPT }], [{ id: "recent" }]];
    expect(await auditRecordingView(user, ATTEMPT)).toBe(true);
    expect(h.inserts).toEqual([]);
  });

  it("refuses another organisation's attempt", async () => {
    h.answers = [[]];
    expect(await auditRecordingView(user, ATTEMPT)).toBe(false);
    expect(h.inserts).toEqual([]);
  });
});
