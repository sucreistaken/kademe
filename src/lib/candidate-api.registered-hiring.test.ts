import { beforeEach, describe, expect, it, vi } from "vitest";

// The REAL registry, with hiring registered: unlike candidate-api.test.ts
// (stubbed registry) this proves the shipped manifest keeps hiring invisible
// to candidates (spec 6 leak rule) until plan 2 flips candidateFlowLive.
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));

const resolveToken = vi.fn();
const recordFirstSeen = vi.fn();
vi.mock("@/lib/candidate-context", () => ({
  resolveToken: (...args: unknown[]) => resolveToken(...args),
  recordFirstSeen: (...args: unknown[]) => recordFirstSeen(...args),
}));

import { NextRequest } from "next/server";
import { withCandidate, withSolution } from "@/lib/candidate-api";
import type { CandidateContext } from "@/lib/candidate-context";
import { solutionModule } from "@/solutions/registry.server";

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

beforeEach(() => {
  resolveToken.mockReset();
  recordFirstSeen.mockReset();
});

describe("hiring registered in the real registry", () => {
  it("is registered, so the guard below is not vacuous", () => {
    expect(solutionModule("HIRING")?.key).toBe("hiring");
  });

  it("withCandidate answers a HIRING token exactly like an unknown token", async () => {
    resolveToken.mockResolvedValueOnce({ ok: false, problem: "INVALID" });
    const handlerUnknown = vi.fn(async () => new Response("handled"));
    const unknown = await withCandidate(
      new NextRequest("http://localhost/api/c/unknown-token-of-sufficient-length/consent"),
      Promise.resolve({ token: "unknown-token-of-sufficient-length" }),
      handlerUnknown,
    );
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const handler = vi.fn(async () => new Response("handled"));
    const hiring = await withCandidate(
      new NextRequest("http://localhost/api/c/hiring-token-of-sufficient-length/consent"),
      Promise.resolve({ token: "hiring-token-of-sufficient-length" }),
      handler,
    );
    expect(hiring.status).toBe(404);
    expect(await snapshot(hiring)).toEqual(await snapshot(unknown));
    expect(handler).not.toHaveBeenCalled();
    expect(recordFirstSeen).not.toHaveBeenCalled();
  });

  it("withSolution answers a HIRING token exactly like an unknown token", async () => {
    resolveToken.mockResolvedValueOnce({ ok: false, problem: "INVALID" });
    const unknown = await withSolution(
      new NextRequest("http://localhost/api/c/unknown-token-of-sufficient-length/state"),
      Promise.resolve({ token: "unknown-token-of-sufficient-length" }),
      vi.fn(async () => new Response("handled")),
    );
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const handler = vi.fn(async () => new Response("handled"));
    const hiring = await withSolution(
      new NextRequest("http://localhost/api/c/hiring-token-of-sufficient-length/state"),
      Promise.resolve({ token: "hiring-token-of-sufficient-length" }),
      handler,
    );
    expect(hiring.status).toBe(404);
    expect(await snapshot(hiring)).toEqual(await snapshot(unknown));
    expect(handler).not.toHaveBeenCalled();
  });
});
