import { beforeEach, describe, expect, it, vi } from "vitest";

// A solution the platform will not serve must be turned away before anything
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

/**
 * A stubbed registry: which solutions have a module and which of those serve
 * candidates. The real registry's rule is tested in registry.test.ts; here the
 * question is only whether the candidate API follows it.
 */
type Stub = { registered: boolean; live: boolean };
const registry: Record<string, Stub> = {};
vi.mock("@/solutions/registry.server", () => {
  const find = (kind: string) =>
    registry[kind]?.registered ? { key: kind.toLowerCase(), dbKind: kind, candidateFlowLive: registry[kind].live } : null;
  return {
    solutionModule: find,
    candidateSolution: (kind: string) => {
      const m = find(kind);
      return m && m.candidateFlowLive ? m : null;
    },
  };
});

import { NextRequest } from "next/server";
import { withCandidate, withSolution, type SolutionHandler } from "@/lib/candidate-api";
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

beforeEach(() => {
  for (const key of Object.keys(registry)) delete registry[key];
  registry.LANGUAGE_EXAM = { registered: true, live: true };
  resolveToken.mockReset();
  recordFirstSeen.mockReset();
});

describe("withCandidate without acceptSolution", () => {
  const links: Array<[string, LinkProblem | null, Partial<CandidateContext["link"]>]> = [
    ["open", null, {}],
    ["EXPIRED", "EXPIRED", { status: "EXPIRED" }],
  ];

  async function expectUnknown(problem: LinkProblem | null, link: Partial<CandidateContext["link"]>) {
    resolveToken.mockResolvedValueOnce({ ok: false, problem: "INVALID" });
    const unknown = await call("unknown-token-of-sufficient-length");
    const hiring = { ...ctx("HIRING"), link: { ...ctx("HIRING").link, ...link } };
    resolveToken.mockResolvedValueOnce(problem ? { ok: false, problem, ctx: hiring } : { ok: true, ctx: hiring });
    const other = await call("hiring-token-of-sufficient-length");
    expect(await snapshot(other.res)).toEqual(await snapshot(unknown.res));
    expect(other.res.status).toBe(404);
    expect(other.handler).not.toHaveBeenCalled();
    expect(recordFirstSeen).not.toHaveBeenCalled();
  }

  it.each(links)("answers a %s HIRING link with no module like an unknown token", async (_name, problem, link) => {
    await expectUnknown(problem, link);
  });

  it.each(links)("answers a %s HIRING link whose module is registered but not live like an unknown token", async (_name, problem, link) => {
    registry.HIRING = { registered: true, live: false };
    await expectUnknown(problem, link);
  });

  it("lets a HIRING invitation through once its candidate flow is live (plan 2 flips the flag)", async () => {
    registry.HIRING = { registered: true, live: true };
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const { res, handler } = await call("hiring-token-of-sufficient-length");
    expect(await res.text()).toBe("handled");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("still tolerates link problems for a live solution when allowProblems says so", async () => {
    const exam = { ...ctx("LANGUAGE_EXAM"), link: { ...ctx("LANGUAGE_EXAM").link, status: "EXPIRED" as const } };
    resolveToken.mockResolvedValueOnce({ ok: false, problem: "EXPIRED", ctx: exam });
    const { res, handler } = await call("exam-token-of-sufficient-length", { allowProblems: ["EXPIRED"] });
    expect(await res.text()).toBe("handled");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("lets a LANGUAGE_EXAM invitation reach the handler", async () => {
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("LANGUAGE_EXAM") });
    const { res, handler } = await call("exam-token-of-sufficient-length");
    expect(await res.text()).toBe("handled");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(recordFirstSeen).toHaveBeenCalledTimes(1);
  });
});

describe("withSolution", () => {
  async function solutionCall(token: string) {
    const req = new NextRequest(`http://localhost/api/c/${token}/state`, { method: "GET" });
    const handler = vi.fn<SolutionHandler>(async () => new Response("handled"));
    const res = await withSolution(req, Promise.resolve({ token }), handler);
    return { res, handler };
  }

  it("hands the live module to the handler", async () => {
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("LANGUAGE_EXAM") });
    const { handler } = await solutionCall("exam-token-of-sufficient-length");
    expect(handler.mock.calls[0][2]).toMatchObject({ dbKind: "LANGUAGE_EXAM" });
  });

  it("answers a registered but not live solution like an unknown token", async () => {
    registry.HIRING = { registered: true, live: false };
    resolveToken.mockResolvedValueOnce({ ok: true, ctx: ctx("HIRING") });
    const { res, handler } = await solutionCall("hiring-token-of-sufficient-length");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("INVALID");
    expect(handler).not.toHaveBeenCalled();
  });
});
