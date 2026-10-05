import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  apiSend: vi.fn(async (_token: string, path: string, body: { mime?: string }): Promise<unknown> => {
    if (path === "/media/complete") return { status: "READY", bytes: 1, durationMs: 1 };
    return { uploadRef: "r", mime: body.mime, minPartBytes: 0, proxy: true, partTargets: [{ partNumber: 1, url: "", proxy: true }] };
  }),
}));
vi.mock("@/lib/client/api", () => ({ apiSend: h.apiSend, candidateApiBase: (t: string) => `/api/c/${t}` }));

import { ChunkedUploader, PATIENT_RETRY, pickChunkedRecorderMime, pickRecorderMime, type UploaderStatus } from "./recorder";

const ok = () => ({ ok: true, status: 200, headers: new Headers({ etag: '"e"' }), json: async () => ({ etag: "e" }) }) as unknown as Response;
const refused = (status: number) => ({ ok: false, status, headers: new Headers(), json: async () => ({ error: "UPLOAD_CLOSED" }) }) as unknown as Response;
const chunk = (bytes = 10) => new Blob([new Uint8Array(bytes)]);
const completeBody = () => h.apiSend.mock.calls.filter((c) => c[1] === "/media/complete").at(-1)?.[2];

describe("ChunkedUploader.open", () => {
  it("sends the solution's own init body with the mime", async () => {
    await ChunkedUploader.open("tok", "/hiring/media/init", { stagePosition: 1, activityId: "a1", kind: "recording" }, "video/webm");
    expect(h.apiSend).toHaveBeenLastCalledWith("tok", "/hiring/media/init", { stagePosition: 1, activityId: "a1", kind: "recording", mime: "video/webm" });
  });

  it("keeps the exam's body exactly as before", async () => {
    await ChunkedUploader.open("tok", "/exam/media/init", { sectionPosition: 2, sequence: 3 }, "video/mp4");
    expect(h.apiSend).toHaveBeenLastCalledWith("tok", "/exam/media/init", { sectionPosition: 2, sequence: 3, mime: "video/mp4" });
  });
});

