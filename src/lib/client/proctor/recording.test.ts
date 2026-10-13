import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { policyFromPreset } from "@/lib/proctor/policy";
import { ProctorRecording, TrackRecorder, pickSegmentMime } from "./recording";
import type { QueuedSegment } from "./recording-queue";

/**
 * The browser recorder against a scripted MediaRecorder and fake tracks: the
 * real MediaRecorder needs a browser, and its part of the pipeline was checked
 * there separately (docs/PROCTORING.md, "Test"). What is checked here is ours:
 * when files are cut, how they are numbered and timed, what reaches the upload.
 */

class FakeTrack {
  readyState: "live" | "ended" = "live";
  constraints: unknown = null;
  constructor(readonly kind: "video" | "audio") {}
  clone() {
    const c = new FakeTrack(this.kind);
    clones.push(c);
    return c;
  }
  async applyConstraints(c: unknown) {
    this.constraints = c;
  }
  stop() {
    this.readyState = "ended";
  }
}
let clones: FakeTrack[] = [];

class FakeStream {
  constructor(readonly tracks: FakeTrack[]) {}
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio");
  }
}

const fileBytes = (n = 2048) => {
  const b = new Uint8Array(n);
  b.set([0x1a, 0x45, 0xdf, 0xa3]);
  return b;
};

class FakeRecorder {
  static all: FakeRecorder[] = [];
  /** What the next stop hands over; a header-only file is about 110 bytes. */
  static finalBytes = 2048;
  state: "inactive" | "recording" = "inactive";
  timeslice: number | undefined;
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(
    readonly stream: FakeStream,
    readonly options?: MediaRecorderOptions,
  ) {
    this.mimeType = options?.mimeType ?? "video/webm";
    FakeRecorder.all.push(this);
  }
  start(timeslice?: number) {
    this.timeslice = timeslice;
    this.state = "recording";
  }
  /** One timeslice beat. */
  beat() {
    this.ondataavailable?.({ data: new Blob([fileBytes(64)]) });
  }
  /** Like the browser: the data and the stop event come a moment later. */
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob([fileBytes(FakeRecorder.finalBytes)]) });
      this.onstop?.();
    }, 5);
  }
}

const Recorder = FakeRecorder as unknown as new (stream: MediaStream, options?: MediaRecorderOptions) => MediaRecorder;
const clock = { setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms), clearTimeout: (id: unknown) => clearTimeout(id as number) };

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
  FakeRecorder.all = [];
  FakeRecorder.finalBytes = 2048;
  clones = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function trackRecorder(stream: FakeStream, extra: Partial<ConstructorParameters<typeof TrackRecorder>[0]> = {}) {
  const segments: QueuedSegment[] = [];
  const rec = new TrackRecorder({
    kind: "CAMERA",
    stream: stream as unknown as MediaStream,
    mime: "video/webm;codecs=vp8,opus",
    runId: "run-abcdef01",
    now: () => Date.now(),
    onSegment: (s) => segments.push(s),
    segmentMs: 15_000,
    Recorder,
    clock,
    ...extra,
  });
  return { rec, segments };
}

