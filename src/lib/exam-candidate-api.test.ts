import { describe, expect, it, vi } from "vitest";

// Any database access in these cases is a bug: a hiring invitation must be
// turned away before the exam tables are read.
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
import { notFoundForSolution } from "@/lib/candidate-api";
import type { CandidateContext, LinkProblem } from "@/lib/candidate-context";
import { withExamCandidate } from "@/lib/exam-candidate-api";
import { loadExamContext } from "@/lib/exam-flow";

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

function request(token: string, acceptLanguage?: string) {
  return new NextRequest(`http://localhost/api/c/${token}/exam/answer`, {
    method: "PUT",
    headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
  });
}

async function snapshot(res: Response) {
  return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
}

async function call(token: string, acceptLanguage: string | undefined) {
  const handler = vi.fn(async () => new Response("handled"));
  const res = await withExamCandidate(request(token, acceptLanguage), Promise.resolve({ token }), handler);
  return { res, handler };
}

describe("exam endpoints and other solutions", () => {
  it("do not read a hiring invitation as an exam", async () => {
    expect(await loadExamContext(ctx("HIRING"))).toBeNull();
  });

  it("answer a solution mismatch exactly like an unknown token", async () => {
    const res = notFoundForSolution(request("any-token-of-sufficient-length", "en"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, string>;
    expect(Object.keys(body).sort()).toEqual(["error", "message"]);
    expect(body.error).toBe("INVALID");
  });

  describe("a hiring invitation is answered exactly like an unknown token", () => {
    const links: Array<[string, LinkProblem | null, Partial<CandidateContext["link"]>]> = [
      ["open", null, {}],
      ["EXPIRED status", "EXPIRED", { status: "EXPIRED" }],
      ["COMPLETED status", "COMPLETED", { status: "COMPLETED" }],
      ["not yet open", "NOT_YET", { notBefore: new Date(Date.now() + 86_400_000) }],
      ["past expiry while NOT_STARTED", "EXPIRED", { expiresAt: new Date(Date.now() - 1000) }],
    ];

    it.each(links)("%s", async (name, problem, link) => {
      for (const lang of [undefined, "en", "tr"]) {
        recordFirstSeen.mockClear();

        resolveToken.mockResolvedValueOnce({ ok: false, problem: "INVALID" });
        const unknown = await call(`unknown-token-${name.replace(/\W/g, "")}-${lang}`, lang);

        const hiring = { ...ctx("HIRING"), link: { ...ctx("HIRING").link, ...link } };
        resolveToken.mockResolvedValueOnce(
          problem ? { ok: false, problem, ctx: hiring } : { ok: true, ctx: hiring },
        );
        const other = await call(`hiring-token-${name.replace(/\W/g, "")}-${lang}`, lang);

        expect(await snapshot(other.res)).toEqual(await snapshot(unknown.res));
        expect(other.handler).not.toHaveBeenCalled();
        expect(recordFirstSeen).not.toHaveBeenCalled();
      }
    });

    it("uses the browser language, not the invitation's own", async () => {
      resolveToken.mockResolvedValueOnce({ ok: true, ctx: { ...ctx("HIRING"), locale: "tr" } });
      const en = await snapshot((await call("hiring-token-lang-en", "en")).res);
      resolveToken.mockResolvedValueOnce({ ok: true, ctx: { ...ctx("HIRING"), locale: "tr" } });
      const tr = await snapshot((await call("hiring-token-lang-tr", "tr")).res);
      expect(en.body.message).not.toBe(tr.body.message);
    });
  });
});
