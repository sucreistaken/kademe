"use client";

import { SegmentQueue, type QueuedSegment, type QueueStatus, type SendOutcome } from "@/lib/client/proctor/recording-queue";
import type { ProctoringPolicy } from "@/lib/proctor/policy";
import { RECORDING_PROFILE, SEGMENT_MS, type RecordingKind } from "@/lib/proctor/recording-rules";

/**
 * Continuous recording of a proctored attempt, in the browser.
 *
 * It records the streams the proctoring engine already holds (it never asks
 * for a permission of its own): the camera with the microphone when the policy
 * watches the camera, the screen when the policy shares it. Each kind runs its
 * own MediaRecorder on a clone of the engine's track, scaled down for the
 * recording only, so the models and the frames keep their full picture.
 *
 * A recorder is replaced by a fresh one every SEGMENT_MS. Each one produces a
 * complete file, so every segment plays on its own; the next recorder is
 * started before the previous one is stopped, so the hand-over overlaps by a
 * few milliseconds instead of dropping them. Segments go into SegmentQueue,
 * which uploads them in order and holds them while the connection is down.
 */

type RecorderCtor = new (stream: MediaStream, options?: MediaRecorderOptions) => MediaRecorder;

type Clock = { setTimeout: (fn: () => void, ms: number) => unknown; clearTimeout: (id: unknown) => void };

const browserClock: Clock = {
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id as number),
};

/**
 * A file this small is a container header with no frame in it (seen in Chrome
 * when the source delivered no frame for the whole segment). It plays as
 * nothing, so it is not uploaded; the panel shows the stretch as not recorded.
 */
export const MIN_SEGMENT_BYTES = 1024;

/** The recorder hands over what it has every second; the segment is cut on that beat too (see open()). */
const TIMESLICE_MS = 1000;

const rid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

/**
 * WebM first outside Apple's engine (its chunks and its stop behave the same in
 * every Chromium), VP8 before VP9 because it costs less CPU on the laptops that
 * also run the face model, MP4 last; on Safari MP4 first.
 */
export function pickSegmentMime(
  withAudio: boolean,
  isTypeSupported: (mime: string) => boolean,
  vendor = "",
): string {
  const webm = withAudio
    ? ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"]
    : ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"];
  const mp4 = ["video/mp4"];
  const order = vendor.startsWith("Apple") ? [...mp4, ...webm] : [...webm, ...mp4];
  return order.find((m) => isTypeSupported(m)) ?? "";
}

type Open = {
  recorder: MediaRecorder;
  sequence: number;
  startedAt: number;
  stopAt: number | null;
  chunks: Blob[];
  done: Promise<void>;
};

export type TrackRecorderOptions = {
  kind: RecordingKind;
  stream: MediaStream;
  mime: string;
  runId: string;
  now: () => number;
  onSegment: (segment: QueuedSegment) => void;
  /** The recorder stopped on its own (the track ended); a new one is needed for new tracks. */
  onEnded?: () => void;
  segmentMs?: number;
  Recorder?: RecorderCtor;
  clock?: Clock;
};

/** One kind, one stream, a new file every `segmentMs`. */
export class TrackRecorder {
  private seq = 0;
  private current: Open | null = null;
  private timer: unknown = null;
  private stopping: Promise<void> | null = null;
  ended = false;

  constructor(private readonly o: TrackRecorderOptions) {}

  private get clock() {
    return this.o.clock ?? browserClock;
  }

  /** Throws when the browser refuses to record this stream at all. */
  start() {
    this.current = this.open();
    this.schedule();
  }

  private live() {
    return this.o.stream.getTracks().some((t) => t.readyState === "live");
  }

