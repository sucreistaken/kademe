import { describe, it, expect } from "vitest";
import { MAX_BATCH, mergeInterval, normalizeBatch, type NormalizedEvent } from "./events";

const ctx = { now: 1_000_000, attemptStartedAt: 100_000, clientOffsetMs: 0 };

describe("normalizeBatch", () => {
  it("accepts a well-formed browser event and stamps source and severity", () => {
    const r = normalizeBatch([{ clientEventId: "a", type: "TAB_HIDDEN", at: 200_000 }], ctx);
    expect(r.rejected).toBe(0);
    expect(r.accepted).toEqual([
      {
        clientEventId: "a",
        type: "TAB_HIDDEN",
        source: "BROWSER",
        severity: "HIGH",
        startedAt: 200_000,
        endedAt: null,
        meta: null,
      },
    ]);
  });

  it("rejects a non-array payload", () => {
    expect(normalizeBatch({ events: [] }, ctx)).toEqual({ accepted: [], rejected: 1 });
    expect(normalizeBatch(null, ctx)).toEqual({ accepted: [], rejected: 1 });
  });

  it("rejects unknown types and server-only types", () => {
    const r = normalizeBatch(
      [
        { clientEventId: "a", type: "HEARTBEAT_GAP", at: 200_000 },
        { clientEventId: "b", type: "TERMINATED", at: 200_000 },
        { clientEventId: "c", type: "NOPE", at: 200_000 },
        { clientEventId: "d", type: "PHONE_DETECTED", at: 200_000 },
      ],
      ctx,
    );
    expect(r.rejected).toBe(3);
    expect(r.accepted.map((e) => e.type)).toEqual(["PHONE_DETECTED"]);
    expect(r.accepted[0].source).toBe("MODEL");
  });

  it("rejects malformed items", () => {
    const r = normalizeBatch(
      [
        { clientEventId: "", type: "FOCUS_LOST", at: 200_000 },
        { clientEventId: "x".repeat(65), type: "FOCUS_LOST", at: 200_000 },
        { clientEventId: "a", type: "FOCUS_LOST", at: "200000" },
        { clientEventId: "b", type: "FOCUS_LOST", at: Number.NaN },
        { clientEventId: "c", type: "FOCUS_LOST", at: Infinity },
        "garbage",
        null,
      ],
      ctx,
    );
    expect(r.accepted).toEqual([]);
    expect(r.rejected).toBe(7);
  });

  it(`caps a batch at ${MAX_BATCH} and counts the overflow as rejected`, () => {
    const raw = Array.from({ length: 60 }, (_, i) => ({
      clientEventId: `e${i}`,
      type: "COPY_ATTEMPT",
      at: 200_000 + i,
    }));
    const r = normalizeBatch(raw, ctx);
    expect(r.accepted).toHaveLength(50);
    expect(r.rejected).toBe(10);
  });

  it("corrects the client clock by the offset", () => {
    const r = normalizeBatch(
      [{ clientEventId: "a", type: "FOCUS_LOST", at: 190_000, endedAt: 195_000 }],
      { ...ctx, clientOffsetMs: 10_000 },
    );
    expect(r.accepted[0].startedAt).toBe(200_000);
    expect(r.accepted[0].endedAt).toBe(205_000);
  });

  it("clamps times into the attempt window", () => {
    const r = normalizeBatch(
      [
        { clientEventId: "early", type: "FOCUS_LOST", at: 0, endedAt: 150_000 },
        { clientEventId: "late", type: "FOCUS_LOST", at: 5_000_000, endedAt: 6_000_000 },
      ],
      ctx,
    );
    const [early, late] = r.accepted;
    expect(early.startedAt).toBe(100_000);
    expect(early.endedAt).toBe(150_000);
    expect(late.startedAt).toBe(1_000_000);
    expect(late.endedAt).toBe(1_000_000);
  });

  it("pins an end before the start to the start", () => {
    const r = normalizeBatch(
      [{ clientEventId: "a", type: "FOCUS_LOST", at: 300_000, endedAt: 250_000 }],
      ctx,
    );
    expect(r.accepted[0].endedAt).toBe(300_000);
  });

  it("drops endedAt on point events", () => {
    const r = normalizeBatch(
      [{ clientEventId: "a", type: "PASTE_ATTEMPT", at: 300_000, endedAt: 400_000 }],
      ctx,
    );
    expect(r.accepted[0].endedAt).toBeNull();
  });

  it("computes severity from the corrected duration", () => {
    const r = normalizeBatch(
      [
        { clientEventId: "a", type: "FOCUS_LOST", at: 200_000, endedAt: 205_000 },
        { clientEventId: "b", type: "FOCUS_LOST", at: 200_000, endedAt: 215_000 },
        { clientEventId: "c", type: "NO_FACE", at: 200_000, endedAt: 240_000 },
      ],
      ctx,
    );
    expect(r.accepted.map((e) => e.severity)).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });

  it("keeps small object meta and drops oversize or non-object meta", () => {
    const r = normalizeBatch(
      [
        { clientEventId: "a", type: "BLOCKED_SHORTCUT", at: 200_000, meta: { key: "c", ctrl: true } },
        { clientEventId: "b", type: "BLOCKED_SHORTCUT", at: 200_000, meta: { blob: "x".repeat(3000) } },
        { clientEventId: "c", type: "BLOCKED_SHORTCUT", at: 200_000, meta: ["a"] },
        { clientEventId: "d", type: "BLOCKED_SHORTCUT", at: 200_000, meta: "str" },
      ],
      ctx,
    );
    expect(r.rejected).toBe(0);
    expect(r.accepted.map((e) => e.meta)).toEqual([{ key: "c", ctrl: true }, null, null, null]);
  });

  it("counts multibyte characters in the meta size limit", () => {
    // 700 three-byte characters are 2100 bytes but only 700 string units.
    const r = normalizeBatch(
      [{ clientEventId: "a", type: "WINDOW_RESIZED", at: 200_000, meta: { s: "€".repeat(700) } }],
      ctx,
    );
    expect(r.accepted[0].meta).toBeNull();
  });

  it("merges start and end of the same interval sent in one batch", () => {
    const r = normalizeBatch(
      [
        { clientEventId: "i", type: "FOCUS_LOST", at: 200_000 },
        { clientEventId: "i", type: "FOCUS_LOST", at: 200_000, endedAt: 220_000 },
      ],
      ctx,
    );
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0]).toMatchObject({ startedAt: 200_000, endedAt: 220_000, severity: "MEDIUM" });
  });

  it("rejects a reused clientEventId with a different type", () => {
    const r = normalizeBatch(
      [
        { clientEventId: "i", type: "FOCUS_LOST", at: 200_000 },
        { clientEventId: "i", type: "TAB_HIDDEN", at: 200_000 },
      ],
      ctx,
    );
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toBe(1);
  });
});

