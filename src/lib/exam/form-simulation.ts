import { eap, mulberry32, pCorrect, type Observation } from "./adaptive";
import { adaptiveConfigFor, cTestLevelsOf, enabledSections, resolveDistribution, type BlueprintConfig } from "./blueprint";
import { BAND_CENTER, levelFromTheta, thetaForLevel } from "./cefr";
import { poolPosteriors } from "./result";
import { CEFR_LEVELS, isObjectiveSection, type Cefr, type ExamMode } from "./types";

/**
 * Simulated students of known level take a fixed form; the result is how
 * often the pooled objective level is exactly right and within one level.
 * Rasch model only. Reading and listening testlet dependence is ignored, as
 * in docs/EXAM-ENGINE.md; C-test gap dependence is not: the gaps of one text
 * share a random effect, so twenty gaps do not pass for twenty items.
 */

export type SimulationOptions = {
  runs: number;
  seed: number;
  /** Gaps per simulated C-test text. */
  cTestGaps: number;
  /** Weight the estimate gives one C-test (1 before 2026-10-15, gaps / 4 after). */
  cTestWeight: number;
  /** Sd in logits of the per-text effect shared by the gaps of one text. */
  textEffectSd: number;
};

export type FormAccuracy = Record<Cefr, { exact: number; withinOne: number }>;

function normal(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export function simulateFixedForm(config: BlueprintConfig, mode: ExamMode, o: SimulationOptions): FormAccuracy {
  const rng = mulberry32(o.seed);
  const within = ["EASY", "MID", "HARD"] as const;
  const objective = enabledSections(config).filter((s) => isObjectiveSection(s.section));
  const out = {} as FormAccuracy;
  for (const level of CEFR_LEVELS) {
    let exact = 0;
    let withinOne = 0;
    for (let r = 0; r < o.runs; r++) {
      // Spread across the band, not only its centre.
      const theta = BAND_CENTER[level] - 0.5 + rng();
      const posteriors = objective.map((s) => {
        const cfg = adaptiveConfigFor(s, mode, null);
        const dist = resolveDistribution(s, mode, null, config.difficultyOffset);
        const observations: Observation[] = CEFR_LEVELS.flatMap((l) =>
          Array.from({ length: dist[l] }, () => {
            const b = thetaForLevel(l, within[Math.floor(rng() * 3)]);
            return { b, score: rng() < pCorrect(theta, b) ? 1 : 0 };
          }),
        );
        for (const l of cTestLevelsOf(s, mode, null)) {
          const b = thetaForLevel(l);
          const onThisText = theta + o.textEffectSd * normal(rng);
          let right = 0;
          for (let g = 0; g < o.cTestGaps; g++) right += rng() < pCorrect(onThisText, b) ? 1 : 0;
          observations.push({ b, score: right / o.cTestGaps, weight: o.cTestWeight });
        }
        return eap(observations, { mean: cfg.priorMean, sd: cfg.priorSd });
      });
      const got = levelFromTheta(poolPosteriors(posteriors)!.mean).level;
      const diff = Math.abs(CEFR_LEVELS.indexOf(got) - CEFR_LEVELS.indexOf(level));
      if (diff === 0) exact++;
      if (diff <= 1) withinOne++;
    }
    out[level] = { exact: exact / o.runs, withinOne: withinOne / o.runs };
  }
  return out;
}
