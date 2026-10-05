import { beforeEach, describe, expect, it, vi } from "vitest";

// The REAL registry and the real hiring module, with hiring live: a HIRING
// invitation is served only when it has hiring terms (serves); otherwise it is
// answered exactly like an unknown token (spec 6). Nothing touches a database.
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));

const h = vi.hoisted(() => ({
  resolveToken: vi.fn<(token: string) => Promise<unknown>>(),
  recordFirstSeen: vi.fn<(...args: unknown[]) => Promise<void>>(),
  terms: false,
}));
vi.mock("@/lib/candidate-context", () => ({ resolveToken: h.resolveToken, recordFirstSeen: h.recordFirstSeen }));
vi.mock("@/solutions/hiring/server/candidate", () => ({
  loadHiringContext: async () => null,
  hiringServes: async () => h.terms,
  loadHiringState: vi.fn(),
  hiringTitle: vi.fn(),
  stageHeartbeat: vi.fn(),
  runningSegment: vi.fn(),
  attachMedia: vi.fn(),
  closeExpiredStageRuns: vi.fn(),
  salvageHiringUploads: vi.fn(),
}));

import { NextRequest } from "next/server";
import { withCandidate, withSolution, type Handler, type SolutionHandler } from "@/lib/candidate-api";
import type { CandidateContext } from "@/lib/candidate-context";
import { candidateSolution } from "@/solutions/registry.server";

function ctx(solution: CandidateContext["assessment"]["solution"]): CandidateContext {
  return {
    link: { id: "l", status: "NOT_STARTED", expiresAt: new Date(), notBefore: null, firstSeenIp: null },
    assessment: { id: "a", orgId: "o", solution },
    candidate: { id: "c", fullName: null, email: null, phone: null, location: null },
    orgName: "Org",
    locale: "tr",
    contactEmail: null,
    contactName: null,
    mediaRetentionDays: 180,
    evidenceRetentionDays: 90,
  };
}

async function snapshot(res: Response) {
  return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
}

const req = (path: string) => new NextRequest(`http://localhost/api/c/token-of-sufficient-length${path}`);
const params = Promise.resolve({ token: "token-of-sufficient-length" });

beforeEach(() => {
  h.resolveToken.mockReset();
  h.recordFirstSeen.mockReset();
  h.terms = false;
});

describe("hiring live in the real registry", () => {
  it("is registered and live, so the checks below are about serves", () => {
    expect(candidateSolution("HIRING")?.key).toBe("hiring");
  });

  it("answers a HIRING invitation without hiring terms exactly like an unknown token", async () => {
    h.resolveToken.mockResolvedValueOnce({ ok: false, problem: "INVALID" });
    const unknown = await withSolution(req("/state"), params, vi.fn<SolutionHandler>(async () => new Response("handled")));
    h.resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const handler = vi.fn<SolutionHandler>(async () => new Response("handled"));
    const hiring = await withSolution(req("/state"), params, handler);
    expect(hiring.status).toBe(404);
    expect(await snapshot(hiring)).toEqual(await snapshot(unknown));
    expect(handler).not.toHaveBeenCalled();
    expect(h.recordFirstSeen).not.toHaveBeenCalled();
  });

  it("serves a HIRING invitation with hiring terms", async () => {
    h.terms = true;
    h.resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const handler = vi.fn<SolutionHandler>(async () => new Response("handled"));
    expect(await (await withSolution(req("/state"), params, handler)).text()).toBe("handled");
    expect(handler.mock.calls[0][2]).toMatchObject({ dbKind: "HIRING" });
  });

  it("an exam endpoint still answers a HIRING invitation like an unknown token", async () => {
    h.terms = true;
    h.resolveToken.mockResolvedValueOnce({ ok: false, problem: "INVALID" });
    const unknown = await withCandidate(req("/exam/answer"), params, vi.fn<Handler>(async () => new Response("handled")), { acceptSolution: (k) => k === "LANGUAGE_EXAM" });
    h.resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const handler = vi.fn<Handler>(async () => new Response("handled"));
    const hiring = await withCandidate(req("/exam/answer"), params, handler, { acceptSolution: (k) => k === "LANGUAGE_EXAM" });
    expect(await snapshot(hiring)).toEqual(await snapshot(unknown));
    expect(handler).not.toHaveBeenCalled();
  });
});
