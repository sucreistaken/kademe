/**
 * Continuous proctoring recording: the numbers and the rules both halves agree
 * on. Pure, no database, no browser, so the browser recorder, the upload route
 * and the tests read the same values.
 *
 * Why short independent files rather than one long upload: every segment is a
 * complete, playable file. A reload, a dropped connection or a crashed tab
 * costs the segment in flight, never the recording before it, and the panel can
 * start playing at any segment without the rest. See docs/PROCTORING.md.
 */

import type { ProctoringPolicy } from "@/lib/proctor/policy";

export const RECORDING_KINDS = ["CAMERA", "SCREEN"] as const;
export type RecordingKind = (typeof RECORDING_KINDS)[number];

/** How long one segment runs before the recorder starts the next file. */
export const SEGMENT_MS = 15_000;
/** The upload route refuses anything longer; a recorder never makes one. */
export const MAX_SEGMENT_MS = 60_000;
/**
 * Far above what a 15 second segment at the bitrates below weighs (about
 * 0.5 MB), on purpose: the bitrate is a target, not a cap. Measured in Chrome
 * on a pure noise picture (the worst a camera can send), VP8 at a 250 kbps
 * target produced 4.9 Mbit/s, about 9 MB per segment. A segment refused for its
 * size is a hole in the evidence, so the limit only stops absurd bodies.
 */
export const MAX_SEGMENT_BYTES = 16 * 1024 * 1024;
export const RECORDING_MIME = ["video/webm", "video/mp4"] as const;
export type RecordingMime = (typeof RECORDING_MIME)[number];

/**
 * After the attempt ends, segments still waiting in the browser's queue (the
 * last one is always cut at the finish) may arrive for this long.
 */
export const UPLOAD_GRACE_MS = 15 * 60_000;

/**
 * Target bitrates. MediaRecorder treats them as targets, not caps: real files
 * come out somewhat under (a still screen) or over (a lot of motion). The
 * storage estimate in docs/PROCTORING.md is computed from these.
 */
export const RECORDING_PROFILE = {
  CAMERA: { width: 640, height: 360, frameRate: 15, videoBitsPerSecond: 250_000, audioBitsPerSecond: 32_000 },
  SCREEN: { width: 1280, height: 800, frameRate: 5, videoBitsPerSecond: 400_000, audioBitsPerSecond: 0 },
} as const satisfies Record<RecordingKind, { width: number; height: number; frameRate: number; videoBitsPerSecond: number; audioBitsPerSecond: number }>;

/** Megabytes one hour of one kind takes at its target bitrate. */
export function megabytesPerHour(kind: RecordingKind): number {
  const p = RECORDING_PROFILE[kind];
  return ((p.videoBitsPerSecond + p.audioBitsPerSecond) * 3600) / 8 / 1_000_000;
}

/** Which kinds this policy records: the camera when it watches the camera, the screen when it shares it. */
export function kindAllowed(kind: RecordingKind, policy: Pick<ProctoringPolicy, "preset" | "camera" | "screenShare">): boolean {
  if (policy.preset === "OFF") return false;
  return kind === "CAMERA" ? policy.camera : policy.screenShare;
}

export type SegmentMeta = {
  kind: RecordingKind;
  runId: string;
  sequence: number;
  /** Server clock, ms. */
  startedAt: number;
  durationMs: number;
};

const RUN_ID = /^[A-Za-z0-9-]{8,64}$/;
/** A segment queued offline can arrive late, but not from another day. */
const MAX_AGE_MS = 12 * 60 * 60_000;
const MAX_FUTURE_MS = 2 * 60_000;

/**
 * Reads the segment's description from the upload's query string. Everything
 * the storage key is built from passes through here, so nothing the browser
 * names can reach a path unchecked.
 */
export function parseSegmentMeta(q: URLSearchParams, now: number): SegmentMeta | null {
  const kind = q.get("kind") as RecordingKind | null;
  if (!kind || !RECORDING_KINDS.includes(kind)) return null;
  const runId = q.get("run") ?? "";
  if (!RUN_ID.test(runId)) return null;
  const int = (key: string) => {
    const raw = q.get(key);
    if (raw === null || !/^\d+$/.test(raw)) return null;
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : null;
  };
  const sequence = int("seq");
  const startedAt = int("at");
  const durationMs = int("dur");
  if (sequence === null || sequence > 100_000) return null;
  if (durationMs === null || durationMs < 1 || durationMs > MAX_SEGMENT_MS) return null;
  if (startedAt === null || startedAt < now - MAX_AGE_MS || startedAt > now + MAX_FUTURE_MS) return null;
  return { kind, runId, sequence, startedAt, durationMs };
}

/** `video/webm;codecs=vp8,opus` -> `video/webm`, or null for anything not recorded here. */
export function recordingMime(contentType: string | null): RecordingMime | null {
  const base = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return (RECORDING_MIME as readonly string[]).includes(base) ? (base as RecordingMime) : null;
}

/**
 * The first bytes have to be what the content type claims: an EBML header for
 * WebM, an `ftyp` box for MP4. The panel serves these files from its own
 * origin, so a body that is really something else is refused at the door.
 */
export function sniffMedia(bytes: Uint8Array, mime: RecordingMime): boolean {
  if (mime === "video/webm") return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}

export type UploadWindow = "OPEN" | "NOT_STARTED" | "CLOSED";

/**
 * Whether a segment for this attempt may be stored now. Recording starts when
 * the exam is armed, which is after the system check; it may keep arriving for
 * UPLOAD_GRACE_MS after the attempt was completed or terminated.
 */
export function uploadWindow(
  attempt: { deviceCheckedAt: Date | null; startedAt: Date | null; completedAt: Date | null; terminatedAt: Date | null },
  now: number,
): UploadWindow {
  if (!attempt.deviceCheckedAt && !attempt.startedAt) return "NOT_STARTED";
  const ended = [attempt.completedAt, attempt.terminatedAt]
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  if (ended.length === 0) return "OPEN";
  return now - Math.min(...ended) <= UPLOAD_GRACE_MS ? "OPEN" : "CLOSED";
}

/**
 * The Range header a seeking <video> sends: `bytes=100-199` or `bytes=100-`.
 * Anything else is treated as no range (the whole file).
 */
export function parseByteRange(header: string | null): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] === "" ? Number.MAX_SAFE_INTEGER : Number(match[2]);
  if (!Number.isFinite(start) || end < start) return null;
  return { start, end };
}
