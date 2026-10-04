import { describe, expect, it, vi } from "vitest";

// A solution without a registered module must be turned away before anything
// touches the database.
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
import { withCandidate } from "@/lib/candidate-api";
import type { CandidateContext, LinkProblem } from "@/lib/candidate-context";

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

async function call(token: string, options: Parameters<typeof withCandidate>[3] = {}) {
  const req = new NextRequest(`http://localhost/api/c/${token}/consent`, { method: "GET" });
  const handler = vi.fn(async () => new Response("handled"));
  const res = await withCandidate(req, Promise.resolve({ token }), handler, options);
  return { res, handler };
}

async function snapshot(res: Response) {
  return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
}

describe("withCandidate without acceptSolution", () => {
  const links: Array<[string, LinkProblem | null, Partial<CandidateContext["link"]>]> = [
    ["open", null, {}],
    ["EXPIRED", "EXPIRED", { status: "EXPIRED" }],
  ];

  it.each(links)("answers a %s HIRING link (no module) like an unknown token", async (_name, problem, link) => {
    recordFirstSeen.mockClear();
    resolveToken.mockResolvedValueOnce({ ok: false, problem: "INVALID" });
    const unknown = await call("unknown-token-of-sufficient-length");

    const hiring = { ...ctx("HIRING"), link: { ...ctx("HIRING").link, ...link } };
    resolveToken.mockResolvedValueOnce(problem ? { ok: false, problem, ctx: hiring } : { ok: true, ctx: hiring });
    const other = await call("hiring-token-of-sufficient-length");

    expect(await snapshot(other.res)).toEqual(await snapshot(unknown.res));
    expect(other.res.status).toBe(404);
    expect(other.handler).not.toHaveBeenCalled();
    expect(recordFirstSeen).not.toHaveBeenCalled();
  });

  it("still tolerates link problems for a registered solution when allowProblems says so", async () => {
    const exam = { ...ctx("LANGUAGE_EXAM"), link: { ...ctx("LANGUAGE_EXAM").link, status: "EXPIRED" as const } };
    resolveToken.mockResolvedValueOnce({ ok: false, problem: "EXPIRED", ctx: exam });
    const { res, handler } = await call("exam-token-of-sufficient-length", { allowProblems: ["EXPIRED"] });
    expect(await res.text()).toBe("handled");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("lets a LANGUAGE_EXAM invitation reach the handler", async () => {
    recordFirstSeen.mockClear();
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("LANGUAGE_EXAM") });
    const { res, handler } = await call("exam-token-of-sufficient-length");
    expect(await res.text()).toBe("handled");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(recordFirstSeen).toHaveBeenCalledTimes(1);
  });
});