  private open(): Open {
    const Recorder = this.o.Recorder ?? MediaRecorder;
    const profile = RECORDING_PROFILE[this.o.kind];
    const hasAudio = this.o.stream.getAudioTracks().length > 0;
    let recorder: MediaRecorder;
    try {
      recorder = new Recorder(this.o.stream, {
        mimeType: this.o.mime || undefined,
        videoBitsPerSecond: profile.videoBitsPerSecond,
        ...(hasAudio && profile.audioBitsPerSecond ? { audioBitsPerSecond: profile.audioBitsPerSecond } : {}),
      });
    } catch {
      // A browser that refuses the codec or the bitrate still gets its own defaults.
      recorder = new Recorder(this.o.stream);
    }
    const seg: Open = { recorder, sequence: this.seq++, startedAt: this.o.now(), stopAt: null, chunks: [], done: Promise.resolve() };
    seg.done = new Promise<void>((resolve) => {
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) seg.chunks.push(e.data);
        // The timer below is the usual trigger, but a hidden tab's timers can be
        // throttled to once a minute; the recorder's own beat is not, so it can
        // cut the segment too. Whichever comes first wins.
        if (this.current === seg && !this.stopping && this.o.now() - seg.startedAt >= (this.o.segmentMs ?? SEGMENT_MS)) this.rotate();
      };
      recorder.onstop = () => {
        const endAt = seg.stopAt ?? this.o.now();
        const type = (recorder.mimeType || this.o.mime || "video/webm").split(";")[0];
        const blob = new Blob(seg.chunks, { type });
        if (blob.size >= MIN_SEGMENT_BYTES) {
          this.o.onSegment({
            kind: this.o.kind,
            runId: this.o.runId,
            sequence: seg.sequence,
            startedAt: seg.startedAt,
            durationMs: Math.max(1, Math.round(endAt - seg.startedAt)),
            mime: type,
            blob,
          });
        }
        resolve();
        // Stopped by itself, not by a rotation or by stop(): the track is gone.
        if (this.current === seg && !this.stopping) this.finish();
      };
    });
    recorder.start(TIMESLICE_MS);
    return seg;
  }

  private schedule() {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      this.rotate();
    }, this.o.segmentMs ?? SEGMENT_MS);
  }

  private rotate() {
    if (this.stopping || this.ended) return;
    const old = this.current;
    if (!this.live()) {
      if (old && old.recorder.state !== "inactive") {
        old.stopAt = this.o.now();
        old.recorder.stop();
      }
      this.finish();
      return;
    }
    try {
      this.current = this.open();
    } catch {
      this.current = null;
    }
    if (old && old.recorder.state !== "inactive") {
      old.stopAt = this.o.now();
      old.recorder.stop();
    }
    if (this.current) this.schedule();
    else this.finish();
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
    this.o.onEnded?.();
  }

  /** Cuts the segment in progress and resolves once it has been handed to the queue. */
  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
    const seg = this.current;
    if (seg && seg.recorder.state !== "inactive") {
      seg.stopAt = this.o.now();
      seg.recorder.stop();
    }
    this.stopping = (seg?.done ?? Promise.resolve()).then(() => {
      this.ended = true;
    });
    return this.stopping;
  }
}

type Running = { recorder: TrackRecorder; source: MediaStreamTrack; clones: MediaStreamTrack[] };

export type RecordingDeps = {
  /** Absolute candidate API path, e.g. `/api/c/<token>/proctor/recording`. */
  url: (path: string) => string;
  /** Server-corrected clock, ms. */
  now: () => number;
  sessionId: () => string | null;
  Recorder?: RecorderCtor;
  isTypeSupported?: (mime: string) => boolean;
  segmentMs?: number;
  onStatus?: (status: QueueStatus) => void;
};

/** Both kinds and the upload line, for one exam tab. Owned by the proctoring engine. */
export class ProctorRecording {
  private running: Partial<Record<RecordingKind, Running>> = {};
  private starting = new Set<RecordingKind>();
  private closed = false;
  readonly queue: SegmentQueue;

  constructor(private readonly deps: RecordingDeps) {
    this.queue = new SegmentQueue({ send: (s) => this.send(s), onStatus: deps.onStatus });
  }

