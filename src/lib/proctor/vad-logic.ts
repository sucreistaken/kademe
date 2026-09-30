/**
 * Voice activity decision. Pure logic; the audio graph that measures each
 * sample lives in the browser code.
 *
 * Two features per sample: band energy in the speech range (dB), and spectral
 * flatness (0 = pure tone, 1 = white noise). Speech is loud AND tonal. A
 * keyboard click is loud but broadband, and short, so it fails both the
 * flatness test and the openMs hold. The noise floor is calibrated per room at
 * the check step, because a quiet dorm and a busy kitchen differ by 20 dB.
 *
 * We only decide "someone is talking". Audio is never recorded or uploaded.
 */

export type VadSample = {
  t: number;
  bandDb: number;
  /** Spectral flatness 0..1. */
  flatness: number;
};

export type VadOptions = {
  floorDb: number;
  marginDb?: number;
  openMs?: number;
  closeMs?: number;
};

export const MAX_SPEECH_FLATNESS = 0.5;

/**
 * 80th percentile of the calibration samples, linearly interpolated. Higher
 * than the median on purpose: the floor should include the room's ordinary
 * bumps (fan, traffic), so only a clear rise above it counts as voice.
 * Returns null when there is nothing to calibrate from.
 */
export function calibrateFloor(samplesDb: number[]): number | null {
  const xs = samplesDb.filter(Number.isFinite).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const pos = 0.8 * (xs.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo);
}

export function createVad({ floorDb, marginDb = 12, openMs = 1000, closeMs = 800 }: VadOptions) {
  const threshold = floorDb + marginDb;
  let open = false;
  let since: number | null = null;
  let suppressed = false;

  function push(s: VadSample): "START" | "END" | null {
    // While suppressed (the exam itself is playing audio, or the candidate is
    // on a speaking task) an open interval is closed and none can start.
    if (suppressed) {
      since = null;
      if (open) {
        open = false;
        return "END";
      }
      return null;
    }

    const voiced =
      Number.isFinite(s.bandDb) && s.bandDb > threshold && s.flatness < MAX_SPEECH_FLATNESS;
    const flipping = open ? !voiced : voiced;
    if (!flipping) {
      since = null;
      return null;
    }
    if (since === null) since = s.t;
    if (s.t - since < (open ? closeMs : openMs)) return null;
    open = !open;
    since = null;
    return open ? "START" : "END";
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
  };
}

export type Vad = ReturnType<typeof createVad>;