describe("TrackRecorder", () => {
  it("cuts a complete file every 15 seconds, numbered and timed, the next one opened before the previous one stops", async () => {
    const stream = new FakeStream([new FakeTrack("video"), new FakeTrack("audio")]);
    const { rec, segments } = trackRecorder(stream);
    rec.start();
    expect(FakeRecorder.all).toHaveLength(1);
    expect(FakeRecorder.all[0].options).toMatchObject({ mimeType: "video/webm;codecs=vp8,opus", videoBitsPerSecond: 250_000, audioBitsPerSecond: 32_000 });

    await vi.advanceTimersByTimeAsync(15_000);
    // The second recorder exists while the first is only now stopping.
    expect(FakeRecorder.all).toHaveLength(2);
    expect(FakeRecorder.all[1].state).toBe("recording");
    await vi.advanceTimersByTimeAsync(10);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ kind: "CAMERA", runId: "run-abcdef01", sequence: 0, startedAt: 1_000_000, durationMs: 15_000, mime: "video/webm" });

    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(10);
    expect(segments.map((s) => s.sequence)).toEqual([0, 1]);
    expect(segments[1].startedAt).toBe(1_015_000);

    await vi.advanceTimersByTimeAsync(4_000);
    const stopped = rec.stop();
    await vi.advanceTimersByTimeAsync(10);
    await stopped;
    expect(segments.map((s) => s.sequence)).toEqual([0, 1, 2]);
    expect(segments[2].durationMs).toBe(4_020);
    expect(rec.ended).toBe(true);
    // Nothing is cut after stop.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeRecorder.all).toHaveLength(3);
  });

  it("notices a track that ended, hands over the last file and asks for a new run", async () => {
    const video = new FakeTrack("video");
    const onEnded = vi.fn();
    const { rec, segments } = trackRecorder(new FakeStream([video]), { onEnded });
    rec.start();
    await vi.advanceTimersByTimeAsync(5_000);
    // The camera is unplugged: the browser stops the recorder by itself.
    video.readyState = "ended";
    FakeRecorder.all[0].stop();
    await vi.advanceTimersByTimeAsync(10);
    expect(segments).toHaveLength(1);
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(rec.ended).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(FakeRecorder.all).toHaveLength(1);
  });

  it("still cuts on the recorder's own one second beat when the page's timers are throttled", async () => {
    const frozen = { setTimeout: () => 0, clearTimeout: () => undefined };
    const { rec, segments } = trackRecorder(new FakeStream([new FakeTrack("video")]), { clock: frozen });
    rec.start();
    expect(FakeRecorder.all[0].timeslice).toBe(1000);
    for (let s = 1; s <= 14; s++) {
      await vi.advanceTimersByTimeAsync(1000);
      FakeRecorder.all[0].beat();
    }
    expect(FakeRecorder.all).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    FakeRecorder.all[0].beat();
    expect(FakeRecorder.all).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(10);
    expect(segments).toHaveLength(1);
    // The beats and the final data are one file.
    expect(segments[0].blob.size).toBe(15 * 64 + 2048);
  });

  it("does not hand over a file with no frame in it (a header only)", async () => {
    const { rec, segments } = trackRecorder(new FakeStream([new FakeTrack("video")]));
    rec.start();
    FakeRecorder.finalBytes = 110;
    await vi.advanceTimersByTimeAsync(15_010);
    expect(segments).toHaveLength(0);
    FakeRecorder.finalBytes = 2048;
    await vi.advanceTimersByTimeAsync(15_010);
    expect(segments.map((s) => s.sequence)).toEqual([1]);
  });

  it("asks for no audio bitrate on a stream without audio (the screen)", () => {
    const { rec } = trackRecorder(new FakeStream([new FakeTrack("video")]), { kind: "SCREEN", mime: "video/webm;codecs=vp8" });
    rec.start();
    expect(FakeRecorder.all[0].options).toEqual({ mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: 400_000 });
  });
});

describe("pickSegmentMime", () => {
  const all = () => true;
  it("prefers WebM VP8 with Opus in Chromium, and MP4 on Apple's engine", () => {
    expect(pickSegmentMime(true, all, "Google Inc.")).toBe("video/webm;codecs=vp8,opus");
    expect(pickSegmentMime(false, all, "Google Inc.")).toBe("video/webm;codecs=vp8");
    expect(pickSegmentMime(true, all, "Apple Computer, Inc.")).toBe("video/mp4");
  });

  it("falls back down the list and finally to the browser's default", () => {
    expect(pickSegmentMime(true, (m) => m === "video/webm", "")).toBe("video/webm");
    expect(pickSegmentMime(true, () => false, "")).toBe("");
  });
});

