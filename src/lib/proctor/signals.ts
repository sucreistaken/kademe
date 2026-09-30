/**
 * Vision signal tracker. Pure state machines, no DOM and no model code.
 *
 * The face and phone models run in the browser a few times a second and are
 * noisy frame to frame: a face drops out for one frame when the candidate
 * scratches their nose, a phone is "seen" in a patterned shirt. Turning raw
 * frames straight into events would bury the teacher. Every signal therefore
 * needs its condition to hold for a while before it starts (onMs) and to be
 * absent for a while before it ends (offMs), so it cannot flicker.
 *
 * START and END carry the time the condition began to hold or to clear, not
 * the time we became sure. The interval then matches what happened on camera.
 */

export type SignalFrame = {
  t: number;
  faces: number;
  /** Head yaw in degrees, null when no face or the pose was not computed. */
  yawDeg: number | null;
  /** Head pitch in degrees; negative is looking down (see head-pose.ts). */
  pitchDeg: number | null;
  eyesAway: boolean;
  /** Phone detector confidence 0..1, null on frames the detector skipped. */
  phoneScore: number | null;
  /** Time of the last keystroke, used to excuse looking down while typing. */
  lastKeyAt: number | null;
};

export type SignalType = "NO_FACE" | "MULTIPLE_FACES" | "GAZE_AWAY" | "PHONE_DETECTED";

export type SignalEvent = { kind: "START" | "END"; type: SignalType; t: number };

export type SignalConfig = {
  noFaceOnMs: number;
  noFaceOffMs: number;
  multipleFacesOnMs: number;
  multipleFacesOffMs: number;
  gazeOnMs: number;
  gazeOffMs: number;
  gazeYawDeg: number;
  /** Pitch below this (looking down) counts as away unless the candidate is typing. */
  gazeDownPitchDeg: number;
  typingGraceMs: number;
  phoneThreshold: number;
  /** Hits needed among the last phoneWindow scored frames. */
  phoneHits: number;
  phoneWindow: number;
  phoneCooldownMs: number;
};

export const DEFAULT_SIGNAL_CONFIG: SignalConfig = {
  noFaceOnMs: 5_000,
  noFaceOffMs: 1_000,
  multipleFacesOnMs: 2_000,
  multipleFacesOffMs: 2_000,
  gazeOnMs: 5_000,
  gazeOffMs: 2_000,
  gazeYawDeg: 30,
  gazeDownPitchDeg: -20,
  typingGraceMs: 2_000,
  phoneThreshold: 0.4,
  phoneHits: 2,
  phoneWindow: 3,
  phoneCooldownMs: 20_000,
};

/**
 * A boolean condition with separate on and off delays. Returns the onset time
 * when the state flips, null otherwise.
 */
function hysteresis(onMs: number, offMs: number) {
  let active = false;
  let since: number | null = null; // start of the current run that would flip the state
  return (t: number, cond: boolean): { kind: "START" | "END"; t: number } | null => {
    const flipping = active ? !cond : cond;
    if (!flipping) {
      since = null;
      return null;
    }
    if (since === null) since = t;
    if (t - since < (active ? offMs : onMs)) return null;
    const at = since;
    active = !active;
    since = null;
    return { kind: active ? "START" : "END", t: at };
  };
}

export function createSignalTracker(config: Partial<SignalConfig> = {}) {
  const c: SignalConfig = { ...DEFAULT_SIGNAL_CONFIG, ...config };
  const noFace = hysteresis(c.noFaceOnMs, c.noFaceOffMs);
  const multi = hysteresis(c.multipleFacesOnMs, c.multipleFacesOffMs);
  const gaze = hysteresis(c.gazeOnMs, c.gazeOffMs);
  const phoneWindow: boolean[] = [];
  let lastPhoneAt: number | null = null;

  function gazeAway(f: SignalFrame): boolean {
    // Gaze needs exactly one face; the face-count signals cover the rest.
    if (f.faces !== 1) return false;
    const yawAway = f.yawDeg !== null && Math.abs(f.yawDeg) > c.gazeYawDeg;
    const lookingDown = f.pitchDeg !== null && f.pitchDeg < c.gazeDownPitchDeg;
    const typing = f.lastKeyAt !== null && f.t - f.lastKeyAt <= c.typingGraceMs;
    // Looking down at the keyboard while typing is the exam, not cheating. The
    // eye model reads it as "away" too, so both are excused together.
    if (lookingDown && typing) return yawAway;
    return yawAway || f.eyesAway || lookingDown;
  }

  function push(f: SignalFrame): SignalEvent[] {
    const out: SignalEvent[] = [];
    const emit = (type: SignalType, e: { kind: "START" | "END"; t: number } | null) => {
      if (e) out.push({ kind: e.kind, type, t: e.t });
    };

    emit("NO_FACE", noFace(f.t, f.faces === 0));
    emit("MULTIPLE_FACES", multi(f.t, f.faces >= 2));
    emit("GAZE_AWAY", gaze(f.t, gazeAway(f)));

    // The phone detector runs at a lower rate; only frames it scored count.
    if (f.phoneScore !== null) {
      phoneWindow.push(f.phoneScore >= c.phoneThreshold);
      if (phoneWindow.length > c.phoneWindow) phoneWindow.shift();
      const hits = phoneWindow.filter(Boolean).length;
      const cooled = lastPhoneAt === null || f.t - lastPhoneAt >= c.phoneCooldownMs;
      if (hits >= c.phoneHits && cooled) {
        lastPhoneAt = f.t;
        out.push({ kind: "START", type: "PHONE_DETECTED", t: f.t });
      }
    }
    return out;
  }

  return { push };
}

export type SignalTracker = ReturnType<typeof createSignalTracker>;
