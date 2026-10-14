import { beforeEach, describe, expect, it, vi } from "vitest";
import { policyFromPreset, type ProctoringPolicy } from "@/lib/proctor/policy";
import { MAX_SEGMENT_BYTES, UPLOAD_GRACE_MS } from "@/lib/proctor/recording-rules";

/**
 * The segment upload: same token and attempt checks as /proctor/evidence (the
 * token resolves through withSolution, the attempt is the token's own, the
 * policy decides what may be stored), plus the grace window after the finish.
 * The candidate plumbing is mocked the way the other candidate route tests do.
 */

const h = vi.hoisted(() => ({
  ctx: { assessment: { id: "asm-1", orgId: "org-1", solution: "LANGUAGE_EXAM" }, locale: "tr", evidenceRetentionDays: 90 },
  policy: null as ProctoringPolicy | null,
  attempt: {} as Record<string, unknown>,
  options: null as unknown,
  store: vi.fn<(...args: unknown[]) => Promise<{ id: string; duplicate: boolean }>>(),
  consent: true as boolean | null,
  consentAsked: [] as string[],
  free: null as number | null,
}));

vi.mock("@/lib/candidate-api", () => {
  const fail = (_ctx: unknown, code: string, status: number) => Response.json({ error: code }, { status });
  return {
    withSolution: (req: unknown, _p: unknown, handler: (r: unknown, c: unknown, s: unknown) => unknown, options: unknown) => {
      h.options = options;
      return handler(req, h.ctx, { proctorPolicy: async () => h.policy });
    },
    fail,
    badRequest: (ctx: unknown, code: string) => fail(ctx, code, 400),
    conflict: (ctx: unknown, code: string) => fail(ctx, code, 409),
  };
});
vi.mock("@/lib/candidate-context", () => ({ currentAttempt: async () => ({ attempt: h.attempt, finished: false }) }));
vi.mock("@/server/recordings", () => ({
  storeRecordingSegment: h.store,
  recordingConsent: async (assessmentId: string) => {
    h.consentAsked.push(assessmentId);
    return h.consent;
  },
}));

vi.mock("@/lib/storage", () => ({ storageFreeBytes: async () => h.free }));

import { NextRequest } from "next/server";
import { PUT } from "./route";

const NOW = Date.now();
const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
const RUN = "0b6f2a4e-9c1d-4f7a-8e2b-1a2b3c4d5e6f";

function put(opts: { query?: Record<string, string>; body?: Uint8Array; type?: string; length?: string } = {}) {
  const query = new URLSearchParams({ kind: "CAMERA", run: RUN, seq: "4", at: String(NOW - 20_000), dur: "15000", session: "sess", ...opts.query });
  const body = opts.body ?? WEBM;
  const headers: Record<string, string> = { "content-type": opts.type ?? "video/webm;codecs=vp8,opus" };
  if (opts.length) headers["content-length"] = opts.length;
  return PUT(new NextRequest(`http://localhost/api/c/tok/proctor/recording?${query}`, { method: "PUT", body: body as BodyInit, headers }), {
    params: Promise.resolve({ token: "t".repeat(43) }),
  });
}

beforeEach(() => {
  h.free = null;
  h.policy = policyFromPreset("STANDARD");
  h.attempt = { id: "att-1", deviceCheckedAt: new Date(NOW - 3600_000), startedAt: new Date(NOW - 3500_000), completedAt: null, terminatedAt: null };
  h.consent = true;
  h.consentAsked = [];
  h.store.mockReset();
  h.store.mockResolvedValue({ id: "rec-1", duplicate: false });
});

describe("PUT /proctor/recording", () => {
  it("stores a camera segment against the token's own attempt and lets a finished link through to the grace check", async () => {
    const res = await put();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ stored: true, id: "rec-1", duplicate: false });
    expect(h.store).toHaveBeenCalledTimes(1);
    const [ctx, attemptId, input] = h.store.mock.calls[0] as [unknown, string, Record<string, unknown>];
    expect(ctx).toBe(h.ctx);
    expect(attemptId).toBe("att-1");
    expect(input).toMatchObject({ kind: "CAMERA", runId: RUN, sequence: 4, durationMs: 15_000, mime: "video/webm", sessionId: "sess" });
    expect((input.body as Uint8Array).byteLength).toBe(WEBM.byteLength);
    expect(h.options).toMatchObject({ allowProblems: ["COMPLETED"] });
  });

  it("refuses the screen when the policy does not share it, and everything when proctoring is off", async () => {
    expect((await put({ query: { kind: "SCREEN" } })).status).toBe(400);
    h.policy = policyFromPreset("OFF");
    expect((await put()).status).toBe(400);
    h.policy = null;
    expect((await put()).status).toBe(400);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("refuses every segment when the accepted consent text does not announce the recording, before reading the body", async () => {
    // An invitation accepted under the old version 1 text.
    h.consent = false;
    const res = await put();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "CONSENT_REQUIRED" });
    expect(h.consentAsked).toEqual(["asm-1"]);
    // No consent on record at all.
    h.consent = null;
    expect((await put()).status).toBe(403);
    // The refusal comes before the size check: nothing is read or stored.
    expect((await put({ length: String(MAX_SEGMENT_BYTES + 1) })).status).toBe(403);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("accepts the screen under STRICT", async () => {
    h.policy = policyFromPreset("STRICT");
    expect((await put({ query: { kind: "SCREEN" } })).status).toBe(200);
  });

  it.each([
    ["a content type that is not a recording", { type: "text/html" }],
    ["a body that is not what the content type claims", { body: new TextEncoder().encode("<script>alert(1)</script>") }],
    ["an empty body", { body: new Uint8Array(0) }],
    ["a run id that could reach a path", { query: { run: "../../x" } }],
    ["a sequence that is not a number", { query: { seq: "abc" } }],
  ])("refuses %s", async (_label, opts) => {
    expect((await put(opts as Parameters<typeof put>[0])).status).toBe(400);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("stops taking segments while less than the disk reserve is free, and takes them again above it", async () => {
    h.free = 500 * 1_048_576;
    const res = await put({});
    expect(res.status).toBe(507);
    expect(await res.json()).toMatchObject({ error: "STORAGE_LOW" });
    expect(h.store).not.toHaveBeenCalled();
    h.free = 5 * 1024 * 1_048_576;
    expect((await put({})).status).toBe(200);
  });

  it("refuses an oversized body by its declared length and by its real length", async () => {
    expect((await put({ length: String(MAX_SEGMENT_BYTES + 1) })).status).toBe(413);
    const big = new Uint8Array(MAX_SEGMENT_BYTES + 1);
    big.set(WEBM);
    expect((await put({ body: big })).status).toBe(413);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("refuses a segment for an attempt that never passed the system check", async () => {
    h.attempt = { ...h.attempt, deviceCheckedAt: null, startedAt: null };
    expect((await put()).status).toBe(400);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("still takes the last segments shortly after the finish, and closes the door after the grace period", async () => {
    h.attempt = { ...h.attempt, completedAt: new Date(NOW - 60_000) };
    expect((await put()).status).toBe(200);
    h.attempt = { ...h.attempt, completedAt: new Date(NOW - UPLOAD_GRACE_MS - 60_000) };
    const res = await put();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "ALREADY_COMPLETED" });
    expect(h.store).toHaveBeenCalledTimes(1);
  });
});
