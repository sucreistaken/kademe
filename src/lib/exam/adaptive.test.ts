import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CLOZE_GUESS,
  eap,
  guessOf,
  initialState,
  itemWeight,
  mulberry32,
  observationOf,
  pCorrect,
  poolLeft,
  pWithGuess,
  replay,
  replayResponseOf,
  selectNext,
  shouldStop,
  simulate,
  type AdaptiveConfig,
  type Observation,
  type PoolItem,
  type Posterior,
} from "./adaptive";
import { BAND_CENTER, levelFromTheta, thetaForLevel } from "./cefr";
import { C_TEST_SKILL_TAG, CEFR_LEVELS, CLOZE_SKILL_TAG, WORD_BANK_SKILL_TAG, type ItemSnapshot } from "./types";

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

describe("C-tests", () => {
  it("are never picked by automatic selection, even when their tag is the freshest", () => {
    const pool: PoolItem[] = [
      ...grammarPool(),
      ...CEFR_LEVELS.map((l) => ({ id: `ctest-${l}`, b: thetaForLevel(l), skillTag: C_TEST_SKILL_TAG, stimulusId: null, orderInStimulus: 0 })),
    ];
    const big = { ...config, maxItems: 200 };
    const rng = mulberry32(11);
    const responses: Parameters<typeof replay>[1] = [];
    for (;;) {
      const next = selectNext(replay(big, responses), pool, big, rng);
      if (!next) break;
      for (const id of next.itemIds) {
        expect(id.startsWith("ctest")).toBe(false);
        const item = pool.find((p) => p.id === id)!;
        responses.push({ itemId: id, b: item.b, skillTag: item.skillTag, stimulusId: null, score: rng() < 0.5 ? 1 : 0 });
      }
    }
    // The whole non-C-test pool was served, and nothing else.
    expect(responses.length).toBe(grammarPool().length);
    expect(poolLeft(pool, replay(big, responses))).toBe(0);
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
    // 1200 simulated exams take about 0.5 s alone but up to 5.9 s in the full parallel suite, past vitest's
    // 5 s default; the assertions pass either way (checked 2026-10-23 with --testTimeout=60000).
  }, 30_000);
});

