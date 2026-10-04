/**
 * Competency weights (HIRING-UX 5.7). Position profile weights are importance
 * on 0-100 with any sum; an opening works in whole percentages summing to 100.
 */
export function evenSplit(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, i) => (i < remainder ? base + 1 : base));
}

/**
 * Largest remainder, ranked exactly: each row's share is r * 100 / sum, so the
 * remainder compared is r * 100 - floor * sum (an integer when the importances
 * are). Ties go to the earlier row, so the result is stable.
 * A negative or non-finite importance counts as 0, so every result is a whole
 * percentage the database accepts (hiring_weight_percentage, 0-100).
 */
export function toPercentages(raw: number[]): number[] {
  if (raw.length === 0) return [];
  const importance = raw.map((r) => (Number.isFinite(r) && r > 0 ? r : 0));
  const sum = importance.reduce((a, b) => a + b, 0);
  // Nothing to compare, or too large to add up: an even split.
  if (!Number.isFinite(sum * 100) || sum <= 0) return evenSplit(raw.length);
  const result = importance.map((r) => Math.floor((r * 100) / sum));
  const remainder = importance.map((r, i) => r * 100 - result[i] * sum);
  let left = 100 - result.reduce((a, b) => a + b, 0);
  const order = remainder.map((rem, i) => ({ i, rem })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    result[i] += 1;
    left -= 1;
  }
  return result;
}

/**
 * Defaults for the measured competencies from the position profile. One missing
 * from the profile counts as the profile's average; the rows are scaled by the
 * number of profile rows instead of dividing, so whole-number weights stay exact.
 */
export function defaultWeights(used: string[], profile: Array<{ competencyId: string; weight: number }>): Record<string, number> {
  const byId = new Map(profile.map((p) => [p.competencyId, p.weight]));
  const present = used.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  const scale = present.length || 1;
  const average = present.length ? present.reduce((a, b) => a + b, 0) : 1;
  const percentages = toPercentages(used.map((id) => (byId.has(id) ? byId.get(id)! * scale : average)));
  return Object.fromEntries(used.map((id, i) => [id, percentages[i]]));
}

export function weightsTotal(weights: Record<string, number>, used: string[]): number {
  return used.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
}

/** Measured competencies that have no weight at all: they would be published at 0%. */
export function missingWeights(weights: Record<string, number>, used: string[]): string[] {
  return used.filter((id) => weights[id] === undefined);
}

/** Shortest reason accepted for a weight change after publishing (HIRING-UX 5.7). */
export const WEIGHT_REASON_MIN = 3;

/**
 * Why a set of weights is refused. NOT_WHOLE: a measured competency has no
 * weight, or one that is not a whole number 0-100; it is named first, because
 * the total of such values says nothing (70.5 + 29.5 is 100 and still refused).
 * NOT_100: every value is whole, and they add up to `total`, not 100.
 */
export type WeightsProblem = { code: "NOT_WHOLE" | "NOT_100"; total: number };

/** Null when every measured competency has a whole percentage 0-100 and they add up to 100. A missing one is a problem. */
export function weightsProblem(weights: Record<string, number>, used: string[]): WeightsProblem | null {
  const total = weightsTotal(weights, used);
  const whole = used.every((id) => {
    const w = weights[id];
    return w !== undefined && Number.isInteger(w) && w >= 0 && w <= 100;
  });
  if (!whole) return { code: "NOT_WHOLE", total };
  return total === 100 ? null : { code: "NOT_100", total };
}

/**
 * The percentages of a weight set added after publishing (HIRING-UX 5.7, R10).
 * The set holds exactly the published scorecard's competencies, in its order:
 * an id outside the scorecard is never part of it. Weighting on: each one needs
 * a whole percentage 0-100 (own keys, finite numbers only) and they add up to
 * 100. Weighting off is a plain average, so the scorecard's own percentages are
 * kept and switching on later starts from them.
 */
export function weightSetPercentages(
  scorecard: { competencies: ReadonlyArray<{ id: string; weight: number }> },
  input: { enabled: boolean; weights: Record<string, number> },
): { ok: true; weights: Record<string, number> } | ({ ok: false } & WeightsProblem) {
  const used = scorecard.competencies.map((c) => c.id);
  if (!input.enabled) return { ok: true, weights: Object.fromEntries(scorecard.competencies.map((c) => [c.id, c.weight])) };
  const given: Record<string, number> = {};
  for (const id of used) {
    const value: unknown = Object.hasOwn(input.weights, id) ? input.weights[id] : undefined;
    if (typeof value === "number" && Number.isFinite(value)) given[id] = value;
  }
  const problem = weightsProblem(given, used);
  return problem ? { ok: false, ...problem } : { ok: true, weights: given };
}
