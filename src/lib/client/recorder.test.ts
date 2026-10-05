import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type PartTarget = { partNumber: number; url: string; proxy: boolean };

const h = vi.hoisted(() => ({
  /** How many part-urls lookups fail before one answers. */
  lookupFailures: 0,
  lookups: 0,
}));

const apiSend = vi.hoisted(() =>
  vi.fn(async (_token: string, path: string, body: { mime?: string; from?: number }): Promise<unknown> => {
    if (path === "/media/part-urls") {
      h.lookups += 1;
      if (h.lookups <= h.lookupFailures) throw new TypeError("Failed to fetch");
      const from = body.from ?? 1;
      const partTargets: PartTarget[] = [];
      for (let n = from; n < from + 24; n += 1) partTargets.push({ partNumber: n, url: `https://bucket.example/part-${n}`, proxy: false });
      return { partTargets };
    }
    if (path === "/media/complete") return { status: "READY", bytes: 1, durationMs: 1 };
    if (path === "/media/part-done") return { ok: true };
    // /media/init: only part 1 is known up front, so part 2 needs a lookup
    // (in production the first batch is 24 parts and part 25 needs one).
    return { uploadRef: "r", mime: body.mime, minPartBytes: 0, proxy: false, partTargets: [{ partNumber: 1, url: "https://bucket.example/part-1", proxy: false }] };
  }),
);
vi.mock("@/lib/client/api", () => ({ apiSend, candidateApiBase: (t: string) => `/api/c/${t}` }));

import { ChunkedUploader } from "./recorder";

const ok = () => ({ ok: true, status: 200, headers: new Headers({ etag: '"e"' }), json: async () => ({}) }) as unknown as Response;
const chunk = (bytes = 10) => new Blob([new Uint8Array(bytes)]);
const callsTo = (path: string) => apiSend.mock.calls.filter((c) => c[1] === path);
const completeBody = () => callsTo("/media/complete").at(-1)?.[2];

describe("ChunkedUploader", () => {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    apiSend.mockClear();
    h.lookupFailures = 0;
    h.lookups = 0;
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens the upload with the same init body as before", async () => {
    await ChunkedUploader.open("tok", { sectionPosition: 2, sequence: 3 }, "video/mp4");
    expect(apiSend).toHaveBeenLastCalledWith("tok", "/media/init", { sectionPosition: 2, sequence: 3, mime: "video/mp4" });
  });

  it("sends each part as the same plain PUT to its target", async () => {
    fetchMock.mockResolvedValue(ok());
    const up = await ChunkedUploader.open("tok", { sectionPosition: 1, sequence: 1 }, "video/mp4");
    up.push(chunk());
    up.push(chunk());
    const done = up.finish(1000);
    await vi.advanceTimersByTimeAsync(5_000);
    await done;
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["https://bucket.example/part-1", "https://bucket.example/part-2"]);
    expect(fetchMock.mock.calls[0][1]).toEqual({ method: "PUT", body: expect.any(Blob) });
    expect(callsTo("/media/part-urls")).toEqual([["tok", "/media/part-urls", { uploadRef: "r", from: 2, count: 24 }]]);
    expect(completeBody()).toEqual({ uploadRef: "r", durationMs: 1000, incomplete: false });
  });

  it("retries a part-address lookup that fails once, lands the part and the parts after it", async () => {
    fetchMock.mockResolvedValue(ok());
    h.lookupFailures = 1;
    const up = await ChunkedUploader.open("tok", { sectionPosition: 1, sequence: 1 }, "video/mp4");
    up.push(chunk());
    up.push(chunk());
    up.push(chunk());
    const done = up.finish(1000);
    await vi.advanceTimersByTimeAsync(5_000);
    await done;
    expect(h.lookups).toBe(2);
    expect(up.parts.map((p) => p.partNumber)).toEqual([1, 2, 3]);
    expect(up.interrupted).toBe(false);
    expect(completeBody()).toEqual({ uploadRef: "r", durationMs: 1000, incomplete: false });
  });

  it("gives a part up after three failed lookups, like three failed PUTs, and still completes the take as incomplete", async () => {
    fetchMock.mockResolvedValue(ok());
    h.lookupFailures = 3;
    const up = await ChunkedUploader.open("tok", { sectionPosition: 1, sequence: 1 }, "video/mp4");
    up.push(chunk());
    up.push(chunk());
    up.push(chunk());
    const done = up.finish(1000);
    await vi.advanceTimersByTimeAsync(5_000);
    await done;
    // Part 2 was tried three times (0.4 s and 0.8 s apart) and given up; part 3
    // still went out after it, through the lookup that then answered.
    expect(h.lookups).toBe(4);
    expect(up.parts.map((p) => p.partNumber)).toEqual([1, 3]);
    expect(up.interrupted).toBe(true);
    expect(completeBody()).toEqual({ uploadRef: "r", durationMs: 1000, incomplete: true });
  });

  it("still gives a part up after three failed PUTs and completes the take as incomplete", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const up = await ChunkedUploader.open("tok", { sectionPosition: 1, sequence: 1 }, "video/mp4");
    up.push(chunk());
    const done = up.finish(1000);
    await vi.advanceTimersByTimeAsync(5_000);
    await done;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(completeBody()).toEqual({ uploadRef: "r", durationMs: 1000, incomplete: true });
  });
});
