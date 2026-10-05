import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaAssetRow, SolutionModule } from "@/solutions/types";

type Hook = (asset: MediaAssetRow) => Promise<void>;

const h = vi.hoisted(() => ({
  asset: null as Record<string, unknown> | null,
  solution: null as unknown,
  failMedia: vi.fn<(id: string) => Promise<void>>(async () => undefined),
}));

vi.mock("@/lib/candidate-api", () => ({
  readJson: async (req: Request) => req.json(),
  badRequest: (_ctx: unknown, code: string) => Response.json({ error: code }, { status: 400 }),
  conflict: (_ctx: unknown, code: string) => Response.json({ error: code }, { status: 409 }),
  withSolution: (req: Request, _params: unknown, handler: (r: Request, ctx: unknown, s: unknown) => Promise<Response>) => handler(req, { locale: "tr" }, h.solution),
}));
vi.mock("@/lib/candidate-media", () => ({
  resolveOwnedMedia: async () => (h.asset ? { asset: h.asset } : null),
  failMedia: h.failMedia,
  completeMedia: async (asset: Record<string, unknown>, parts: unknown[], durationMs: number | null, status: string) => ({ ...asset, parts, durationMs, status, bytes: 100 }),
}));
vi.mock("@/lib/queue", () => ({ enqueueTranscription: async () => true }));
vi.mock("@/lib/transcription", () => ({ isTranscribableMime: () => true }));

import { NextRequest } from "next/server";
import { POST } from "./route";

const call = () =>
  POST(new NextRequest("http://localhost/api/c/t/media/complete", { method: "POST", body: JSON.stringify({ uploadRef: "m2" }) }), { params: Promise.resolve({ token: "t".repeat(43) }) });

beforeEach(() => {
  h.asset = { id: "m2", attemptId: "att", status: "UPLOADING", parts: [], mime: "video/webm" };
  h.failMedia.mockClear();
});

describe("POST /media/complete with no parts", () => {
  it("fails the asset and lets the solution decide that answer again (hiring: an older take returns)", async () => {
    const onMediaFailed = vi.fn<Hook>(async () => undefined);
    const onMediaComplete = vi.fn<Hook>(async () => undefined);
    h.solution = { attempts: { onMediaComplete, onMediaFailed } } as unknown as SolutionModule;
    const res = await call();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "NO_PARTS" });
    expect(h.failMedia).toHaveBeenCalledWith("m2");
    expect(onMediaFailed).toHaveBeenCalledTimes(1);
    expect(onMediaFailed.mock.calls[0][0]).toMatchObject({ id: "m2", status: "FAILED" });
    expect(onMediaComplete).not.toHaveBeenCalled();
  });

  it("answers the same for a solution without the hook (the exam)", async () => {
    const onMediaComplete = vi.fn<Hook>(async () => undefined);
    h.solution = { attempts: { onMediaComplete } } as unknown as SolutionModule;
    const res = await call();
    expect(res.status).toBe(409);
    expect(onMediaComplete).not.toHaveBeenCalled();
  });
});

describe("POST /media/complete when the solution's hook throws", () => {
  it("still answers NO_PARTS (409) when onMediaFailed throws, and logs it", async () => {
    const onMediaFailed = vi.fn<Hook>(async () => {
      throw new Error("db down");
    });
    h.solution = { attempts: { onMediaComplete: vi.fn<Hook>(), onMediaFailed } } as unknown as SolutionModule;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await call();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "NO_PARTS" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("still answers the finished upload when onMediaComplete throws, and logs it", async () => {
    h.asset = { id: "m2", attemptId: "att", status: "UPLOADING", parts: [{ partNumber: 1, etag: "e", bytes: 100 }], mime: "video/webm", uploadId: "u" };
    const onMediaComplete = vi.fn<Hook>(async () => {
      throw new Error("db down");
    });
    h.solution = { attempts: { onMediaComplete } } as unknown as SolutionModule;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "READY", bytes: 100, durationMs: null });
    expect(onMediaComplete).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
