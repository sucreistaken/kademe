import { CLOZE_GUESS, eap, mulberry32, pWithGuess, type Observation } from "./adaptive";
import { adaptiveConfigFor, enabledSections, resolveDistribution, textPlanOf, type BlueprintConfig } from "./blueprint";
import { BAND_CENTER, levelFromTheta, thetaForLevel } from "./cefr";
import { poolPosteriors } from "./result";
import { CEFR_LEVELS, isObjectiveSection, type Cefr, type ExamMode, type TextGapKind } from "./types";

/**
 * Simulated students of known level take a fixed form; the result is how
 * often the pooled objective level is exactly right and within one level.
 * Rasch model only. Reading and listening testlet dependence is ignored, as
 * in docs/EXAM-ENGINE.md; text gap dependence is not: the gaps of one text
 * (C-test, cloze, word bank) share a random effect, so twenty gaps do not
 * pass for twenty items.
 *
 * Guessing (spec 2026-10-18, section 4): answers are generated with
 * p = c + (1 - c) * sigma(theta - b). Cloze and word-bank gaps always carry
 * their floor (a quarter; one over the pool size), in the answers and in the
 * estimate, as the live engine does. Ordinary items guess only when
 * `itemGuess` is set, and only in the answers: the engine gives them no floor.
 */

export type SimulationOptions = {
  runs: number;
  seed: number;
  /** Gaps per simulated text, unless `textGaps` names its kind. */
  cTestGaps: number;
  /** Weight the estimate gives one text (1 before 2026-10-15, gaps / 4 after). */
  cTestWeight: number;
  /** Sd in logits of the per-text effect shared by the gaps of one text. */
  textEffectSd: number;
  /** Gaps per simulated text of a kind; a kind not named uses `cTestGaps`. */
  textGaps?: Partial<Record<TextGapKind, number>>;
  /** Distractors in a simulated word bank's pool, besides one word per gap. Default 4. */
  wordBankDistractors?: number;
  /** Guessing floor of the answers to ordinary items (a four-option item: 0.25). Default 0. */
  itemGuess?: number;
};

/** Per true level: placed exactly, within one level, and above the true level. */
export type FormAccuracy = Record<Cefr, { exact: number; withinOne: number; over: number }>;

/** The guessing floor of one gap of a text of this kind, with this many gaps. */
export function textGuess(kind: TextGapKind, gaps: number, wordBankDistractors = 4): number {
  if (kind === "CLOZE") return CLOZE_GUESS;
  if (kind === "WORDBANK") return 1 / (gaps + wordBankDistractors);
  return 0;
}

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
    let over = 0;
    for (let r = 0; r < o.runs; r++) {
      // Spread across the band, not only its centre.
      const theta = BAND_CENTER[level] - 0.5 + rng();
      const posteriors = objective.map((s) => {
        const cfg = adaptiveConfigFor(s, mode, null);
        const dist = resolveDistribution(s, mode, null, config.difficultyOffset);
        const observations: Observation[] = CEFR_LEVELS.flatMap((l) =>
          Array.from({ length: dist[l] }, () => {
            const b = thetaForLevel(l, within[Math.floor(rng() * 3)]);
            return { b, score: rng() < pWithGuess(theta, b, o.itemGuess ?? 0) ? 1 : 0 };
          }),
        );
        for (const { level: l, kind } of textPlanOf(s, mode, null)) {
          const b = thetaForLevel(l);
          const gaps = o.textGaps?.[kind] ?? o.cTestGaps;
          const guess = textGuess(kind, gaps, o.wordBankDistractors);
          const onThisText = theta + o.textEffectSd * normal(rng);
          let right = 0;
          for (let g = 0; g < gaps; g++) right += rng() < pWithGuess(onThisText, b, guess) ? 1 : 0;
          observations.push({ b, score: right / gaps, weight: o.cTestWeight, ...(guess > 0 ? { guess } : {}) });
        }
        return eap(observations, { mean: cfg.priorMean, sd: cfg.priorSd });
      });
      const got = levelFromTheta(poolPosteriors(posteriors)!.mean).level;
      const signed = CEFR_LEVELS.indexOf(got) - CEFR_LEVELS.indexOf(level);
      const diff = Math.abs(signed);
      if (diff === 0) exact++;
      if (diff <= 1) withinOne++;
      if (signed > 0) over++;
    }
    out[level] = { exact: exact / o.runs, withinOne: withinOne / o.runs, over: over / o.runs };
  }
  return out;
}
