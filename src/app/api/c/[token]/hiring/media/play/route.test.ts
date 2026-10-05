import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaybackResult } from "@/solutions/hiring/server/candidate";

const h = vi.hoisted(() => ({
  hctx: { assessment: { id: "a", orgId: "o", solution: "HIRING" }, locale: "en", hiring: { versionId: "v" } },
  playbackUrl: vi.fn<(h: unknown, ref: unknown) => Promise<PlaybackResult>>(),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/solutions/hiring/server/candidate", () => ({ playbackUrl: h.playbackUrl, loadHiringContext: vi.fn() }));
vi.mock("@/lib/candidate-api", () => ({
  readJson: async (req: Request) => req.json(),
  message: (_locale: string, code: string) => code,
  fail: (_ctx: unknown, code: string, status: number) => Response.json({ error: code, message: `${code} copy` }, { status }),
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
import { GET } from "./route";

const get = (query: string) => GET(new NextRequest(`http://localhost/api/c/t/hiring/media/play${query}`), { params: Promise.resolve({ token: "t".repeat(43) }) });

beforeEach(() => {
  h.playbackUrl.mockReset();
});

describe("GET /hiring/media/play", () => {
  it("answers the candidate's own finished take with a short-lived src", async () => {
    h.playbackUrl.mockResolvedValueOnce({ ok: true, url: "/signed/x?s=600" });
    const res = await get("?ref=m-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ src: "/signed/x?s=600" });
    expect(h.playbackUrl.mock.calls[0]).toEqual([h.hctx, "m-1"]);
  });

  it("answers a take that is not the candidate's (or no ref at all) with 400 UPLOAD_NOT_FOUND", async () => {
    h.playbackUrl.mockResolvedValue({ ok: false, code: "UPLOAD_NOT_FOUND" });
    const res = await get("?ref=someone-else");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "UPLOAD_NOT_FOUND", message: "UPLOAD_NOT_FOUND copy" });
    expect((await get("")).status).toBe(400);
    expect(h.playbackUrl.mock.calls[1][1]).toBeNull();
  });

  it("answers a take still uploading with 409 MEDIA_NOT_READY, so the screen can say it is still saving", async () => {
    h.playbackUrl.mockResolvedValueOnce({ ok: false, code: "MEDIA_NOT_READY" });
    const res = await get("?ref=m-2");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "MEDIA_NOT_READY", message: "MEDIA_NOT_READY copy" });
  });
});
