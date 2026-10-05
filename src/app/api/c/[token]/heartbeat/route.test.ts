import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  ctx: { assessment: { id: "a", orgId: "o", solution: "HIRING" }, locale: "tr" },
  heartbeat: vi.fn<(ctx: unknown) => Promise<{ deadlineAt: Date | null }>>(),
  options: null as unknown,
}));

vi.mock("@/lib/candidate-api", () => ({
  withSolution: (req: unknown, _p: unknown, handler: (r: unknown, c: unknown, s: unknown) => unknown, options: unknown) => {
    h.options = options;
    return handler(req, h.ctx, { candidate: { heartbeat: h.heartbeat } });
  },
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const beat = () => POST(new NextRequest("http://localhost/api/c/t/heartbeat", { method: "POST" }), { params: Promise.resolve({ token: "t".repeat(43) }) });

beforeEach(() => h.heartbeat.mockReset());

describe("POST /heartbeat", () => {
  it("asks the serving solution for the beat with the invitation's context and answers the server's clock", async () => {
    const deadlineAt = new Date(Date.now() + 120_000);
    h.heartbeat.mockResolvedValueOnce({ deadlineAt });
    const res = await beat();
    expect(res.status).toBe(200);
    expect(h.heartbeat).toHaveBeenCalledWith(h.ctx);
    const body = await res.json();
    expect(body.deadlineAt).toBe(deadlineAt.toISOString());
    expect(body.remainingMs).toBeGreaterThan(110_000);
    expect(body.remainingMs).toBeLessThanOrEqual(120_000);
    expect(typeof body.serverNow).toBe("string");
    expect(h.options).toMatchObject({ limit: 120 });
  });

  it("answers no deadline and no remaining time when no stage is running", async () => {
    h.heartbeat.mockResolvedValueOnce({ deadlineAt: null });
    expect(await (await beat()).json()).toMatchObject({ deadlineAt: null, remainingMs: null });
  });

  it("never answers a negative remaining time for a deadline already past", async () => {
    h.heartbeat.mockResolvedValueOnce({ deadlineAt: new Date(Date.now() - 5_000) });
    expect((await (await beat()).json()).remainingMs).toBe(0);
  });
});
