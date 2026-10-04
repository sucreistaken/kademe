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
 * Largest remainder; ties go to the earlier row, so the result is stable.
 * A negative or non-finite importance counts as 0, so every result is a whole
 * percentage the database accepts (hiring_weight_percentage, 0-100).
 */
export function toPercentages(raw: number[]): number[] {
  if (raw.length === 0) return [];
  const importance = raw.map((r) => (Number.isFinite(r) && r > 0 ? r : 0));
  const sum = importance.reduce((a, b) => a + b, 0);
  if (sum <= 0) return evenSplit(raw.length);
  const exact = importance.map((r) => (r / sum) * 100);
  const result = exact.map(Math.floor);
  let left = 100 - result.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    result[i] += 1;
    left -= 1;
  }
  return result;
}

export function defaultWeights(used: string[], profile: Array<{ competencyId: string; weight: number }>): Record<string, number> {
  const byId = new Map(profile.map((p) => [p.competencyId, p.weight]));
  const present = used.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  const fallback = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 1;
  const percentages = toPercentages(used.map((id) => byId.get(id) ?? fallback));
  return Object.fromEntries(used.map((id, i) => [id, percentages[i]]));
}

export function weightsTotal(weights: Record<string, number>, used: string[]): number {
  return used.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
}

/** Null when every measured competency has a whole percentage 0-100 and they add up to 100. */
export function weightsProblem(weights: Record<string, number>, used: string[]): { total: number } | null {
  const total = weightsTotal(weights, used);
  const whole = used.every((id) => {
    const w = weights[id] ?? 0;
    return Number.isInteger(w) && w >= 0 && w <= 100;
  });
  return whole && total === 100 ? null : { total };
}
