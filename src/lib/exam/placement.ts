import type { Posterior } from "./adaptive";
import { BAND_CENTER, RESULT_CUTS, compareLevels, isResultLevel, levelFromTheta, levelIndex, resultLevelFromTheta } from "./cefr";
import { RESULT_LEVELS, type Cefr, type ProductiveSection, type ResultLevel } from "./types";

/**
 * Placement detail on top of the overall level: a sublevel for the class list
 * and a borderline flag that asks for a short talk with a teacher.
 *
 * Both read the pooled objective posterior only. The thresholds are a
 * convention like the cut scores in `./cefr.ts`, not a calibration. When the
 * engine is unsure, it recommends the lower of the two candidate levels:
 * placing a student too high costs more than placing them too low.
 *
 * A0 (Pre-A1) is a result level like the others, with its own cut below A1
 * (the borderline rules apply there too), but not a class: an A0 student
 * starts in the first course, A1.1 (`recommendedClassOf`).
 */

/** A mean this close to a cut, in logits, is borderline. */
export const BORDERLINE_CUT_MARGIN = 0.25;
/** A posterior wider than this is borderline. */
export const BORDERLINE_MAX_SD = 0.6;

export type PlacementReason = "NEAR_CUT" | "HIGH_UNCERTAINTY" | `PRODUCTIVE_GAP:${ProductiveSection}`;

export type Placement = {
  /** "B1.1" or "B1.2"; C2 has no split. */
  sublevel: string | null;
  borderline: boolean;
  reasons: PlacementReason[];
  /** The lower candidate level while borderline, null otherwise; A0 next to the A0/A1 cut. */
  recommended: ResultLevel | null;
};

/**
 * The half band theta sits in: lower half ".1", upper half ".2". C2 is not
 * split. Below the A1 band (A0) it is A1.1, the course an A0 student starts in.
 */
export function sublevelOf(theta: number): string {
  const { level } = levelFromTheta(theta);
  if (level === "C2") return "C2";
  return `${level}.${theta < BAND_CENTER[level] ? 1 : 2}`;
}

/** Index into RESULT_CUTS of the cut nearest to theta; a tie goes to the lower cut. */
function nearestCut(theta: number): number {
  let best = 0;
  for (let i = 1; i < RESULT_CUTS.length; i++) {
    if (Math.abs(theta - RESULT_CUTS[i]) < Math.abs(theta - RESULT_CUTS[best])) best = i;
  }
  return best;
}

/**
 * `insufficient`: some objective section stopped short of its minimum. The
 * pooled level then floors at A1 as the section levels do (see `objectiveLevel`).
 */
export function placementOf(
  pooled: Posterior | null,
  productive: { section: ProductiveSection; level: ResultLevel }[],
  options: { insufficient?: boolean } = {},
): Placement | null {
  if (!pooled) return null;
  const objective = options.insufficient ? levelFromTheta(pooled.mean).level : resultLevelFromTheta(pooled.mean);
  const reasons: PlacementReason[] = [];
  const candidates: ResultLevel[] = [];

  // RESULT_CUTS[i] is the lower edge of RESULT_LEVELS[i + 1], so the level below it is RESULT_LEVELS[i].
  const cut = nearestCut(pooled.mean);
  const belowCut = RESULT_LEVELS[cut];
  if (Math.abs(pooled.mean - RESULT_CUTS[cut]) <= BORDERLINE_CUT_MARGIN) {
    reasons.push("NEAR_CUT");
    candidates.push(belowCut);
  }
  if (pooled.sd > BORDERLINE_MAX_SD) {
    reasons.push("HIGH_UNCERTAINTY");
    candidates.push(belowCut);
  }
  for (const p of productive) {
    if (Math.abs(levelIndex(p.level) - levelIndex(objective)) >= 1) {
      reasons.push(`PRODUCTIVE_GAP:${p.section}`);
      candidates.push(compareLevels(p.level, objective) < 0 ? p.level : objective);
    }
  }

  const borderline = reasons.length > 0;
  return {
    sublevel: sublevelOf(pooled.mean),
    borderline,
    reasons,
    recommended: borderline ? [...candidates].sort(compareLevels)[0] : null,
  };
}

/** The first course: where an A0 (Pre-A1) student starts. */
export const FIRST_CLASS = { level: "A1", sublevel: "A1.1" } as const satisfies { level: Cefr; sublevel: string };

export type RecommendedClass = {
  level: Cefr;
  sublevel: string | null;
  /** The class comes from A0 (Pre-A1): the student starts in the first course. */
  preA1: boolean;
};

/**
 * The class a placed student goes to: the lower candidate while borderline,
 * else the result level itself, with the pooled sublevel. A0 (Pre-A1) has no
 * class of its own: it starts in the first course (`FIRST_CLASS`), and says so.
 */
export function recommendedClassOf(
  level: ResultLevel,
  placement: { sublevel: string | null; borderline: boolean; recommended: string | null },
): RecommendedClass {
  const lower = placement.borderline && isResultLevel(placement.recommended) ? placement.recommended : null;
  const target = lower ?? level;
  if (target === "A0") return { ...FIRST_CLASS, preA1: true };
  return { level: target, sublevel: placement.sublevel, preA1: false };
}
