/**
 * The panel player's arithmetic, kept apart from the DOM so it can be tested.
 *
 * Playback is driven by one wall clock (server time of the exam). Each kind of
 * recording is a track: its segments sorted by start. At any instant a track
 * either has the segment covering it or is in a gap (not recorded, a reload, a
 * lost upload), and the player shows the gap as a gap rather than sliding the
 * next file into it. That keeps camera and screen in step with each other and
 * with the proctor events, whatever went missing.
 */

import type { RecordingKind } from "@/lib/proctor/recording-rules";

export type PlaySegment = { id: string; kind: RecordingKind; start: number; end: number };

export type Tracks = Record<RecordingKind, PlaySegment[]>;

/**
 * Sorts each kind by start. The recorder opens the next file just before it
 * closes the previous one, so neighbours overlap by a few milliseconds; the
 * earlier segment is cut where the next one starts, so exactly one segment
 * covers any instant. A segment left with nothing (fully inside the next) is
 * dropped.
 */
export function buildTracks(
  segments: ReadonlyArray<{ id: string; kind: RecordingKind; start: number; durationMs: number }>,
): Tracks {
  const out: Tracks = { CAMERA: [], SCREEN: [] };
  const sorted = [...segments]
    .filter((s) => Number.isFinite(s.start) && s.durationMs > 0)
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  for (const s of sorted) {
    const track = out[s.kind];
    const prev = track.at(-1);
    if (prev && prev.end > s.start) {
      prev.end = s.start;
      if (prev.end <= prev.start) track.pop();
    }
    track.push({ id: s.id, kind: s.kind, start: s.start, end: s.start + s.durationMs });
  }
  return out;
}

/** Index of the segment covering `t` (start inclusive, end exclusive), or -1 in a gap. */
export function segmentIndexAt(track: readonly PlaySegment[], t: number): number {
  let lo = 0;
  let hi = track.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = track[mid];
    if (t < s.start) hi = mid - 1;
    else if (t >= s.end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/** Index of the first segment starting after `t`, or -1 when nothing follows. */
export function nextSegmentIndex(track: readonly PlaySegment[], t: number): number {
  let lo = 0;
  let hi = track.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (track[mid].start <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo < track.length ? lo : -1;
}

/** Seconds into segment `s` at wall time `t`, clamped to the segment. */
export function offsetSeconds(s: PlaySegment, t: number): number {
  return Math.max(0, Math.min(s.end, t) - s.start) / 1000;
}

/**
 * Recorded stretches for drawing: neighbours closer than `toleranceMs` are one
 * stretch, so the hand-over between two files does not draw as a gap.
 */
export function coverage(track: readonly PlaySegment[], toleranceMs = 1500): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (const s of track) {
    const last = out.at(-1);
    if (last && s.start - last.end <= toleranceMs) last.end = Math.max(last.end, s.end);
    else out.push({ start: s.start, end: s.end });
  }
  return out;
}

/** Total recorded milliseconds of one track. */
export function recordedMs(track: readonly PlaySegment[]): number {
  return track.reduce((sum, s) => sum + (s.end - s.start), 0);
}

/** The span the timeline draws: the attempt, widened to any recording outside it. */
export function timelineBounds(window: { start: number; end: number }, tracks: Tracks): { start: number; end: number } {
  const all = [...tracks.CAMERA, ...tracks.SCREEN];
  const start = Math.min(window.start, ...all.map((s) => s.start));
  const end = Math.max(window.end, ...all.map((s) => s.end));
  return { start, end: Math.max(end, start + 1) };
}

/**
 * Where playback goes from `t` when every track is in a gap: the next instant
 * any track has a recording, or null when nothing is left. Used to skip the
 * unrecorded stretches instead of playing minutes of empty panes.
 */
export function nextRecordedAt(tracks: Tracks, t: number): number | null {
  let best: number | null = null;
  for (const track of [tracks.CAMERA, tracks.SCREEN]) {
    if (segmentIndexAt(track, t) >= 0) return t;
    const i = nextSegmentIndex(track, t);
    if (i >= 0 && (best === null || track[i].start < best)) best = track[i].start;
  }
  return best;
}

/** `m:ss`, or `h:mm:ss` past an hour, for a duration in ms. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
