/**
 * The adaptive engine: a Rasch (one parameter logistic) model with an EAP
 * ability estimate.
 *
 * Why this and not something cleverer: the bank is small and uncalibrated, so
 * a model with more parameters would be fitting noise. Rasch needs one number
 * per item (its difficulty `b`, set from the item's CEFR band), is easy to
 * explain to a teacher ("harder items when you get them right"), and its EAP
 * estimate is stable after very few answers, where maximum likelihood blows up
 * to infinity on an all-correct run.
 *
 * Nothing here is trusted from a previous request. The state is always
 * rebuilt from the stored responses (`replay`), so a crashed request or a
 * tampered client cannot move the estimate.
 */

export type Posterior = { mean: number; sd: number };
export type Observation = { b: number; score: number };

export type AdaptiveConfig = {
  minItems: number;
  maxItems: number;
  /** Stop once the posterior sd falls to this, after `minItems`. */
  targetSe: number;
  priorMean: number;
  priorSd: number;
  /** Pick at random among this many best candidates, so two students near the
   *  same ability do not see the same sequence (exposure control). */
  randomesque: number;
};

export type PoolItem = {
  id: string;
  b: number;
  skillTag: string;
  /** Items sharing a stimulus are served together, in order (a testlet). */
  stimulusId: string | null;
  orderInStimulus: number;
};

export type AdaptiveState = {
  posterior: Posterior;
  answered: number;
  usedItemIds: string[];
  usedStimulusIds: string[];
  tagCounts: Record<string, number>;
};

export type StopReason = "SE_REACHED" | "MAX_ITEMS" | "POOL_EXHAUSTED";

const GRID: number[] = Array.from({ length: 81 }, (_, i) => -4 + i * 0.1);

export const pCorrect = (theta: number, b: number): number => 1 / (1 + Math.exp(-(theta - b)));

export function information(theta: number, b: number): number {
  const p = pCorrect(theta, b);
  return p * (1 - p);
}

/**
 * Expected a posteriori estimate on a fixed grid.
 *
 * Partial credit (a gap-fill with two of three gaps right) enters as a
 * fractional Bernoulli, p^s (1-p)^(1-s). It is not a proper partial credit
 * model, but it moves the estimate in the right direction by the right amount
 * and keeps the model one-parameter.
 */
export function eap(observations: Observation[], prior: Posterior): Posterior {
  const logPost = GRID.map((theta) => {
    const z = (theta - prior.mean) / prior.sd;
    let lp = -0.5 * z * z;
    for (const o of observations) {
      const p = Math.min(1 - 1e-9, Math.max(1e-9, pCorrect(theta, o.b)));
      const s = Math.min(1, Math.max(0, o.score));
      lp += s * Math.log(p) + (1 - s) * Math.log(1 - p);
    }
    return lp;
  });
  const max = Math.max(...logPost);
  const w = logPost.map((lp) => Math.exp(lp - max));
  const total = w.reduce((a, b) => a + b, 0);
  const mean = GRID.reduce((acc, theta, i) => acc + theta * w[i], 0) / total;
  const variance = GRID.reduce((acc, theta, i) => acc + (theta - mean) ** 2 * w[i], 0) / total;
  return { mean, sd: Math.sqrt(variance) };
}

export function initialState(config: AdaptiveConfig): AdaptiveState {
  return {
    posterior: { mean: config.priorMean, sd: config.priorSd },
    answered: 0,
    usedItemIds: [],
    usedStimulusIds: [],
    tagCounts: {},
  };
}

export type ReplayResponse = {
  itemId: string;
  b: number;
  skillTag: string;
  stimulusId: string | null;
  /** Null while served but not yet answered. */
  score: number | null;
};