describe("mergeInterval", () => {
  const base: NormalizedEvent = {
    clientEventId: "i",
    type: "NO_FACE",
    source: "MODEL",
    severity: "MEDIUM",
    startedAt: 1000,
    endedAt: null,
    meta: null,
  };

  it("closes an open interval and recomputes severity", () => {
    const merged = mergeInterval(base, { ...base, startedAt: 1200, endedAt: 60_000 });
    expect(merged).toMatchObject({ startedAt: 1000, endedAt: 60_000, severity: "HIGH" });
  });

  it("keeps the earliest start and latest end regardless of order", () => {
    const a = { ...base, startedAt: 1000, endedAt: 5000 };
    const b = { ...base, startedAt: 900, endedAt: 4000 };
    expect(mergeInterval(a, b)).toEqual(mergeInterval(b, a));
    expect(mergeInterval(a, b)).toMatchObject({ startedAt: 900, endedAt: 5000 });
  });

  it("is idempotent and keeps an end once seen", () => {
    const closed = { ...base, endedAt: 5000 };
    expect(mergeInterval(closed, closed)).toEqual(mergeInterval(closed, base));
  });

  it("refuses to merge different intervals", () => {
    expect(() => mergeInterval(base, { ...base, clientEventId: "j" })).toThrow();
    expect(() => mergeInterval(base, { ...base, type: "GAZE_AWAY" })).toThrow();
  });
});
