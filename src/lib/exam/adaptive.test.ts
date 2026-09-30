import { describe, expect, it } from "vitest";
import {
  eap,
  initialState,
  mulberry32,
  replay,
  selectNext,
  shouldStop,
  simulate,
  type AdaptiveConfig,
  type PoolItem,
} from "./adaptive";
import { BAND_CENTER, levelFromTheta, thetaForLevel } from "./cefr";
import { CEFR_LEVELS } from "./types";

const config: AdaptiveConfig = {
  minItems: 10,
  maxItems: 18,
  targetSe: 0.45,
  priorMean: -0.5,
  priorSd: 1.5,
  randomesque: 3,
};

/** Twelve items per level, three per position in the band, four skill tags. */
function grammarPool(): PoolItem[] {
  const pool: PoolItem[] = [];
  for (const level of CEFR_LEVELS) {
    for (let i = 0; i < 12; i++) {
      const within = (["EASY", "MID", "HARD"] as const)[i % 3];
      pool.push({
        id: `${level}-${i}`,
        b: thetaForLevel(level, within),
        skillTag: `tag${i % 4}`,
        stimulusId: null,
        orderInStimulus: 0,
      });
    }
  }
  return pool;
}

describe("EAP", () => {
  it("returns the prior with no answers", () => {
    const p = eap([], { mean: 0, sd: 1 });
    expect(p.mean).toBeCloseTo(0, 2);
    expect(p.sd).toBeCloseTo(1, 1);
  });

  it("moves up on correct answers and down on wrong ones, and stays finite", () => {
    const up = eap(Array(10).fill({ b: 0, score: 1 }), { mean: 0, sd: 1.5 });
    const down = eap(Array(10).fill({ b: 0, score: 0 }), { mean: 0, sd: 1.5 });
    expect(up.mean).toBeGreaterThan(1);
    expect(down.mean).toBeLessThan(-1);
    expect(Number.isFinite(up.mean)).toBe(true);
  });

  it("treats half credit as between right and wrong", () => {
    const half = eap([{ b: 0, score: 0.5 }], { mean: 0, sd: 1 });
    expect(half.mean).toBeCloseTo(0, 2);
  });

  it("narrows as evidence accumulates", () => {
    const few = eap(Array(4).fill({ b: 0, score: 0.5 }), { mean: 0, sd: 1.5 });
    const many = eap(Array(20).fill({ b: 0, score: 0.5 }), { mean: 0, sd: 1.5 });
    expect(many.sd).toBeLessThan(few.sd);
  });
});

describe("selection", () => {
  it("picks near the current estimate", () => {
    const pool = grammarPool();
    const state = { ...initialState(config), posterior: { mean: BAND_CENTER.C1, sd: 1 } };
    const next = selectNext(state, pool, { ...config, randomesque: 1 }, mulberry32(1))!;
    expect(next.itemIds[0].startsWith("C1")).toBe(true);
  });

  it("never serves an item twice", () => {
    const pool = grammarPool();
    const rng = mulberry32(7);
    const seen = new Set<string>();
    const responses: Parameters<typeof replay>[1] = [];
    for (let n = 0; n < 40; n++) {
      const next = selectNext(replay({ ...config, maxItems: 100 }, responses), pool, { ...config, maxItems: 100 }, rng);
      if (!next) break;
      for (const id of next.itemIds) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
        responses.push({ itemId: id, b: 0, skillTag: "x", stimulusId: null, score: 1 });
      }
    }
  });

  it("serves a testlet whole and in order, and never reopens its stimulus", () => {
    const pool: PoolItem[] = [
      { id: "t1-2", b: 0, skillTag: "r", stimulusId: "t1", orderInStimulus: 2 },
      { id: "t1-1", b: 0, skillTag: "r", stimulusId: "t1", orderInStimulus: 1 },
      { id: "t2-1", b: 3, skillTag: "r", stimulusId: "t2", orderInStimulus: 1 },
    ];
    const first = selectNext(initialState({ ...config, priorMean: 0 }), pool, { ...config, randomesque: 1 }, mulberry32(1))!;
    expect(first.itemIds).toEqual(["t1-1", "t1-2"]);
    const state = replay(config, [
      { itemId: "t1-1", b: 0, skillTag: "r", stimulusId: "t1", score: 1 },
    ]);
    const second = selectNext(state, pool, config, mulberry32(1))!;
    expect(second.itemIds).toEqual(["t2-1"]);
  });
});

describe("stopping", () => {
  it("stops at max items", () => {
    const state = { ...initialState(config), answered: config.maxItems };
    expect(shouldStop(state, config, 10)).toBe("MAX_ITEMS");
  });

  it("does not stop on precision before the minimum", () => {
    const state = { ...initialState(config), answered: 3, posterior: { mean: 0, sd: 0.1 } };
    expect(shouldStop(state, config, 10)).toBe(null);
  });

  it("stops when the pool is empty", () => {
    expect(shouldStop(initialState(config), config, 0)).toBe("POOL_EXHAUSTED");
  });
});

describe("simulated students", () => {
  it("places students at every band centre within one level, and usually exactly", () => {
    const pool = grammarPool();
    const rng = mulberry32(2026);
    for (const level of CEFR_LEVELS) {
      let exact = 0;
      let withinOne = 0;
      const runs = 200;
      for (let r = 0; r < runs; r++) {
        const result = simulate(BAND_CENTER[level], pool, config, rng);
        const got = levelFromTheta(result.posterior.mean).level;
        const diff = Math.abs(CEFR_LEVELS.indexOf(got) - CEFR_LEVELS.indexOf(level));
        if (diff === 0) exact++;
        if (diff <= 1) withinOne++;
      }
      expect(withinOne / runs, `${level} within one`).toBeGreaterThanOrEqual(0.9);
      expect(exact / runs, `${level} exact`).toBeGreaterThanOrEqual(0.5);
    }
  });
});