describe("ChunkedUploader parts", () => {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    h.apiSend.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("the exam's uploader still gives a part up after three tries and completes the take as incomplete", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const up = await ChunkedUploader.open("tok", "/exam/media/init", { sectionPosition: 1, sequence: 1 }, "video/webm");
    up.push(chunk());
    const done = up.finish(1000);
    await vi.advanceTimersByTimeAsync(5_000);
    await done;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // The exam passes no signal: its part request is the same as before.
    expect(fetchMock.mock.calls[0][1]).toEqual({ method: "PUT", body: expect.any(Blob) });
    expect(completeBody()).toEqual({ uploadRef: "r", durationMs: 1000, incomplete: true });
  });

  it("a patient uploader (hiring) keeps a part through a 10 second outage, says it is stalled, and completes the take whole (A2)", async () => {
    let down = true;
    setTimeout(() => (down = false), 10_000);
    fetchMock.mockImplementation(async () => {
      if (down) throw new TypeError("Failed to fetch");
      return ok();
    });
    const seen: UploaderStatus[] = [];
    const up = await ChunkedUploader.open("tok", "/hiring/media/init", { stagePosition: 1, activityId: "a", kind: "recording" }, "video/webm", (s) => seen.push(s), PATIENT_RETRY);
    up.push(chunk());
    await vi.advanceTimersByTimeAsync(3_000);
    expect(seen.at(-1)?.stalled).toBe(true);
    // A new chunk while the connection is down does not hide the stall.
    up.push(chunk());
    expect(seen.at(-1)).toMatchObject({ stalled: true, uploadedBytes: 0, queuedBytes: 20 });
    const done = up.finish(10_000);
    await vi.advanceTimersByTimeAsync(30_000);
    await done;
    expect(completeBody()).toEqual({ uploadRef: "r", durationMs: 10_000, incomplete: false });
    expect(up.parts.map((p) => p.partNumber)).toEqual([1, 2]);
    expect(seen.at(-1)).toMatchObject({ stalled: false, uploadedBytes: 20, queuedBytes: 0 });
  });

  it("a patient uploader retries a lookup of more part addresses that fails, with its part", async () => {
    fetchMock.mockResolvedValue(ok());
    let lookups = 0;
    h.apiSend.mockImplementation(async (_t: string, path: string, body: { mime?: string }) => {
      if (path === "/media/part-urls") {
        lookups += 1;
        if (lookups === 1) throw new TypeError("Failed to fetch");
        return { partTargets: [{ partNumber: 2, url: "", proxy: true }] };
      }
      if (path === "/media/complete") return { status: "READY", bytes: 1, durationMs: 1 };
      return { uploadRef: "r", mime: body.mime, minPartBytes: 0, proxy: true, partTargets: [{ partNumber: 1, url: "", proxy: true }] };
    });
    const up = await ChunkedUploader.open("tok", "/hiring/media/init", {}, "audio/webm", undefined, PATIENT_RETRY);
    up.push(chunk());
    up.push(chunk());
    const done = up.finish(500);
    await vi.advanceTimersByTimeAsync(10_000);
    await done;
    expect(lookups).toBe(2);
    expect(up.parts.map((p) => p.partNumber)).toEqual([1, 2]);
    expect(completeBody()).toMatchObject({ incomplete: false });
  });

  it("a patient uploader does not retry a part the server refuses (the upload is closed): what landed is kept", async () => {
    fetchMock.mockResolvedValue(refused(400));
    const up = await ChunkedUploader.open("tok", "/hiring/media/init", {}, "video/webm", undefined, PATIENT_RETRY);
    up.push(chunk());
    const done = up.finish(500);
    await vi.advanceTimersByTimeAsync(1_000);
    await done;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(completeBody()).toMatchObject({ incomplete: true });
  });

  it("a patient uploader gives up on a part that never answers (timeout) and tries it again", async () => {
    let calls = 0;
    fetchMock.mockImplementation((_url, init) => {
      calls += 1;
      if (calls > 1) return Promise.resolve(ok());
      // A request that hangs until the uploader aborts it.
      return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    });
    const up = await ChunkedUploader.open("tok", "/hiring/media/init", {}, "video/webm", undefined, PATIENT_RETRY);
    up.push(chunk());
    const done = up.finish(500);
    await vi.advanceTimersByTimeAsync(PATIENT_RETRY.partTimeoutMs! + 5_000);
    await done;
    expect(calls).toBe(2);
    expect(completeBody()).toMatchObject({ incomplete: false });
  });
});

describe("the container a take records in", () => {
  afterEach(() => vi.unstubAllGlobals());
  const browser = (supported: string[]) => vi.stubGlobal("MediaRecorder", { isTypeSupported: (mime: string) => supported.includes(mime) });

  it("hiring prefers WebM where chunks arrive every timeslice (Chrome records MP4 too, but hands it over only at stop)", () => {
    browser(["video/mp4", "video/webm;codecs=vp9", "video/webm", "audio/mp4", "audio/webm;codecs=opus"]);
    expect(pickChunkedRecorderMime("video", "Google Inc.")).toBe("video/webm;codecs=vp9");
    expect(pickChunkedRecorderMime("audio", "Google Inc.")).toBe("audio/webm;codecs=opus");
    // The exam's order is unchanged.
    expect(pickRecorderMime("video")).toBe("video/mp4");
  });

  it("Apple's engine keeps the exam's MP4-first order", () => {
    browser(["video/mp4", "video/webm", "audio/mp4"]);
    expect(pickChunkedRecorderMime("video", "Apple Computer, Inc.")).toBe("video/mp4");
    expect(pickChunkedRecorderMime("audio", "Apple Computer, Inc.")).toBe("audio/mp4");
  });

  it("falls back to MP4, then to nothing", () => {
    browser(["video/mp4"]);
    expect(pickChunkedRecorderMime("video", "")).toBe("video/mp4");
    browser([]);
    expect(pickChunkedRecorderMime("video", "")).toBe("");
  });
});
