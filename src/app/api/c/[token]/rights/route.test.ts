import { beforeEach, describe, expect, it, vi } from "vitest";

type Inserted = { table: string; values: Record<string, unknown> };

const h = vi.hoisted(() => ({
  inserted: [] as Inserted[],
  /** fileCandidateRequest's answer: false when a request of that kind is already open (dedup, Task 3 carry). */
  filed: true,
  ctx: { assessment: { id: "a1", orgId: "o1", solution: "HIRING" }, candidate: { id: "c1" }, locale: "tr" },
}));

vi.mock("@/db", async () => {
  const { getTableName } = await import("drizzle-orm");
  return {
    db: {
      insert: (table: never) => ({ values: async (values: Record<string, unknown>) => void h.inserted.push({ table: getTableName(table), values }) }),
    },
  };
});
vi.mock("@/server/candidate-requests", () => ({
  // The dedup lives in fileCandidateRequest (its own test); a filed request is recorded like an insert.
  fileCandidateRequest: async (values: Record<string, unknown>) => {
    if (h.filed) h.inserted.push({ table: "candidate_requests", values });
    return { filed: h.filed };
  },
}));
vi.mock("@/lib/candidate-api", () => ({
  withCandidate: (req: unknown, _p: unknown, handler: (r: unknown, c: unknown) => unknown) => handler(req, h.ctx),
  badRequest: (_ctx: unknown, code: string) => new Response(JSON.stringify({ error: code }), { status: 400 }),
  message: () => "ok",
  // As the real readJson: an unparsable body reads as null.
  readJson: async (req: Request) => req.json().catch(() => null),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const params = Promise.resolve({ token: "t".repeat(43) });
const send = (body: unknown) => POST(new NextRequest("http://localhost/api/c/x/rights", { method: "POST", body: JSON.stringify(body) }), { params });

beforeEach(() => {
  h.inserted = [];
  h.filed = true;
  h.ctx.assessment.solution = "HIRING";
});

describe("rights route", () => {
  it("files an accommodation request in the invitation's organisation for a solution that reads them", async () => {
    const res = await send({ kind: "ACCOMMODATION", message: "Video yerine yazılı cevap" });
    expect(res.status).toBe(200);
    expect(h.inserted).toEqual([
      { table: "candidate_requests", values: { orgId: "o1", assessmentId: "a1", kind: "ACCOMMODATION", message: "Video yerine yazılı cevap" } },
    ]);
  });

  it("answers the same to a second accommodation request while the first is open, filing nothing new", async () => {
    h.filed = false;
    const res = await send({ kind: "ACCOMMODATION", message: "Tekrar" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true });
    expect(h.inserted).toEqual([]);
  });

  it("stores an empty accommodation note as null", async () => {
    expect((await send({ kind: "ACCOMMODATION" })).status).toBe(200);
    expect(h.inserted[0].values.message).toBeNull();
  });

  it("refuses an accommodation note longer than the 2000 the table allows, writing nothing", async () => {
    const res = await send({ kind: "ACCOMMODATION", message: "a".repeat(2001) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "MESSAGE_TOO_LONG" });
    expect(h.inserted).toEqual([]);
    expect((await send({ kind: "ACCOMMODATION", message: "a".repeat(2000) })).status).toBe(200);
  });

  it("refuses an accommodation request where the solution does not read them", async () => {
    h.ctx.assessment.solution = "LANGUAGE_EXAM";
    const res = await send({ kind: "ACCOMMODATION" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "KIND_REQUIRED" });
    expect(h.inserted).toEqual([]);
  });

  it("refuses a missing or unknown kind as KIND_REQUIRED", async () => {
    for (const body of [{}, { kind: "NEW_LINK" }, { kind: "ERASE" }, { message: "x" }]) {
      const res = await send(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "KIND_REQUIRED" });
    }
    expect(h.inserted).toEqual([]);
  });

  it("refuses a malformed body as REQUEST_INVALID, not as a missing kind", async () => {
    for (const body of [null, [], "ACCESS", 7, { kind: 3 }, { kind: "ACCESS", message: 5 }, { kind: "ACCESS", message: { text: "x" } }]) {
      const res = await send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toEqual({ error: "REQUEST_INVALID" });
    }
    const unparsable = await POST(new NextRequest("http://localhost/api/c/x/rights", { method: "POST", body: "{not json" }), { params });
    expect(await unparsable.json()).toEqual({ error: "REQUEST_INVALID" });
    expect(h.inserted).toEqual([]);
  });

  it.each(["LANGUAGE_EXAM", "HIRING"])("still files the three data rights requests where they always went (%s)", async (solution) => {
    h.ctx.assessment.solution = solution;
    for (const kind of ["ACCESS", "COPY", "DELETE"]) expect((await send({ kind, message: kind === "COPY" ? "x".repeat(2500) : "" })).status).toBe(200);
    expect(h.inserted).toEqual([
      { table: "deletion_requests", values: { candidateId: "c1", kind: "ACCESS", message: null } },
      // Data rights keep today's behaviour: a long note is cut, not refused.
      { table: "deletion_requests", values: { candidateId: "c1", kind: "COPY", message: "x".repeat(2000) } },
      { table: "deletion_requests", values: { candidateId: "c1", kind: "DELETE", message: null } },
    ]);
  });
});
