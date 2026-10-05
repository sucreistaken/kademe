import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  hctx: { assessment: { id: "a", orgId: "o", solution: "HIRING" }, locale: "tr", hiring: { versionId: "v" } },
  submitStage: vi.fn<(h: unknown, position: unknown) => Promise<{ ok: true } | { ok: false; code: string; missing?: string[] }>>(),
  loadHiringState: vi.fn(async () => ({ step: "STAGE", position: 2, path: "/stage/2", internalQuestion: "TEAMSECRET" })),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/solutions/hiring/server/candidate", () => ({ submitStage: h.submitStage, loadHiringState: h.loadHiringState, loadHiringContext: vi.fn() }));
// The real candidate API would load the registry (and with it every module); the route needs four helpers.
vi.mock("@/lib/candidate-api", () => ({
  readJson: async (req: Request) => req.json(),
  message: (_locale: string, code: string) => (code === "REQUIRED_MISSING" ? "Zorunlu soruları cevaplamadan aşamayı gönderemezsin." : code),
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

describe("POST /hiring/stage/submit", () => {
  it("answers missing required answers with 422 and their ids, in the candidate's language", async () => {
    h.submitStage.mockResolvedValueOnce({ ok: false, code: "REQUIRED_MISSING", missing: ["a1"] });
    const res = await post({ stagePosition: 1 });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "REQUIRED_MISSING", message: "Zorunlu soruları cevaplamadan aşamayı gönderemezsin.", missing: ["a1"] });
  });

  it("answers a stale tab with 409", async () => {
    h.submitStage.mockResolvedValueOnce({ ok: false, code: "STAGE_MISMATCH" });
    expect((await post({ stagePosition: 1 })).status).toBe(409);
  });

  it("returns the next state through candidateJson (an internal field never survives)", async () => {
    h.submitStage.mockResolvedValueOnce({ ok: true });
    const res = await post({ stagePosition: 1 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ step: "STAGE", position: 2, path: "/stage/2" });
    expect(h.submitStage).toHaveBeenCalledWith(h.hctx, 1);
  });

  it.each([[null], [5], ["1"], [{ stagePosition: "1" }], [{}]])("refuses a malformed body (%j) with 400 before anything is written", async (body) => {
    h.submitStage.mockClear();
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "REQUEST_INVALID" });
    expect(h.submitStage).not.toHaveBeenCalled();
  });
});
