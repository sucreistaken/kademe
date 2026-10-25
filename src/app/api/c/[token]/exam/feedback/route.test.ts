import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  resolve: null as unknown,
  saved: [] as Array<{ ctx: unknown; input: unknown }>,
  outcome: "SAVED" as "SAVED" | "ALREADY_ANSWERED" | "NOT_FINISHED",
}));

// The token and the exam tables are not under test here: a fixed answer for the token, the exam's own context read as itself.
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));
vi.mock("@/lib/candidate-context", () => ({
  resolveToken: async () => h.resolve,
  recordFirstSeen: async () => undefined,
}));
vi.mock("@/lib/exam-flow", () => ({
  loadExamContext: async (ctx: { assessment: { solution: string } }) => (ctx.assessment.solution === "LANGUAGE_EXAM" ? ctx : null),
}));
vi.mock("@/server/exam-feedback", () => ({
  saveExamFeedback: async (ctx: unknown, input: unknown) => {
    h.saved.push({ ctx, input });
    return h.outcome;
  },
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

type Link = "COMPLETED" | "EXPIRED" | null;
function context(solution: "LANGUAGE_EXAM" | "HIRING", locale = "en") {
  return {
    link: { id: "l1", status: "COMPLETED", expiresAt: new Date("2026-12-01T00:00:00Z"), notBefore: null, firstSeenIp: "1.1.1.1" },
    assessment: { id: "a1", orgId: "o1", solution },
    candidate: { id: "c1", fullName: "Ada Lovelace", email: null, phone: null, location: null },
    orgName: "Org",
    locale,
    contactEmail: null,
    contactName: null,
    mediaRetentionDays: 180,
    evidenceRetentionDays: 90,
  };
}
const resolved = (link: Link, solution: "LANGUAGE_EXAM" | "HIRING" = "LANGUAGE_EXAM", locale = "en") =>
  link ? { ok: false, problem: link, ctx: context(solution, locale) } : { ok: true, ctx: context(solution, locale) };

// One token per call: the route's rate limit is per IP, token and path.
let n = 0;
async function post(body: unknown, opts: { raw?: string; token?: string } = {}) {
  const token = opts.token ?? `feedback-route-token-${++n}-${"x".repeat(20)}`;
  const res = await POST(
    new NextRequest(`http://localhost/api/c/${token}/exam/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
      body: opts.raw ?? JSON.stringify(body),
    }),
    { params: Promise.resolve({ token }) },
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  h.saved = [];
  h.outcome = "SAVED";
  h.resolve = resolved("COMPLETED");
});

describe("POST /api/c/[token]/exam/feedback", () => {
  it("stores a valid answer from a finished link, in the invitation's organisation and language", async () => {
    h.resolve = resolved("COMPLETED", "LANGUAGE_EXAM", "de");
    const res = await post({ overall: 4, clarity: 5, usability: 3, technicalProblem: true, comment: " Der Ton war leise. " });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, alreadyAnswered: false });
    expect(h.saved).toEqual([
      {
        ctx: { assessmentId: "a1", orgId: "o1", locale: "de" },
        input: { overall: 4, clarity: 5, usability: 3, technicalProblem: true, comment: "Der Ton war leise." },
      },
    ]);
  });

  it("takes the rating alone", async () => {
    const res = await post({ overall: 1 });
    expect(res.status).toBe(200);
    expect(h.saved[0].input).toEqual({ overall: 1, clarity: null, usability: null, technicalProblem: null, comment: null });
  });

  it("answers a second send the same way, flagged, so a double click or a second tab ends on the thank-you", async () => {
    h.outcome = "ALREADY_ANSWERED";
    const res = await post({ overall: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, alreadyAnswered: true });
  });

  it("never lets the body name the invitation or the organisation", async () => {
    await post({ overall: 3, assessmentId: "somebody-else", orgId: "another-org" });
    expect(h.saved[0].ctx).toEqual({ assessmentId: "a1", orgId: "o1", locale: "en" });
    expect(JSON.stringify(h.saved[0].input)).not.toContain("somebody-else");
  });

  it("refuses a missing or out-of-range rating with the translated survey message", async () => {
    h.resolve = resolved("COMPLETED", "LANGUAGE_EXAM", "de");
    for (const body of [{}, { overall: 0 }, { overall: 6 }, { overall: "5" }, { overall: 3, usability: 9 }]) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toBe("SURVEY_INVALID");
      expect(res.body.message).not.toBe("SURVEY_INVALID");
    }
    expect(h.saved).toEqual([]);
  });

  it("refuses a malformed body, a flag of the wrong kind and a comment over 1000 characters", async () => {
    const cases: Array<{ body?: unknown; raw?: string }> = [
      { raw: "not json" },
      { raw: "" },
      { body: [] },
      { body: "text" },
      { body: { overall: 3, technicalProblem: "yes" } },
      { body: { overall: 3, comment: 12 } },
      { body: { overall: 3, comment: "y".repeat(1001) } },
    ];
    for (const c of cases) {
      const res = await post(c.body, { raw: c.raw });
      expect(res.status, JSON.stringify(c)).toBe(400);
      expect(res.body.error).toBe("REQUEST_INVALID");
    }
    expect(h.saved).toEqual([]);
  });

  it("tells a student whose exam is not over (or was ended) that the survey opens at the end", async () => {
    h.outcome = "NOT_FINISHED";
    h.resolve = resolved(null);
    const res = await post({ overall: 4 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("NOT_FINISHED");
  });

  it("is turned away like any other endpoint on an expired link and for another solution's invitation", async () => {
    h.resolve = resolved("EXPIRED");
    expect((await post({ overall: 4 })).status).toBe(410);
    h.resolve = resolved("COMPLETED", "HIRING");
    const other = await post({ overall: 4 });
    expect(other.status).toBe(404);
    expect(other.body.error).toBe("INVALID");
    h.resolve = { ok: false, problem: "INVALID" };
    expect((await post({ overall: 4 })).status).toBe(404);
    expect(h.saved).toEqual([]);
  });

  it("is rate limited per link (10 a minute)", async () => {
    const token = `feedback-route-limited-${"z".repeat(30)}`;
    h.outcome = "ALREADY_ANSWERED";
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await post({ overall: 3 }, { token })).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});
