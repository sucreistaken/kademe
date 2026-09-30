import { describe, it, expect } from "vitest";
import { createSignalTracker, type SignalEvent, type SignalFrame } from "./signals";

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

  it("needs 2 hits among the last 3 scored frames", () => {
    const ev = play([[10_000, scored([0.9, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1])]]);
    expect(only(ev, "PHONE_DETECTED")).toEqual([]);
  });

  it("fires instantly on the second hit, skipping unscored frames", () => {
    const ev = play([[10_000, scored([0.1, 0.5, 0.2, 0.6])]]);
    expect(only(ev, "PHONE_DETECTED")).toEqual([
      { kind: "START", type: "PHONE_DETECTED", t: 3000 },
    ]);
  });

  it("only ever emits START", () => {
    const ev = play([[60_000, scored(Array(60).fill(0.9))]]);
    expect(only(ev, "PHONE_DETECTED").every((e) => e.kind === "START")).toBe(true);
  });

  it("waits 20 seconds before firing again", () => {
    const ev = play([[45_000, scored(Array(45).fill(0.9))]]);
    expect(only(ev, "PHONE_DETECTED").map((e) => e.t)).toEqual([1000, 21_000, 41_000]);
  });

  it("respects a config override", () => {
    const tracker = createSignalTracker({ phoneThreshold: 0.95 });
    const ev = play([[10_000, scored(Array(10).fill(0.9))]], tracker);
    expect(only(ev, "PHONE_DETECTED")).toEqual([]);
  });
});
