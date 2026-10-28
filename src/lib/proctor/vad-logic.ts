/**
 * Voice activity decision. Pure logic; the audio graph that measures each
 * sample lives in the browser code.
 *
 * Two features per sample: band energy in the speech range (dB), and spectral
 * flatness (0 = pure tone, 1 = white noise). Speech is loud AND tonal. A
 * keyboard click is loud but broadband, and short, so it fails both the
 * flatness test and the open vote. The noise floor is calibrated per room at
 * the check step, because a quiet dorm and a busy kitchen differ by 20 dB,
 * and only ever rises from there when the room stays louder for a while.
 *
 * We only decide "someone is talking". Audio is never recorded or uploaded.
 */

import { windowedVote } from "./signals";

export type VadSample = {
  t: number;
  bandDb: number;
  /** Spectral flatness 0..1. */
  flatness: number;
};

export type VadOptions = {
  floorDb: number;
  marginDb?: number;
  /** Window the open vote is taken over. */
  openMs?: number;
  /** Window the close vote is taken over. */
  closeMs?: number;
  /** Share of voiced samples in the open window needed to open. */
  openRatio?: number;
  /** Share of voiced samples in the close window at or below which it closes. */
  closeRatio?: number;
  /** How far back the floor looks when it follows the room; 0 keeps the calibrated floor. */
  adaptMs?: number;
};

export const MAX_SPEECH_FLATNESS = 0.5;

/**
 * Share of the adaptive window that must be loud before the floor rises to it.
 * Talking has pauses, so a conversation never holds the floor up; a fan, an
 * air conditioner or a television left on does, and stops being "voice".
 */
const ADAPT_PERCENTILE = 0.1;

/**
 * 80th percentile of the calibration samples, linearly interpolated. Higher
 * than the median on purpose: the floor should include the room's ordinary
 * bumps (fan, traffic), so only a clear rise above it counts as voice.
 * Returns null when there is nothing to calibrate from.
 */
export function calibrateFloor(samplesDb: number[]): number | null {
  return percentile(samplesDb, 0.8);
}

function percentile(samples: number[], q: number): number | null {
  const xs = samples.filter(Number.isFinite).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const pos = q * (xs.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo);
}

export function createVad({
  floorDb,
  marginDb = 12,
  openMs = 1500,
  closeMs = 1000,
  openRatio = 0.6,
  closeRatio = 0.2,
  adaptMs = 30_000,
}: VadOptions) {
  // Speech is syllables with short gaps, so "voiced" flickers every 100 ms.
  // The decision is a majority over a window, not an unbroken run.
  const newVote = () => windowedVote(openMs, closeMs, openRatio, closeRatio);
  let vote = newVote();
  let open = false;
  let suppressed = false;
  // The floor only rises above the calibrated one: a room that got louder
  // after the check (a fan turned on) must not flag the whole exam.
  const history: Array<{ t: number; db: number }> = [];
  let floor = floorDb;

  function follow(s: VadSample) {
    if (adaptMs <= 0 || !Number.isFinite(s.bandDb)) return;
    history.push({ t: s.t, db: s.bandDb });
    while (history.length > 0 && history[0].t < s.t - adaptMs) history.shift();
    if (s.t - history[0].t < adaptMs / 2) return;
    const loud = percentile(history.map((h) => h.db), ADAPT_PERCENTILE);
    floor = Math.max(floorDb, loud ?? floorDb);
  }

  function push(s: VadSample): "START" | "END" | null {
    // While suppressed (the exam itself is playing audio, or the candidate is
    // on a speaking task) an open interval is closed and none can start. The
    // exam's own sound does not move the floor either.
    if (suppressed) {
      vote = newVote();
      if (open) {
        open = false;
        return "END";
      }
      return null;
    }

    follow(s);
    const voiced =
      Number.isFinite(s.bandDb) && s.bandDb > floor + marginDb && s.flatness < MAX_SPEECH_FLATNESS;
    const edge = vote(s.t, voiced);
    if (!edge) return null;
    open = edge.kind === "START";
    return edge.kind;
  }

  return {
    push,
    get suppressed() {
      return suppressed;
    },
    /** Takes effect on the next push, which returns END if voice was open. */
    set suppressed(value: boolean) {
      suppressed = value;
    },
    get open() {
      return open;
    },
    /** The floor in use now: the calibrated one, or higher if the room got louder. */
    get floorDb() {
      return floor;
    },
  };
}

export type Vad = ReturnType<typeof createVad>;
