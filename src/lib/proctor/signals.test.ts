import { describe, it, expect } from "vitest";
import { countPeople, createSignalTracker, type SignalEvent, type SignalFrame } from "./signals";

const STEP = 200;

const calm: Omit<SignalFrame, "t"> = {
  faces: 1,
  yawDeg: 0,
  pitchDeg: 0,
  eyesAway: false,
  phoneScore: null,
  lastKeyAt: null,
};

/** Feed segments of [durationMs, frame overrides] at a fixed frame rate. */
function play(
  segments: Array<[number, Partial<SignalFrame> | ((t: number) => Partial<SignalFrame>)]>,
  tracker = createSignalTracker(),
): SignalEvent[] {
  const out: SignalEvent[] = [];
  let t = 0;
  for (const [duration, over] of segments) {
    const end = t + duration;
    for (; t < end; t += STEP) {
      const o = typeof over === "function" ? over(t) : over;
      out.push(...tracker.push({ ...calm, ...o, t }));
    }
  }
  return out;
}

const only = (events: SignalEvent[], type: SignalEvent["type"]) =>
  events.filter((e) => e.type === type);

describe("NO_FACE", () => {
  it("ignores a face lost for less than 5 seconds", () => {
    const ev = play([[1000, {}], [4600, { faces: 0 }], [3000, {}]]);
    expect(only(ev, "NO_FACE")).toEqual([]);
  });

  it("starts after 5 seconds without a face, backdated to the onset", () => {
    const ev = play([[1000, {}], [6000, { faces: 0 }], [2000, {}]]);
    expect(only(ev, "NO_FACE")).toEqual([
      { kind: "START", type: "NO_FACE", t: 1000 },
      { kind: "END", type: "NO_FACE", t: 7000 },
    ]);
  });

  it("does not end on a single-frame face flicker", () => {
    const ev = play([
      [6000, { faces: 0 }],
      [400, {}],
      [3000, { faces: 0 }],
      [1200, {}],
    ]);
    const nf = only(ev, "NO_FACE");
    expect(nf).toEqual([
      { kind: "START", type: "NO_FACE", t: 0 },
      { kind: "END", type: "NO_FACE", t: 9400 },
    ]);
  });
});

describe("MULTIPLE_FACES", () => {
  it("starts after 2 seconds with two faces and ends after 2 seconds with one", () => {
    const ev = play([[1000, {}], [3000, { faces: 2 }], [1000, {}], [1000, { faces: 3 }], [2200, {}]]);
    expect(only(ev, "MULTIPLE_FACES")).toEqual([
      { kind: "START", type: "MULTIPLE_FACES", t: 1000 },
      { kind: "END", type: "MULTIPLE_FACES", t: 6000 },
    ]);
  });

  it("ignores a second face that passes by", () => {
    expect(only(play([[1800, { faces: 2 }], [3000, {}]]), "MULTIPLE_FACES")).toEqual([]);
  });

  it("starts on a second face the model finds only on most frames", () => {
    // Found on 3 of every 4 frames: a strict run never lasts 2 seconds.
    const flicker = (t: number) => ({ faces: (t / STEP) % 4 === 3 ? 1 : 2 });
    const ev = only(play([[1000, {}], [5000, flicker], [3000, {}]]), "MULTIPLE_FACES");
    expect(ev.map((e) => e.kind)).toEqual(["START", "END"]);
    expect(ev[0].t).toBe(1000);
    expect(ev[1].t).toBe(6000);
  });

  it("ignores a second face seen on a few scattered frames", () => {
    const rare = (t: number) => ({ faces: (t / STEP) % 4 === 0 ? 2 : 1 });
    expect(only(play([[10_000, rare]]), "MULTIPLE_FACES")).toEqual([]);
  });

  it("counts a second body the face model does not see", () => {
    const ev = play([[1000, {}], [4000, { people: 2 }], [3000, { people: 1 }]]);
    expect(only(ev, "MULTIPLE_FACES")).toEqual([
      { kind: "START", type: "MULTIPLE_FACES", t: 1000 },
      { kind: "END", type: "MULTIPLE_FACES", t: 5000 },
    ]);
    expect(only(ev, "GAZE_AWAY")).toEqual([]);
  });

  it("does not fire NO_FACE or GAZE_AWAY for a crowd", () => {
    const ev = play([[8000, { faces: 2, yawDeg: 60 }]]);
    expect(only(ev, "NO_FACE")).toEqual([]);
    expect(only(ev, "GAZE_AWAY")).toEqual([]);
  });
});

