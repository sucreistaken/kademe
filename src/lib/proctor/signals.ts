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
  /**
   * People the object detector counted (bodies, not faces), null when it did
   * not run. Catches a second person the face model misses: turned away, far
   * behind, or only partly in frame.
   */
  people?: number | null;
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
  /** Share of frames in the on window that must show two people to start. */
  multipleFacesOnRatio: number;
  /** Share of frames in the off window at or below which it ends. */
  multipleFacesOffRatio: number;
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
  // A second person half in frame is found on some frames and lost on others;
  // a strict run of frames never completes for them, a majority does.
  multipleFacesOnRatio: 0.6,
  multipleFacesOffRatio: 0.2,
  gazeOnMs: 5_000,
  gazeOffMs: 2_000,
  gazeYawDeg: 30,
  gazeDownPitchDeg: -20,
  typingGraceMs: 2_000,
  // 0.4 with 2 of 3 warned students who had no phone (2026-10-16): a hand or
  // a dark object near the face scores that high on efficientdet_lite0.
  phoneThreshold: 0.55,
  phoneHits: 3,
  phoneWindow: 4,
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

/**
 * A condition that flickers frame to frame, decided by majority over a time
 * window instead of an unbroken run. Starts when at least onRatio of the
 * frames in the last onMs hold and the current one does (so a run that has
 * just ended cannot start it late); ends when at most offRatio of the last
 * offMs hold and the current one does not. The window must be full first.
 * START is backdated to the first holding frame in the window, END to the
 * frame after the last holding one.
 */
export function windowedVote(onMs: number, offMs: number, onRatio: number, offRatio: number) {
  let active = false;
  let firstAt: number | null = null;
  const frames: Array<{ t: number; v: boolean }> = [];
  const span = Math.max(onMs, offMs);
  return (t: number, cond: boolean): { kind: "START" | "END"; t: number } | null => {
    if (firstAt === null) firstAt = t;
    frames.push({ t, v: cond });
    while (frames.length > 0 && frames[0].t < t - span) frames.shift();
    const windowMs = active ? offMs : onMs;
    if (t - firstAt < windowMs) return null;
    const recent = frames.filter((f) => f.t >= t - windowMs);
    const share = recent.filter((f) => f.v).length / recent.length;
    if (!active && cond && share >= onRatio) {
      active = true;
      return { kind: "START", t: recent.find((f) => f.v)!.t };
    }
    if (active && !cond && share <= offRatio) {
      active = false;
      let at = t;
      for (let i = frames.length - 1; i >= 0 && !frames[i].v; i--) at = frames[i].t;
      return { kind: "END", t: at };
    }
    return null;
  };
}

export function createSignalTracker(config: Partial<SignalConfig> = {}) {
  const c: SignalConfig = { ...DEFAULT_SIGNAL_CONFIG, ...config };
  const noFace = hysteresis(c.noFaceOnMs, c.noFaceOffMs);
  const multi = windowedVote(c.multipleFacesOnMs, c.multipleFacesOffMs, c.multipleFacesOnRatio, c.multipleFacesOffRatio);
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
    emit("MULTIPLE_FACES", multi(f.t, Math.max(f.faces, f.people ?? 0) >= 2));
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

export type PersonBox = {
  score: number;
  box?: { originX: number; originY: number; width: number; height: number };
};

/** A person box below this confidence is not counted. */
export const PERSON_MIN_SCORE = 0.5;
/** A box smaller than this share of the frame is a picture on the wall, not a person in the room. */
export const PERSON_MIN_AREA = 0.01;
/** A box at least this much inside a bigger one is the same body seen twice (a head inside a torso). */
const PERSON_SAME_BODY = 0.6;

/**
 * People in one object-detector result. The model sometimes returns the
 * candidate twice, as a head box inside a body box; those count once.
 */
export function countPeople(boxes: PersonBox[], frameArea: number): number {
  const area = (b: PersonBox) => (b.box ? b.box.width * b.box.height : 0);
  const kept = boxes
    .filter((b) => b.score >= PERSON_MIN_SCORE && b.box && frameArea > 0 && area(b) / frameArea >= PERSON_MIN_AREA)
    .sort((a, b) => area(b) - area(a));
  const people: PersonBox[] = [];
  for (const b of kept) {
    const inside = people.some((p) => overlap(b, p) / area(b) >= PERSON_SAME_BODY);
    if (!inside) people.push(b);
  }
  return people.length;
}

function overlap(a: PersonBox, b: PersonBox): number {
  if (!a.box || !b.box) return 0;
  const w = Math.min(a.box.originX + a.box.width, b.box.originX + b.box.width) - Math.max(a.box.originX, b.box.originX);
  const h = Math.min(a.box.originY + a.box.height, b.box.originY + b.box.height) - Math.max(a.box.originY, b.box.originY);
  return Math.max(0, w) * Math.max(0, h);
}
