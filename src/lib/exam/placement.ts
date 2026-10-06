import type { Posterior } from "./adaptive";
import { BAND_CENTER, CUTS, compareLevels, levelFromTheta, levelIndex } from "./cefr";
import { CEFR_LEVELS, type Cefr, type ProductiveSection } from "./types";

/**
 * Placement detail on top of the overall level: a sublevel for the class list
 * and a borderline flag that asks for a short talk with a teacher.
 *
 * Both read the pooled objective posterior only. The thresholds are a
 * convention like the cut scores in `./cefr.ts`, not a calibration. When the
 * engine is unsure, it recommends the lower of the two candidate levels:
 * placing a student too high costs more than placing them too low.
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
  /** The lower candidate level while borderline, null otherwise. */
  recommended: Cefr | null;
};

/** The half band theta sits in: lower half ".1", upper half ".2". C2 is not split. */
export function sublevelOf(theta: number): string {
  const { level } = levelFromTheta(theta);
  if (level === "C2") return "C2";
  return `${level}.${theta < BAND_CENTER[level] ? 1 : 2}`;
}

/** Index into CUTS of the cut nearest to theta; a tie goes to the lower cut. */
function nearestCut(theta: number): number {
  let best = 0;
  for (let i = 1; i < CUTS.length; i++) {
    if (Math.abs(theta - CUTS[i]) < Math.abs(theta - CUTS[best])) best = i;
  }
  return best;
}

export function placementOf(
  pooled: Posterior | null,
  productive: { section: ProductiveSection; level: Cefr }[],
): Placement | null {
  if (!pooled) return null;
  const objective = levelFromTheta(pooled.mean).level;
  const reasons: PlacementReason[] = [];
  const candidates: Cefr[] = [];

  // CUTS[i] is the lower edge of CEFR_LEVELS[i + 1], so the level below it is CEFR_LEVELS[i].
  const cut = nearestCut(pooled.mean);
  const belowCut = CEFR_LEVELS[cut];
  if (Math.abs(pooled.mean - CUTS[cut]) <= BORDERLINE_CUT_MARGIN) {
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