  /**
   * Starts what the policy asks for and is not running yet. Called whenever
   * something may have changed: the exam was armed, the camera or the screen
   * share came (back). A kind whose track ended gets a new run on the new track.
   */
  sync(input: {
    policy: ProctoringPolicy | null;
    guarding: boolean;
    camera: MediaStream | null;
    screen: MediaStream | null;
  }) {
    const p = input.policy;
    if (this.closed || !input.guarding || !p || p.preset === "OFF") return;
    if (p.camera) void this.ensure("CAMERA", input.camera, p.microphone);
    if (p.screenShare) void this.ensure("SCREEN", input.screen, false);
  }

  private async ensure(kind: RecordingKind, stream: MediaStream | null, withAudio: boolean) {
    const source = stream?.getVideoTracks()[0];
    if (!source || source.readyState !== "live") return;
    const current = this.running[kind];
    if (current && current.source === source && !current.recorder.ended) return;
    if (this.starting.has(kind)) return;
    this.starting.add(kind);
    try {
      if (current) await this.halt(current);
      const profile = RECORDING_PROFILE[kind];
      const video = source.clone();
      // Best effort: a canvas or an older browser may refuse, and then the
      // recording simply keeps the source size at the same bitrate.
      await video
        .applyConstraints(
          kind === "CAMERA"
            ? { width: { ideal: profile.width }, height: { ideal: profile.height }, frameRate: { max: profile.frameRate } }
            : { width: { max: profile.width }, height: { max: profile.height }, frameRate: { max: profile.frameRate } },
        )
        .catch(() => undefined);
      const audio = withAudio ? stream!.getAudioTracks().find((t) => t.readyState === "live")?.clone() : undefined;
      const clones = audio ? [video, audio] : [video];
      if (this.closed) {
        clones.forEach((t) => t.stop());
        return;
      }
      const supported = this.deps.isTypeSupported ?? ((m: string) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
      const vendor = typeof navigator === "undefined" ? "" : navigator.vendor;
      const recorder = new TrackRecorder({
        kind,
        stream: new MediaStream(clones),
        mime: pickSegmentMime(!!audio, supported, vendor),
        runId: rid(),
        now: this.deps.now,
        onSegment: (s) => this.queue.push(s),
        onEnded: () => clones.forEach((t) => t.stop()),
        segmentMs: this.deps.segmentMs,
        Recorder: this.deps.Recorder,
      });
      try {
        recorder.start();
      } catch {
        // This browser cannot record the stream; the panel shows the stretch as not recorded.
        clones.forEach((t) => t.stop());
        return;
      }
      this.running[kind] = { recorder, source, clones };
    } finally {
      this.starting.delete(kind);
    }
  }

  private async halt(run: Running) {
    await run.recorder.stop();
    run.clones.forEach((t) => t.stop());
  }

  /**
   * Ends the recording: the segments in progress are cut and queued (waiting at
   * most `timeoutMs` for the browser to hand them over), the clones stop. The
   * queue keeps uploading in the background for as long as the tab is open.
   */
  stop(timeoutMs = 3000): Promise<void> {
    // The exam's last screen and the runner both stop the engine; both wait for the same cut.
    this.stopped ??= (async () => {
      this.closed = true;
      const runs = Object.values(this.running).filter((r): r is Running => !!r);
      this.running = {};
      await Promise.race([
        Promise.all(runs.map((r) => this.halt(r))),
        new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
      runs.forEach((r) => r.clones.forEach((t) => t.stop()));
    })();
    return this.stopped;
  }

  private stopped: Promise<void> | null = null;

  private async send(s: QueuedSegment): Promise<SendOutcome> {
    const params = new URLSearchParams({
      kind: s.kind,
      run: s.runId,
      seq: String(s.sequence),
      at: String(Math.round(s.startedAt)),
      dur: String(s.durationMs),
    });
    const session = this.deps.sessionId();
    if (session) params.set("session", session);
    try {
      const res = await fetch(`${this.deps.url("/proctor/recording")}?${params}`, {
        method: "PUT",
        body: s.blob,
        headers: { "content-type": s.mime },
        signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(60_000) : undefined,
      });
      if (res.ok) return "ok";
      // Busy, timed out or broken: worth another try. Anything else will not change.
      return res.status === 408 || res.status === 429 || res.status >= 500 ? "retry" : "drop";
    } catch {
      return "retry";
    }
  }
}
