import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  hctx: { assessment: { id: "a", orgId: "o", solution: "HIRING" }, locale: "tr", hiring: { versionId: "v" } },
  saveSurvey: vi.fn<(h: unknown, input: { rating: number; comment?: string }) => Promise<{ ok: true } | { ok: false; code: string }>>(async () => ({ ok: true })),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/solutions/hiring/server/candidate", () => ({ saveSurvey: h.saveSurvey, loadHiringContext: vi.fn() }));
vi.mock("@/lib/candidate-api", () => ({
  readJson: async (req: Request) => req.json().catch(() => null),
  message: (_locale: string, code: string) => code,
  fail: (_ctx: unknown, code: string, status: number) => Response.json({ error: code }, { status }),
  notFoundForSolution: () => Response.json({ error: "INVALID" }, { status: 404 }),
  withCandidate: () => {
    throw new Error("withHiringCandidate is replaced in this test");
  },
}));
vi.mock("@/solutions/hiring/server/candidate-route", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/solutions/hiring/server/candidate-route")>()),
  withHiringCandidate: (req: unknown, _p: unknown, handler: (r: unknown, c: unknown) => unknown) => handler(req, h.hctx),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const post = (body: unknown) => POST(new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ token: "t".repeat(43) }) });

beforeEach(() => h.saveSurvey.mockClear());

describe("POST /hiring/survey", () => {
  it("saves a rating with an optional comment", async () => {
    expect((await post({ rating: 4, comment: "İyiydi" })).status).toBe(200);
    expect(h.saveSurvey).toHaveBeenCalledWith(h.hctx, { rating: 4, comment: "İyiydi" });
    expect((await post({ rating: 5, comment: null })).status).toBe(200);
    expect(h.saveSurvey.mock.calls[1][1]).toEqual({ rating: 5, comment: undefined });
  });

  it.each([[{ rating: 4, comment: 5 }], [{ rating: 4, comment: { text: "x" } }], [{ rating: 4, comment: ["x"] }], [null], ["4"], [[]]])(
    "refuses a malformed body (%j), such as a comment that is not text, with REQUEST_INVALID and saves nothing",
    async (body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "REQUEST_INVALID" });
      expect(h.saveSurvey).not.toHaveBeenCalled();
    },
  );

  it.each([[{}], [{ rating: 0 }], [{ rating: 6 }], [{ rating: 3.5 }], [{ rating: "4" }]])("refuses a rating outside 1-5 (%j) with SURVEY_INVALID", async (body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "SURVEY_INVALID" });
    expect(h.saveSurvey).not.toHaveBeenCalled();
  });
});
