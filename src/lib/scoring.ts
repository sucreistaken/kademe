/**
 * Score maths. Pure functions, no database.
 *
 * Two deliberate rules, both from the product brief:
 *  1. Auto-scored questions never enter the competency average. They are a
 *     separate Knowledge Score, shown alongside, so a good multiple-choice run
 *     cannot inflate a weak interview.
 *  2. A weight set is snapshotted onto a published version. Recomputing an old
 *     evaluation with new weights is an explicit manager action, never implicit.
 */

export type CompetencyScore = {
  competencyId: string;
  /** null means "not scored yet", which is different from zero. */
  score: number | null;
};

export type Weight = {
  competencyId: string;
  percentage: number;
};

/** Plain average of the scored competencies. Unscored ones are ignored. */
export function averageScore(items: CompetencyScore[]): number | null {
  const scored = items.filter(
    (i): i is CompetencyScore & { score: number } => i.score !== null,
  );
  if (scored.length === 0) return null;
  const sum = scored.reduce((acc, i) => acc + i.score, 0);
  return round2(sum / scored.length);
}

/**
 * Weighted average. Weights of unscored competencies are dropped and the
 * remainder is renormalised, otherwise a single unscored competency would drag
 * the total down as if it had been scored zero.
 */
export function weightedScore(
  items: CompetencyScore[],
  weights: Weight[],
): number | null {
  const byId = new Map(weights.map((w) => [w.competencyId, w.percentage]));
  const scored = items.filter(
    (i): i is CompetencyScore & { score: number } => i.score !== null,
  );
  if (scored.length === 0) return null;

  let weightSum = 0;
  let acc = 0;
  for (const item of scored) {
    const w = byId.get(item.competencyId);
    if (w === undefined || w <= 0) continue;
    weightSum += w;
    acc += item.score * w;
  }
  // No usable weights: fall back to the plain average rather than returning null.
  if (weightSum === 0) return averageScore(scored);
  return round2(acc / weightSum);
}

export function overallScore(
  items: CompetencyScore[],
  weights: Weight[] | null,
): number | null {
  return weights && weights.length > 0
    ? weightedScore(items, weights)
    : averageScore(items);
}

/**
 * Which weight set an evaluation is scored against. This is the whole of the
 * "weight changes never rewrite past scores" rule, so it lives in one place:
 *
 *  1. Weighting is a per version switch. No active set on the version means
 *     weighting is off, and everyone gets the plain average, pinned or not.
 *     Turning it off has to mean off.
 *  2. With weighting on, an evaluation that is pinned to a set (the column
 *     `evaluations.weight_set_id`, written when the evaluation was opened,
 *     completed, or recalculated) keeps using THAT set. Saving new weights
 *     opens a new set and leaves the pin alone, so last month's candidate does
 *     not move until the manager presses "recalculate", which re-pins.
 *  3. An evaluation with no pin was never computed against anything, so there
 *     is nothing to protect: it follows the active set. This is also what makes
 *     the toggle visibly do something for candidates scored while it was off.
 *
 * A pin whose set has no rows any more (deleted set, `on delete set null`
 * races) falls back to the active set rather than to an average, because the
 * manager did switch weighting on.
 */
export function selectWeights(
  activeSetId: string | null,
  pinnedSetId: string | null,
  weightsBySet: Map<string, Weight[]>,
): Weight[] | null {
  if (!activeSetId) return null;
  const pinned = pinnedSetId ? weightsBySet.get(pinnedSetId) : undefined;
  if (pinned && pinned.length > 0) return pinned;
  return weightsBySet.get(activeSetId) ?? null;
}

/** Percentage of auto-scored questions answered correctly. Kept separate. */
export function knowledgeScore(
  answers: Array<{ correct: boolean }>,
): number | null {
  if (answers.length === 0) return null;
  const right = answers.filter((a) => a.correct).length;
  return round2((right / answers.length) * 100);
}

/**
 * An even split that actually adds up to 100. Six competencies at 100/6 rounds
 * to 16.67 each, which sums to 100.02 and leaves a weights screen unsaveable the
 * moment it opens. The remainder is spread over the first rows instead, so the
 * default state is always valid and every value stays a whole percent.
 */
export function evenWeightSplit(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, i) =>
    i < remainder ? base + 1 : base,
  );
}

export function weightsAreValid(weights: Weight[]): boolean {
  const total = weights.reduce((acc, w) => acc + w.percentage, 0);
  return Math.abs(total - 100) < 0.01;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Turkish decimal comma, matching the design canvas ("Aşama ortalaması 3,5"). */
export function formatScore(n: number | null): string {
  if (n === null) return "puanlanmadı";
  return n.toFixed(1).replace(".", ",");
}
