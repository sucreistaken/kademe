/** Whole percentages that add up to 100, the remainder on the first rows. Client-safe. */
export function evenWeights(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  const extra = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

export function weightTotal(weights: readonly number[]): number {
  return weights.reduce((a, w) => a + w, 0);
}
