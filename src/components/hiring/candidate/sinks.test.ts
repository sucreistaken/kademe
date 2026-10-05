import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TakeProgress } from "./recording-sink";

const h = vi.hoisted(() => ({
  open: vi.fn(),
  beacon: vi.fn(() => true),
  uploader: null as null | {
    uploadRef: string;
    push: ReturnType<typeof vi.fn>;
    finish: ReturnType<typeof vi.fn>;
  },
  onStatus: undefined as undefined | ((s: { uploadedBytes: number; queuedBytes: number; stalled: boolean }) => void),
}));

vi.mock("@/lib/client/recorder", () => ({
  PATIENT_RETRY: { attempts: 99, delayMs: () => 1, partTimeoutMs: 1, retryTargets: true, stopOnRefusal: true },
  ChunkedUploader: {
    open: (...args: unknown[]) => {
      h.open(...args);
      h.onStatus = args[4] as typeof h.onStatus;
      return Promise.resolve(h.uploader);
    },
  },
}));
vi.mock("@/lib/client/api", () => ({ apiBeacon: h.beacon }));

import { localSink } from "./local-sink";
import { uploadSink } from "./upload-sink";

const refusal = (code: string, status: number) => Object.assign(new Error(code), { code, status });

describe("uploadSink: an answer's take", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.open.mockClear();
    h.beacon.mockClear();
    h.uploader = { uploadRef: "take-1", push: vi.fn(), finish: vi.fn(async () => ({ status: "READY", bytes: 10, durationMs: 1000 })) };
  });
  afterEach(() => vi.useRealTimers());

  it("opens the take on the hiring init with the stage, the question and kind recording, patient with its parts", async () => {
    await uploadSink("tok", 2, "act-1").open("video/webm");
    expect(h.open).toHaveBeenCalledWith("tok", "/hiring/media/init", { stagePosition: 2, activityId: "act-1", kind: "recording" }, "video/webm", expect.any(Function), expect.objectContaining({ retryTargets: true }));
  });

  it("passes the chunks on and reports the share uploaded and a stall", async () => {
    const seen: TakeProgress[] = [];
    const take = await uploadSink("tok", 1, "a").open("video/webm", (p) => seen.push(p));
    take.push(new Blob(["x"]));
    expect(h.uploader!.push).toHaveBeenCalledTimes(1);
    h.onStatus!({ uploadedBytes: 30, queuedBytes: 10, stalled: false });
    h.onStatus!({ uploadedBytes: 30, queuedBytes: 30, stalled: true });
    expect(seen).toEqual([
      { ratio: 0.75, stalled: false },
      { ratio: 0.5, stalled: true },
    ]);
  });

  it("finishes READY or INCOMPLETE with the take's own ref", async () => {
    const take = await uploadSink("tok", 1, "a").open("video/webm");
    await expect(take.finish(1000)).resolves.toEqual({ status: "READY", ref: "take-1" });
    h.uploader!.finish.mockResolvedValueOnce({ status: "INCOMPLETE", bytes: 5, durationMs: 1000 });
    await expect(take.finish(1000)).resolves.toEqual({ status: "INCOMPLETE", ref: "take-1" });
  });

  it("tries the completion again when the connection drops on the way (never a lost take)", async () => {
    h.uploader!.finish.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockRejectedValueOnce(refusal("UNAVAILABLE", 503));
    const take = await uploadSink("tok", 1, "a").open("video/webm");
    const done = take.finish(1000);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(done).resolves.toEqual({ status: "READY", ref: "take-1" });
    expect(h.uploader!.finish).toHaveBeenCalledTimes(3);
  });

  it("gives a refusal straight back (NO_PARTS: the server gave the take back)", async () => {
    h.uploader!.finish.mockRejectedValue(refusal("NO_PARTS", 409));
    const take = await uploadSink("tok", 1, "a").open("video/webm");
    await expect(take.finish(1000)).rejects.toMatchObject({ code: "NO_PARTS" });
    expect(h.uploader!.finish).toHaveBeenCalledTimes(1);
  });

  it("gives up after a bounded number of tries, so the screen can offer its own retry", async () => {
    h.uploader!.finish.mockRejectedValue(new TypeError("Failed to fetch"));
    const take = await uploadSink("tok", 1, "a").open("video/webm");
    const done = take.finish(1000);
    const settled = expect(done).rejects.toBeInstanceOf(TypeError);
    await vi.advanceTimersByTimeAsync(120_000);
    await settled;
    expect(h.uploader!.finish.mock.calls.length).toBeGreaterThan(2);
    expect(h.uploader!.finish.mock.calls.length).toBeLessThan(10);
  });

  it("a page going away mid-take completes what landed with a beacon, marked incomplete", async () => {
    const take = await uploadSink("tok", 1, "a").open("video/webm");
    take.abandon(4200);
    expect(h.beacon).toHaveBeenCalledWith("tok", "/media/complete", { uploadRef: "take-1", durationMs: 4200, incomplete: true });
  });
});

describe("localSink: the warm-up's take", () => {
  const fetchMock = vi.fn();
  const beaconMock = vi.fn();
  const created: Blob[] = [];
  const revoked: string[] = [];
  beforeEach(() => {
    fetchMock.mockReset();
    beaconMock.mockReset();
    created.length = 0;
    revoked.length = 0;
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { sendBeacon: beaconMock });
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      created.push(blob as Blob);
      return `blob:local/${created.length}`;
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => void revoked.push(url));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the take in this tab and plays it from a blob URL, sending nothing anywhere (A4)", async () => {
    const sink = localSink();
    const take = await sink.open("video/webm");
    take.push(new Blob(["ab"]));
    take.push(new Blob(["cd"]));
    const result = await take.finish(3000);
    expect(result).toEqual({ status: "READY", ref: null, localUrl: "blob:local/1" });
    expect(created[0].size).toBe(4);
    expect(created[0].type).toBe("video/webm");
    take.abandon(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(beaconMock).not.toHaveBeenCalled();
  });

  it("drops an abandoned take and frees every URL it made on release", async () => {
    const sink = localSink();
    const first = await sink.open("audio/webm");
    first.push(new Blob(["a"]));
    await first.finish(1000);
    const second = await sink.open("audio/webm");
    second.push(new Blob(["b"]));
    second.abandon(500);
    const empty = await second.finish(500);
    expect(created[1].size).toBe(0);
    sink.release();
    expect(revoked).toEqual(["blob:local/1", empty.localUrl]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