/** Rebuild the state from what is stored. Unanswered items still count as used. */
export function replay(config: AdaptiveConfig, responses: ReplayResponse[]): AdaptiveState {
  const answered = responses.filter((r) => r.score !== null);
  const tagCounts: Record<string, number> = {};
  for (const r of responses) tagCounts[r.skillTag] = (tagCounts[r.skillTag] ?? 0) + 1;
  return {
    posterior: eap(
      answered.map((r) => ({ b: r.b, score: r.score as number })),
      { mean: config.priorMean, sd: config.priorSd },
    ),
    answered: answered.length,
    usedItemIds: responses.map((r) => r.itemId),
    usedStimulusIds: [...new Set(responses.map((r) => r.stimulusId).filter((s): s is string => !!s))],
    tagCounts,
  };
}

type Unit = { itemIds: string[]; b: number; tag: string };

function units(pool: PoolItem[], state: AdaptiveState): Unit[] {
  const used = new Set(state.usedItemIds);
  const usedStimuli = new Set(state.usedStimulusIds);
  const singles: Unit[] = [];
  const groups = new Map<string, PoolItem[]>();
  for (const item of pool) {
    if (used.has(item.id)) continue;
    if (item.stimulusId) {
      if (usedStimuli.has(item.stimulusId)) continue;
      const g = groups.get(item.stimulusId) ?? [];
      g.push(item);
      groups.set(item.stimulusId, g);
    } else {
      singles.push({ itemIds: [item.id], b: item.b, tag: item.skillTag });
    }
  }
  const testlets = [...groups.values()].map((items) => {
    const sorted = [...items].sort((a, b) => a.orderInStimulus - b.orderInStimulus);
    return {
      itemIds: sorted.map((i) => i.id),
      b: sorted.reduce((a, i) => a + i.b, 0) / sorted.length,
      tag: sorted[0].skillTag,
    };
  });
  return [...singles, ...testlets];
}

/** How many units are left to serve. */
export const poolLeft = (pool: PoolItem[], state: AdaptiveState): number => units(pool, state).length;

/**
 * The next item, or the next testlet. Closest difficulty to the current
 * estimate wins, with a small penalty for a skill tag already seen often so a
 * grammar section does not become twelve dative questions.
 */
export function selectNext(
  state: AdaptiveState,
  pool: PoolItem[],
  config: AdaptiveConfig,
  rng: () => number,
): { itemIds: string[] } | null {
  if (state.answered >= config.maxItems) return null;
  const candidates = units(pool, state);
  if (candidates.length === 0) return null;
  const theta = state.posterior.mean;
  const ranked = candidates
    .map((u) => ({ u, cost: Math.abs(u.b - theta) + 0.15 * (state.tagCounts[u.tag] ?? 0) }))
    .sort((a, b) => a.cost - b.cost);
  const k = Math.max(1, Math.min(config.randomesque, ranked.length));
  const pick = ranked[Math.floor(rng() * k)];
  return { itemIds: pick.u.itemIds };
}

export function shouldStop(state: AdaptiveState, config: AdaptiveConfig, left: number): StopReason | null {
  if (state.answered >= config.maxItems) return "MAX_ITEMS";
  if (state.answered >= config.minItems && state.posterior.sd <= config.targetSe) return "SE_REACHED";
  if (left === 0) return "POOL_EXHAUSTED";
  return null;
}

/** Small seeded generator for tests, simulations and deterministic shuffles. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Run a whole section against a simulated student of known ability. */
export function simulate(
  trueTheta: number,
  pool: PoolItem[],
  config: AdaptiveConfig,
  rng: () => number,
): { posterior: Posterior; answered: number; stop: StopReason } {
  const responses: ReplayResponse[] = [];
  const byId = new Map(pool.map((p) => [p.id, p]));
  for (;;) {
    const state = replay(config, responses);
    const stop = shouldStop(state, config, poolLeft(pool, state));
    if (stop) return { posterior: state.posterior, answered: state.answered, stop };
    const next = selectNext(state, pool, config, rng);
    if (!next) return { posterior: state.posterior, answered: state.answered, stop: "POOL_EXHAUSTED" };
    for (const id of next.itemIds) {
      const item = byId.get(id)!;
      responses.push({
        itemId: id,
        b: item.b,
        skillTag: item.skillTag,
        stimulusId: item.stimulusId,
        score: rng() < pCorrect(trueTheta, item.b) ? 1 : 0,
      });
    }
  }
}