describe("GAZE_AWAY", () => {
  it("starts after 5 seconds of head turned away and ends 2 seconds after looking back", () => {
    const ev = play([[1000, {}], [6000, { yawDeg: -45 }], [2200, {}]]);
    expect(only(ev, "GAZE_AWAY")).toEqual([
      { kind: "START", type: "GAZE_AWAY", t: 1000 },
      { kind: "END", type: "GAZE_AWAY", t: 7000 },
    ]);
  });

  it("fires on eyes away alone", () => {
    const ev = play([[6000, { eyesAway: true }]]);
    expect(only(ev, "GAZE_AWAY")).toEqual([{ kind: "START", type: "GAZE_AWAY", t: 0 }]);
  });

  it("ignores a moderate head turn and a short glance", () => {
    expect(only(play([[10_000, { yawDeg: 25 }]]), "GAZE_AWAY")).toEqual([]);
    expect(only(play([[4000, { yawDeg: 60 }], [3000, {}]]), "GAZE_AWAY")).toEqual([]);
  });

  it("excuses looking down while typing", () => {
    // Keystroke every 600 ms, head down, eye model says away.
    const typing = (t: number) => ({
      pitchDeg: -35,
      eyesAway: true,
      lastKeyAt: t - (t % 600),
    });
    expect(only(play([[20_000, typing]]), "GAZE_AWAY")).toEqual([]);
  });

  it("flags looking down when not typing", () => {
    const ev = play([[6000, { pitchDeg: -35, lastKeyAt: null }]]);
    expect(only(ev, "GAZE_AWAY")).toEqual([{ kind: "START", type: "GAZE_AWAY", t: 0 }]);
  });

  it("flags looking down once typing stopped more than 2 seconds ago", () => {
    const ev = play([[8000, { pitchDeg: -35, lastKeyAt: 0 }]]);
    // Typing grace covers t=0..2000; the away run begins at 2200.
    expect(only(ev, "GAZE_AWAY")).toEqual([{ kind: "START", type: "GAZE_AWAY", t: 2200 }]);
  });

  it("does not excuse a sideways turn while typing", () => {
    const typingSideways = (t: number) => ({ pitchDeg: -35, yawDeg: 50, lastKeyAt: t });
    expect(only(play([[6000, typingSideways]]), "GAZE_AWAY")).toHaveLength(1);
  });
});

describe("PHONE_DETECTED", () => {
  // Detector scores every 5th frame (once a second at 5 fps).
  const scored = (scores: number[]) => (t: number) => {
    const i = t / STEP;
    return { phoneScore: i % 5 === 0 ? (scores[i / 5] ?? 0) : null };
  };

  it("needs 3 hits among the last 4 scored frames", () => {
    const ev = play([[10_000, scored([0.9, 0.9, 0.1, 0.1, 0.9, 0.1, 0.9, 0.1])]]);
    expect(only(ev, "PHONE_DETECTED")).toEqual([]);
  });

  it("ignores weak scores", () => {
    const ev = play([[10_000, scored(Array(10).fill(0.45))]]);
    expect(only(ev, "PHONE_DETECTED")).toEqual([]);
  });

  it("fires instantly on the third hit, skipping unscored frames", () => {
    const ev = play([[10_000, scored([0.1, 0.6, 0.2, 0.7, 0.8])]]);
    expect(only(ev, "PHONE_DETECTED")).toEqual([
      { kind: "START", type: "PHONE_DETECTED", t: 4000 },
    ]);
  });

  it("only ever emits START", () => {
    const ev = play([[60_000, scored(Array(60).fill(0.9))]]);
    expect(only(ev, "PHONE_DETECTED").every((e) => e.kind === "START")).toBe(true);
  });

  it("waits 20 seconds before firing again", () => {
    const ev = play([[45_000, scored(Array(45).fill(0.9))]]);
    expect(only(ev, "PHONE_DETECTED").map((e) => e.t)).toEqual([2000, 22_000, 42_000]);
  });

  it("respects a config override", () => {
    const tracker = createSignalTracker({ phoneThreshold: 0.95 });
    const ev = play([[10_000, scored(Array(10).fill(0.9))]], tracker);
    expect(only(ev, "PHONE_DETECTED")).toEqual([]);
  });
});

describe("countPeople", () => {
  const FRAME = 640 * 360;
  const box = (originX: number, originY: number, width: number, height: number, score = 0.8) => ({
    score,
    box: { originX, originY, width, height },
  });

  it("counts two separate people", () => {
    expect(countPeople([box(50, 20, 200, 340), box(420, 60, 150, 300)], FRAME)).toBe(2);
  });

  it("counts a head box inside the candidate's body box once", () => {
    expect(countPeople([box(100, 0, 400, 360), box(220, 10, 150, 160)], FRAME)).toBe(1);
  });

  it("skips weak and tiny boxes", () => {
    expect(countPeople([box(100, 0, 400, 360), box(500, 50, 100, 200, 0.4)], FRAME)).toBe(1);
    // 20 x 40 px is a photo on the wall.
    expect(countPeople([box(100, 0, 400, 360), box(560, 20, 20, 40)], FRAME)).toBe(1);
  });

  it("returns 0 for nothing usable", () => {
    expect(countPeople([], FRAME)).toBe(0);
    expect(countPeople([{ score: 0.9 }], FRAME)).toBe(0);
  });
});
