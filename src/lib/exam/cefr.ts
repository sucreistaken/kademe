import { CEFR_LEVELS, type Cefr } from "./types";

/**
 * CEFR levels on the ability scale of the engine.
 *
 * The engine measures ability as a single number (theta, in logits). Each
 * level owns a one-logit band, centred on the value below. The band edges are
 * the cut scores. These are a convention, not a calibration: nobody has fitted
 * them to real German learners yet, and `docs/EXAM-ENGINE.md` says so.
 */
export const BAND_CENTER: Record<Cefr, number> = {
  A1: -2.5,
  A2: -1.5,
  B1: -0.5,
  B2: 0.5,
  C1: 1.5,
  C2: 2.5,
};

/** Lower edge of A2, B1, B2, C1, C2. */
export const CUTS = [-2, -1, 0, 1, 2] as const;

export const levelIndex = (level: Cefr): number => CEFR_LEVELS.indexOf(level);

export function levelFromIndex(index: number): Cefr {
  const i = Math.max(0, Math.min(CEFR_LEVELS.length - 1, Math.round(index)));
  return CEFR_LEVELS[i];
}

export const shiftLevel = (level: Cefr, delta: number): Cefr =>
  levelFromIndex(levelIndex(level) + delta);

export const compareLevels = (a: Cefr, b: Cefr): number => levelIndex(a) - levelIndex(b);

export function isCefr(value: unknown): value is Cefr {
  return typeof value === "string" && (CEFR_LEVELS as readonly string[]).includes(value);
}

/**
 * The level whose band holds theta. Below the A1 band there is no level to
 * give, so it floors at A1 and says so.
 */
export function levelFromTheta(theta: number): { level: Cefr; belowScale: boolean } {
  let index = 0;
  for (const cut of CUTS) if (theta >= cut) index += 1;
  return { level: CEFR_LEVELS[index], belowScale: theta < BAND_CENTER.A1 - 0.5 };
}

/** Where an item of a level sits on the scale, optionally nudged inside its band. */
export function thetaForLevel(level: Cefr, within: "EASY" | "MID" | "HARD" = "MID"): number {
  const nudge = within === "EASY" ? -0.3 : within === "HARD" ? 0.3 : 0;
  return BAND_CENTER[level] + nudge;
}

/**
 * The median of a set of levels. With an even count the lower middle is taken,
 * which errs on the side of not over-placing a student.
 */
export function medianLevel(levels: Cefr[]): Cefr | null {
  if (levels.length === 0) return null;
  const sorted = [...levels].sort(compareLevels);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

export const minLevel = (levels: Cefr[]): Cefr | null =>
  levels.length === 0 ? null : [...levels].sort(compareLevels)[0];

export const maxLevel = (levels: Cefr[]): Cefr | null =>
  levels.length === 0 ? null : [...levels].sort(compareLevels)[levels.length - 1];

/** Standard normal CDF, Abramowitz and Stegun 7.1.26. Accurate to about 1e-7. */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/**
 * Probability that the true ability is at or above a level's lower edge, from
 * a normal posterior. This is the "holds the claimed level" number in a
 * verification report.
 */
export function probAtOrAbove(posterior: { mean: number; sd: number }, level: Cefr): number {
  const i = levelIndex(level);
  if (i === 0) return 1;
  const edge = CUTS[i - 1];
  if (posterior.sd <= 0) return posterior.mean >= edge ? 1 : 0;
  return 1 - normalCdf((edge - posterior.mean) / posterior.sd);
}