describe("weighted observations", () => {
  const prior = { mean: 0, sd: 1.5 };
  const gapContent = (n: number) => ({ kind: "GAP" as const, gaps: Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}` })) });

  it("weight 1 is the same as no weight", () => {
    expect(eap([{ b: 0.5, score: 0.6, weight: 1 }], prior)).toEqual(eap([{ b: 0.5, score: 0.6 }], prior));
  });

  it("weight 5 is the same as five copies of the observation", () => {
    const one = eap([{ b: 0.5, score: 0.6, weight: 5 }], prior);
    const five = eap(Array.from({ length: 5 }, () => ({ b: 0.5, score: 0.6 })), prior);
    expect(one.mean).toBeCloseTo(five.mean, 10);
    expect(one.sd).toBeCloseTo(five.sd, 10);
  });

  it("a C-test weighs its gaps / 4, at least 1; every other item weighs 1", () => {
    expect(itemWeight({ skillTag: C_TEST_SKILL_TAG, content: gapContent(20) }, true)).toBe(5);
    expect(itemWeight({ skillTag: C_TEST_SKILL_TAG, content: gapContent(18) }, true)).toBe(4.5);
    expect(itemWeight({ skillTag: C_TEST_SKILL_TAG, content: gapContent(2) }, true)).toBe(1);
    expect(itemWeight({ skillTag: "grammar.dativ", content: gapContent(20) }, true)).toBe(1);
    expect(itemWeight({ skillTag: "grammar.dativ", content: { kind: "CHOICE", options: [] } }, true)).toBe(1);
  });

  it("without weighCTests every item weighs 1, even a 20-gap C-test (exams taken before 2026-10-15)", () => {
    expect(itemWeight({ skillTag: C_TEST_SKILL_TAG, content: gapContent(20) }, false)).toBe(1);
  });

  it("observationOf and replayResponseOf carry the snapshot's difficulty and weight", () => {
    const snapshot = { difficulty: -0.5, skillTag: C_TEST_SKILL_TAG, content: gapContent(20), stimulusId: null } as unknown as ItemSnapshot;
    expect(observationOf(snapshot, 0.7, true)).toEqual({ b: -0.5, score: 0.7, weight: 5 });
    expect(replayResponseOf({ itemId: "x", itemSnapshot: snapshot, score: 0.7 }, true)).toEqual({
      itemId: "x", b: -0.5, skillTag: C_TEST_SKILL_TAG, stimulusId: null, score: 0.7, weight: 5,
    });
    expect(observationOf(snapshot, 0.7, false)).toEqual({ b: -0.5, score: 0.7, weight: 1 });
    expect(replayResponseOf({ itemId: "x", itemSnapshot: snapshot, score: 0.7 }, false).weight).toBe(1);
  });

  it("replay uses the weight", () => {
    const cfg = { minItems: 1, maxItems: 10, targetSe: 0.3, priorMean: 0, priorSd: 1.5, randomesque: 1 };
    const base = { itemId: "c", b: 0, skillTag: C_TEST_SKILL_TAG, stimulusId: null, score: 0.9 };
    const heavy = replay(cfg, [{ ...base, weight: 5 }]).posterior;
    const light = replay(cfg, [base]).posterior;
    expect(heavy.sd).toBeLessThan(light.sd);
    expect(heavy.mean).toBeGreaterThan(light.mean);
  });

  it("every estimate built from stored responses goes through observationOf or replayResponseOf", () => {
    for (const url of [new URL("../exam-flow.ts", import.meta.url), new URL("./reestimate-run.ts", import.meta.url)]) {
      expect(readFileSync(url, "utf8"), url.pathname).not.toMatch(/itemSnapshot\.difficulty/);
    }
  });
});

describe("guessing floor (spec 2026-10-18)", () => {
  const prior = { mean: -0.5, sd: 1.5 };
  /** The EAP exactly as it was before the floor (commit 55ce992), frozen for the regression below. */
  function eapBefore(observations: Array<{ b: number; score: number; weight?: number }>, p: Posterior): Posterior {
    const grid = Array.from({ length: 81 }, (_, i) => -4 + i * 0.1);
    const logPost = grid.map((theta) => {
      const z = (theta - p.mean) / p.sd;
      let lp = -0.5 * z * z;
      for (const o of observations) {
        const q = Math.min(1 - 1e-9, Math.max(1e-9, 1 / (1 + Math.exp(-(theta - o.b)))));
        const sc = Math.min(1, Math.max(0, o.score));
        lp += (o.weight ?? 1) * (sc * Math.log(q) + (1 - sc) * Math.log(1 - q));
      }
      return lp;
    });
    const max = Math.max(...logPost);
    const w = logPost.map((lp) => Math.exp(lp - max));
    const total = w.reduce((a, b) => a + b, 0);
    const mean = grid.reduce((acc, theta, i) => acc + theta * w[i], 0) / total;
    const variance = grid.reduce((acc, theta, i) => acc + (theta - mean) ** 2 * w[i], 0) / total;
    return { mean, sd: Math.sqrt(variance) };
  }
  const fixture: Observation[] = [
    { b: -2.5, score: 1 },
    { b: -1.5, score: 0.75, weight: 5 },
    { b: -0.5, score: 0.4, weight: 4.5 },
    { b: 0.5, score: 0 },
    { b: 0.5, score: 1 },
    { b: 1.5, score: 0.1, weight: 3 },
    { b: 2.5, score: 0 },
  ];

  it("guess 0 or none gives the same posterior, to the last bit, as the EAP before the floor", () => {
    const before = eapBefore(fixture, prior);
    expect(eap(fixture, prior)).toEqual(before);
    expect(eap(fixture.map((o) => ({ ...o, guess: 0 })), prior)).toEqual(before);
    expect(pWithGuess(0.3, -0.2, 0)).toBe(pCorrect(0.3, -0.2));
  });

  it("the floor makes a right answer count for less: a quarter right on a cloze is chance, not ability", () => {
    const chance = [{ b: thetaForLevel("B1"), score: 0.25, weight: 3 }];
    expect(eap(chance.map((o) => ({ ...o, guess: CLOZE_GUESS })), prior).mean).toBeLessThan(eap(chance, prior).mean);
    expect(pWithGuess(-10, 0, 0.25)).toBeCloseTo(0.25, 3);
    expect(pWithGuess(10, 0, 0.25)).toBeCloseTo(1, 3);
  });

  const gapItem = (skillTag: string, gaps: number, distractors?: string[]) =>
    ({
      difficulty: -0.5,
      skillTag,
      stimulusId: null,
      content: { kind: "GAP", gaps: Array.from({ length: gaps }, (_, i) => ({ id: `g${i + 1}`, ...(skillTag === CLOZE_SKILL_TAG ? { choices: ["a", "b", "c", "d"] } : {}) })) },
      key: { kind: "GAP", answers: Object.fromEntries(Array.from({ length: gaps }, (_, i) => [`g${i + 1}`, [`w${i}`]])), ...(distractors ? { distractors } : {}) },
    }) as unknown as ItemSnapshot;

  it("guessOf: a quarter for a cloze, one over the pool for a word bank, 0 for a C-test and every other item", () => {
    expect(guessOf(gapItem(CLOZE_SKILL_TAG, 12))).toBe(0.25);
    expect(guessOf(gapItem(WORD_BANK_SKILL_TAG, 8, ["x", "y", "z", "v"]))).toBe(1 / 12);
    expect(guessOf(gapItem(C_TEST_SKILL_TAG, 20, ["x"]))).toBe(0);
    expect(guessOf(gapItem("grammar.dativ", 2))).toBe(0);
  });

  it("guessOf: a third for a cloze whose gaps have three choices (course tests, spec 2026-10-28)", () => {
    const abc = gapItem(CLOZE_SKILL_TAG, 6) as unknown as { content: { gaps: Array<{ id: string; choices?: string[] }> } };
    abc.content.gaps = abc.content.gaps.map((g) => ({ ...g, choices: ["a", "b", "c"] }));
    expect(guessOf(abc as unknown as ItemSnapshot)).toBeCloseTo(1 / 3, 12);
  });

  it("observationOf and replayResponseOf carry the floor and the text weight for both new kinds", () => {
    const cloze = gapItem(CLOZE_SKILL_TAG, 12);
    expect(observationOf(cloze, 0.5, true)).toEqual({ b: -0.5, score: 0.5, weight: 3, guess: 0.25 });
    expect(observationOf(cloze, 0.5, false)).toEqual({ b: -0.5, score: 0.5, weight: 1, guess: 0.25 });
    const bank = gapItem(WORD_BANK_SKILL_TAG, 8, ["x", "y", "z", "v"]);
    expect(replayResponseOf({ itemId: "b", itemSnapshot: bank, score: 0.5 }, true)).toEqual({
      itemId: "b", b: -0.5, skillTag: WORD_BANK_SKILL_TAG, stimulusId: null, score: 0.5, weight: 2, guess: 1 / 12,
    });
    expect(itemWeight(cloze, true)).toBe(3);
    expect(itemWeight(bank, true)).toBe(2);
    expect(itemWeight(bank, false)).toBe(1);
    // The C-test and every older item carry no floor field at all.
    expect(observationOf(gapItem(C_TEST_SKILL_TAG, 20), 0.7, true)).toEqual({ b: -0.5, score: 0.7, weight: 5 });
  });

  it("replay uses the floor", () => {
    const cfg = { minItems: 1, maxItems: 10, targetSe: 0.3, priorMean: 0, priorSd: 1.5, randomesque: 1 };
    const base = { itemId: "c", b: 0, skillTag: CLOZE_SKILL_TAG, stimulusId: null, score: 0.5, weight: 3 };
    expect(replay(cfg, [{ ...base, guess: 0.25 }]).posterior.mean).toBeLessThan(replay(cfg, [base]).posterior.mean);
  });

  it("automatic selection never picks a cloze or a word bank", () => {
    const pool: PoolItem[] = [
      ...grammarPool(),
      ...CEFR_LEVELS.flatMap((l) => [
        { id: `cloze-${l}`, b: thetaForLevel(l), skillTag: CLOZE_SKILL_TAG, stimulusId: null, orderInStimulus: 0 },
        { id: `bank-${l}`, b: thetaForLevel(l), skillTag: WORD_BANK_SKILL_TAG, stimulusId: null, orderInStimulus: 0 },
      ]),
    ];
    const big = { ...config, maxItems: 200 };
    const rng = mulberry32(12);
    const responses: Parameters<typeof replay>[1] = [];
    for (;;) {
      const next = selectNext(replay(big, responses), pool, big, rng);
      if (!next) break;
      for (const id of next.itemIds) {
        const item = pool.find((p) => p.id === id)!;
        responses.push({ itemId: id, b: item.b, skillTag: item.skillTag, stimulusId: null, score: rng() < 0.5 ? 1 : 0 });
      }
    }
    expect(responses.map((r) => r.itemId).filter((id) => /^(cloze|bank)-/.test(id))).toEqual([]);
    expect(responses.length).toBe(grammarPool().length);
  });

  it("random answering on six 12-gap cloze texts (A1 to C2) places at most 5% at A2 or above; without the floor most of them", () => {
    // A student who knows nothing and clicks at random gets each gap right with p = 1/4.
    const rng = mulberry32(7);
    const runs = 400;
    let withFloor = 0;
    let without = 0;
    const placementPrior = { mean: BAND_CENTER.B1, sd: 1.5 };
    for (let r = 0; r < runs; r++) {
      const obs = CEFR_LEVELS.map((l) => {
        let right = 0;
        for (let g = 0; g < 12; g++) right += rng() < CLOZE_GUESS ? 1 : 0;
        return { b: thetaForLevel(l), score: right / 12, weight: 3 };
      });
      if (CEFR_LEVELS.indexOf(levelFromTheta(eap(obs.map((o) => ({ ...o, guess: CLOZE_GUESS })), placementPrior).mean).level) >= 1) withFloor++;
      if (CEFR_LEVELS.indexOf(levelFromTheta(eap(obs, placementPrior).mean).level) >= 1) without++;
    }
    expect(withFloor / runs).toBeLessThanOrEqual(0.05);
    expect(without / runs).toBeGreaterThan(0.5);
  });
});

describe("guessOf: open cloze", () => {
  it("has no guessing floor for typed open gaps", async () => {
    const { guessOf } = await import("./adaptive");
    expect(guessOf({ skillTag: "grammar.open", content: { kind: "GAP", gaps: [{ id: "g1" }] }, key: { kind: "GAP", answers: { g1: ["weil"] } } })).toBe(0);
  });
});
