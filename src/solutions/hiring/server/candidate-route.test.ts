import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LinkProblem } from "@/lib/candidate-context";
import type { HiringHandler } from "./candidate-route";

const h = vi.hoisted(() => ({
  live: false,
  resolveToken: vi.fn<(token: string) => Promise<unknown>>(),
  recordFirstSeen: vi.fn<(ctx: unknown, ip: string | null, ua: string | null) => Promise<void>>(async () => undefined),
  loadHiringContext: vi.fn<(ctx: unknown) => Promise<unknown>>(),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/candidate-context", () => ({ resolveToken: h.resolveToken, recordFirstSeen: h.recordFirstSeen }));
vi.mock("@/solutions/registry.server", () => ({ servingSolution: async () => null, candidateSolution: () => null }));
vi.mock("../manifest", () => ({ hiringManifest: { get candidateFlowLive() { return h.live; } } }));
vi.mock("./candidate", () => ({ loadHiringContext: h.loadHiringContext }));

import { NextRequest } from "next/server";
import { statusOf, withHiringCandidate } from "./candidate-route";

const ctx = (solution: "HIRING" | "LANGUAGE_EXAM") => ({
  link: { id: "l", status: "NOT_STARTED", expiresAt: new Date(), notBefore: null, firstSeenIp: null },
  assessment: { id: "a", orgId: "o", solution },
  candidate: { id: "c", fullName: null, email: null, phone: null, location: null },
  orgName: "Org",
  locale: "tr",
  contactEmail: null,
  contactName: null,
  mediaRetentionDays: 180,
  evidenceRetentionDays: 90,
});
const hiringTerms = { openingId: "op", versionId: "v", extraTimePct: 0, consentTextId: "ct" };

async function call(resolved: unknown, options: { allowProblems?: LinkProblem[] } = {}) {
  h.resolveToken.mockResolvedValueOnce(resolved);
  const handler = vi.fn<HiringHandler>(async () => new Response("handled"));
  const res = await withHiringCandidate(
    new NextRequest("http://localhost/api/c/t/hiring/stage/start", { method: "POST" }),
    Promise.resolve({ token: "t".repeat(43) }),
    handler,
    options,
  );
  return { res, handler, body: res.status === 404 ? await res.json() : null };
}

beforeEach(() => {
  h.live = false;
  h.resolveToken.mockReset();
  h.recordFirstSeen.mockClear();
  h.loadHiringContext.mockReset();
});

describe("withHiringCandidate", () => {
  it("answers everything like an unknown token while the flow is not live", async () => {
    const unknown = await call({ ok: false, problem: "INVALID" });
    const hiring = await call({ ok: true, ctx: ctx("HIRING") });
    expect(hiring.res.status).toBe(404);
    expect(hiring.body).toEqual(unknown.body);
    expect(hiring.handler).not.toHaveBeenCalled();
    // Not live: not a single hiring table is read.
    expect(h.loadHiringContext).not.toHaveBeenCalled();
    expect(h.recordFirstSeen).not.toHaveBeenCalled();
  });

  it("answers an exam invitation like an unknown token once live", async () => {
    h.live = true;
    const exam = await call({ ok: true, ctx: ctx("LANGUAGE_EXAM") });
    expect(exam.res.status).toBe(404);
    expect(exam.body?.error).toBe("INVALID");
    expect(h.loadHiringContext).not.toHaveBeenCalled();
  });

  it("answers a HIRING invitation without hiring terms like an unknown token", async () => {
    h.live = true;
    h.loadHiringContext.mockResolvedValueOnce(null);
    const res = await call({ ok: true, ctx: ctx("HIRING") });
    expect(res.res.status).toBe(404);
    expect(res.handler).not.toHaveBeenCalled();
    expect(h.recordFirstSeen).not.toHaveBeenCalled();
  });

  it.each<LinkProblem>(["EXPIRED", "NOT_YET", "COMPLETED"])(
    "answers a HIRING invitation without hiring terms on a %s link exactly like an unknown token, before the link's problem (C6)",
    async (problem) => {
      h.live = true;
      const unknown = await call({ ok: false, problem: "INVALID" });
      h.loadHiringContext.mockResolvedValueOnce(null);
      // Even where the endpoint tolerates the problem (the survey tolerates COMPLETED).
      const res = await call({ ok: false, problem, ctx: ctx("HIRING") }, { allowProblems: [problem] });
      expect(res.res.status).toBe(404);
      expect(res.body).toEqual(unknown.body);
      expect(res.handler).not.toHaveBeenCalled();
      expect(h.recordFirstSeen).not.toHaveBeenCalled();
    },
  );

  it("names the link's problem only for an invitation hiring serves (the positive control of C6)", async () => {
    h.live = true;
    h.loadHiringContext.mockResolvedValueOnce({ ...ctx("HIRING"), hiring: hiringTerms });
    const res = await call({ ok: false, problem: "EXPIRED", ctx: ctx("HIRING") });
    expect(res.res.status).toBe(410);
    expect(res.handler).not.toHaveBeenCalled();
  });

  it("hands the hiring context to the handler, read once per request", async () => {
    h.live = true;
    h.loadHiringContext.mockResolvedValueOnce({ ...ctx("HIRING"), hiring: hiringTerms });
    const res = await call({ ok: true, ctx: ctx("HIRING") });
    expect(await res.res.text()).toBe("handled");
    expect(res.handler.mock.calls[0][1]).toMatchObject({ hiring: { versionId: "v" } });
    expect(h.loadHiringContext).toHaveBeenCalledTimes(1);
    expect(h.recordFirstSeen).toHaveBeenCalledTimes(1);
  });
});

describe("statusOf", () => {
  it("answers bad input 400, missing required answers 422 and every other refusal 409", () => {
    for (const code of ["EXTRA_TIME_INVALID", "FILE_TYPE_REJECTED", "FILE_TOO_LARGE", "FILE_EMPTY", "NOT_A_FILE", "NOT_A_RECORDING", "SURVEY_INVALID", "UPLOAD_NOT_FOUND", "RECORDING_TYPE_REJECTED", "RECORDING_TOO_LARGE", "REQUEST_INVALID"]) {
      expect(statusOf(code), code).toBe(400);
    }
    expect(statusOf("REQUIRED_MISSING")).toBe(422);
    for (const code of ["STAGE_MISMATCH", "STAGE_EXPIRED", "ACTIVITY_CLOSED", "TAKES_EXHAUSTED", "MEDIA_NOT_READY", "OPENING_CLOSED", "ALREADY_ANSWERED"]) {
      expect(statusOf(code), code).toBe(409);
    }
  });
});
