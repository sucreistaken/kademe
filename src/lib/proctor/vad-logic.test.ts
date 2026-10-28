import { describe, it, expect } from "vitest";
import { calibrateFloor, createVad, type VadSample } from "./vad-logic";

const STEP = 50;
const FLOOR = -60;
const quiet = { bandDb: -62, flatness: 0.8 };
const speech = { bandDb: -35, flatness: 0.2 };
const click = { bandDb: -30, flatness: 0.85 };

function play(
  segments: Array<[number, Omit<VadSample, "t"> | ((t: number) => Omit<VadSample, "t">)]>,
  vad = createVad({ floorDb: FLOOR }),
) {
  const out: Array<{ t: number; e: "START" | "END" }> = [];
  let t = 0;
  for (const [duration, s] of segments) {
    const end = t + duration;
    for (; t < end; t += STEP) {
      const sample = typeof s === "function" ? s(t) : s;
      const e = vad.push({ ...sample, t });
      if (e) out.push({ t, e });
    }
  }
  return out;
}

describe("calibrateFloor", () => {
  it("takes the 80th percentile", () => {
    expect(calibrateFloor([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBe(9);
    expect(calibrateFloor([-70, -60, -50, -40, -30])).toBeCloseTo(-38, 6);
  });

  it("is order-independent and ignores non-finite samples", () => {
    expect(calibrateFloor([5, -Infinity, 1, NaN, 3])).toBe(calibrateFloor([1, 3, 5]));
  });

  it("returns null for no samples", () => {
    expect(calibrateFloor([])).toBeNull();
    expect(calibrateFloor([-Infinity])).toBeNull();
  });
});

describe("createVad", () => {
  it("opens once most of 1.5 s is loud tonal energy and closes after 0.8 s of quiet", () => {
    const ev = play([[1000, quiet], [3000, speech], [1000, quiet]]);
    expect(ev).toEqual([
      { t: 1900, e: "START" },
      { t: 4800, e: "END" },
    ]);
  });

  it("opens on speech broken by short gaps between syllables", () => {
    // 200 ms voiced, 100 ms gap: a strict 1 s run never completes.
    const talking = (t: number) => (t % 300 < 200 ? speech : quiet);
    const ev = play([[1000, quiet], [6000, talking], [2000, quiet]]);
    expect(ev.map((x) => x.e)).toEqual(["START", "END"]);
  });

  it("ignores a sound that holds tonal energy only now and then", () => {
    const sparse = (t: number) => (t % 1000 < 300 ? speech : quiet);
    expect(play([[10_000, sparse]])).toEqual([]);
  });

  it("stops flagging a room that stays loud, and still hears a voice above it", () => {
    // A television comes on at -45 dB and stays on.
    const tv = { bandDb: -45, flatness: 0.3 };
    const vad = createVad({ floorDb: FLOOR });
    const ev = play([[1000, quiet], [40_000, tv]], vad);
    expect(ev.map((x) => x.e)).toEqual(["START", "END"]);
    expect(vad.floorDb).toBeCloseTo(-45, 6);
    // A voice 12 dB above the television still opens.
    const t0 = 41_000;
    let started: string | null = null;
    for (let t = t0; t < t0 + 3000 && !started; t += STEP) started = vad.push({ t, bandDb: -30, flatness: 0.2 });
    expect(started).toBe("START");
  });

  it("keeps the floor through a long conversation", () => {
    const talking = (t: number) => (t % 3000 < 2000 ? speech : quiet);
    const vad = createVad({ floorDb: FLOOR });
    play([[60_000, talking]], vad);
    expect(vad.floorDb).toBe(FLOOR);
  });

  it("never lowers the floor below the calibrated one", () => {
    const vad = createVad({ floorDb: FLOOR });
    play([[40_000, { bandDb: -80, flatness: 0.8 }]], vad);
    expect(vad.floorDb).toBe(FLOOR);
  });

  it("ignores typing bursts: loud but flat and short", () => {
    // 80 ms clicks every 250 ms for 10 seconds.
    const typing = (t: number) => (t % 250 < 80 ? click : quiet);
    expect(play([[10_000, typing]])).toEqual([]);
  });

  it("ignores sustained broadband noise, such as a fan or a hoover", () => {
    expect(play([[5000, { bandDb: -30, flatness: 0.7 }]])).toEqual([]);
  });

  it("ignores tonal sound below the margin", () => {
    // Floor -60 + margin 12 = -48; -50 is not enough.
    expect(play([[5000, { bandDb: -50, flatness: 0.1 }]])).toEqual([]);
  });

  it("ignores a short spoken word", () => {
    expect(play([[900, speech], [2000, quiet]])).toEqual([]);
  });

  it("does not close on a brief pause between words", () => {
    const ev = play([[2000, speech], [500, quiet], [2000, speech], [1000, quiet]]);
    expect(ev.map((x) => x.e)).toEqual(["START", "END"]);
  });

  it("honours custom margin and timings", () => {
    const vad = createVad({ floorDb: FLOOR, marginDb: 30, openMs: 200, closeMs: 200 });
    expect(play([[1000, speech]], vad)).toEqual([]); // -35 is not above -30
    const vad2 = createVad({ floorDb: FLOOR, marginDb: 20, openMs: 200, closeMs: 200, openRatio: 1, closeRatio: 0 });
    expect(play([[1000, speech], [500, quiet]], vad2)).toEqual([
      { t: 200, e: "START" },
      { t: 1200, e: "END" },
    ]);
  });

  it("never starts while suppressed", () => {
    const vad = createVad({ floorDb: FLOOR });
    vad.suppressed = true;
    expect(play([[5000, speech]], vad)).toEqual([]);
    expect(vad.open).toBe(false);
  });

  it("ends an open interval as soon as it is suppressed, and can restart after", () => {
    const vad = createVad({ floorDb: FLOOR });
    const first = play([[2000, speech]], vad);
    expect(first.map((x) => x.e)).toEqual(["START"]);
    vad.suppressed = true;
    expect(vad.push({ t: 2050, ...speech })).toBe("END");
    expect(vad.push({ t: 2100, ...speech })).toBeNull();
    vad.suppressed = false;
    let started: string | null = null;
    for (let t = 2150; t <= 3700 && !started; t += STEP) started = vad.push({ t, ...speech });
    expect(started).toBe("START");
  });
});