describe("ProctorRecording", () => {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("MediaStream", FakeStream);
    vi.stubGlobal("window", globalThis);
  });

  const camera = () => new FakeStream([new FakeTrack("video"), new FakeTrack("audio")]);
  const screen = () => new FakeStream([new FakeTrack("video")]);
  const make = () =>
    new ProctorRecording({
      url: (path) => `/api/c/tok${path}`,
      now: () => Date.now() + 250,
      sessionId: () => "11111111-2222-4333-8444-555555555555",
      Recorder,
      isTypeSupported: () => true,
      segmentMs: 15_000,
    });

  it("records the camera (with the microphone) under STANDARD and uploads each segment in order", async () => {
    const rec = make();
    rec.sync({ policy: policyFromPreset("STANDARD"), guarding: true, camera: camera() as unknown as MediaStream, screen: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeRecorder.all).toHaveLength(1);
    // Recorded from clones, scaled down; the engine's own tracks are left alone.
    expect(FakeRecorder.all[0].stream.getAudioTracks()).toHaveLength(1);
    expect(clones[0].constraints).toMatchObject({ width: { ideal: 640 }, height: { ideal: 360 } });

    await vi.advanceTimersByTimeAsync(30_020);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    const q = new URL(url, "http://x").searchParams;
    expect(url.startsWith("/api/c/tok/proctor/recording?")).toBe(true);
    expect(Object.fromEntries(q)).toMatchObject({ kind: "CAMERA", seq: "0", at: "1000250", dur: "15000", session: "11111111-2222-4333-8444-555555555555" });
    expect(init).toMatchObject({ method: "PUT", headers: { "content-type": "video/webm" } });
    expect(new URL(fetchMock.mock.calls[1][0], "http://x").searchParams.get("seq")).toBe("1");
  });

  it("records the screen too under STRICT, and does nothing before the exam is armed", async () => {
    const rec = make();
    rec.sync({ policy: policyFromPreset("STRICT"), guarding: false, camera: camera() as unknown as MediaStream, screen: screen() as unknown as MediaStream });
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeRecorder.all).toHaveLength(0);
    rec.sync({ policy: policyFromPreset("STRICT"), guarding: true, camera: camera() as unknown as MediaStream, screen: screen() as unknown as MediaStream });
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeRecorder.all).toHaveLength(2);
    const kinds = FakeRecorder.all.map((r) => (r.stream.getAudioTracks().length ? "camera" : "screen"));
    expect(kinds.sort()).toEqual(["camera", "screen"]);
  });

  it("does not start a second recorder for a stream it already records, but starts a new run for a new stream", async () => {
    const rec = make();
    const cam = camera();
    const input = { policy: policyFromPreset("STANDARD"), guarding: true, camera: cam as unknown as MediaStream, screen: null };
    rec.sync(input);
    await vi.advanceTimersByTimeAsync(0);
    rec.sync(input);
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeRecorder.all).toHaveLength(1);
    // The camera came back after it was lost: a new stream.
    rec.sync({ ...input, camera: camera() as unknown as MediaStream });
    await vi.advanceTimersByTimeAsync(20);
    expect(FakeRecorder.all).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(15_020);
    const runs = new Set(fetchMock.mock.calls.map(([u]) => new URL(u, "http://x").searchParams.get("run")));
    expect(runs.size).toBe(2);
  });

  it("stop cuts the last segment, stops its clones and keeps uploading what is queued", async () => {
    const rec = make();
    rec.sync({ policy: policyFromPreset("STANDARD"), guarding: true, camera: camera() as unknown as MediaStream, screen: null });
    await vi.advanceTimersByTimeAsync(7_000);
    const stopping = rec.stop();
    // The runner and the last screen both stop the engine: one cut, not two.
    expect(rec.stop()).toBe(stopping);
    await vi.advanceTimersByTimeAsync(20);
    await stopping;
    expect(clones.every((t) => t.readyState === "ended")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(fetchMock.mock.calls[0][0], "http://x").searchParams.get("dur")).toBe("7000");
    // After stop nothing new starts.
    rec.sync({ policy: policyFromPreset("STANDARD"), guarding: true, camera: camera() as unknown as MediaStream, screen: null });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(FakeRecorder.all).toHaveLength(1);
  });

  it("tries a segment again on a network error or a 503, and drops it on a 409", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 409 }));
    const rec = make();
    rec.sync({ policy: policyFromPreset("STANDARD"), guarding: true, camera: camera() as unknown as MediaStream, screen: null });
    await vi.advanceTimersByTimeAsync(15_020);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(rec.queue.status).toMatchObject({ uploaded: 1 });
    await vi.advanceTimersByTimeAsync(10_020);
    expect(rec.queue.status).toMatchObject({ uploaded: 1, dropped: 1, pending: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
