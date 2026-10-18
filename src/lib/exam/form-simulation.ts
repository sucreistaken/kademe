import { C_TEST_GAPS_PER_WEIGHT, CLOZE_GUESS, eap, mulberry32, pWithGuess, type Observation } from "./adaptive";
import { adaptiveConfigFor, enabledSections, resolveDistribution, textPlanOf, weighsTexts, type BlueprintConfig } from "./blueprint";
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
 * estimate, as the live engine does (`estimateGuess: false` drops the floor
 * from the estimate only, to show what it corrects). Ordinary items guess only
 * when `itemGuess` is set, and only in the answers: the engine gives them no
 * floor. A text weighs what the engine gives it (`itemWeight`): its gaps over
 * four in a section that weighs texts, else 1.
 */

export type SimulationOptions = {
  runs: number;
  seed: number;
  /** Gaps per simulated text, unless `textGaps` names its kind. */
  cTestGaps: number;
  /**
   * Weight the estimate gives every text, overriding the engine's weight
   * (max(1, gaps / 4) in a section that weighs texts, else 1).
   */
  cTestWeight?: number;
  /** Sd in logits of the per-text effect shared by the gaps of one text. */
  textEffectSd: number;
  /** Gaps per simulated text of a kind; a kind not named uses `cTestGaps`. */
  textGaps?: Partial<Record<TextGapKind, number>>;
  /** Distractors in a simulated word bank's pool, besides one word per gap. Default 4. */
  wordBankDistractors?: number;
  /** Guessing floor of the answers to ordinary items (a four-option item: 0.25). Default 0. */
  itemGuess?: number;
  /** Whether the estimate knows the cloze and word-bank floor (the engine does). Default true. */
  estimateGuess?: boolean;
};

/** Per true level: placed exactly, within one level, and above the true level. */
export type FormAccuracy = Record<Cefr, { exact: number; withinOne: number; over: number }>;

/** The levels the placement gate checks (spec 2026-10-18, section 4): C2 has no level above it to tell apart. */
export const GATE_LEVELS: readonly Cefr[] = ["A1", "A2", "B1", "B2", "C1"];

/**
 * The gate of spec 2026-10-18, section 4, as the reasons a form fails it
 * (empty: it passes). Against the multiple-choice form `mc`, at A1 to C1:
 * exact agreement at most 2 points lower, within one level at most 1 point
 * lower. Against the C-test form `cTest`: A1 over-placement at most 5 points
 * higher. All three simulated with the same options, guessing included.
 */
export function gateFailures(mc: FormAccuracy, cTest: FormAccuracy, form: FormAccuracy): string[] {
  const out: string[] = [];
  const pts = (x: number) => (x * 100).toFixed(2);
  // Shares are counts over runs; the tolerance only absorbs float rounding of the margins.
  const eps = 1e-9;
  for (const l of GATE_LEVELS) {
    if (form[l].exact < mc[l].exact - 0.02 - eps) out.push(`${l} exact ${pts(form[l].exact)} < ${pts(mc[l].exact - 0.02)}`);
    if (form[l].withinOne < mc[l].withinOne - 0.01 - eps) out.push(`${l} within one ${pts(form[l].withinOne)} < ${pts(mc[l].withinOne - 0.01)}`);
  }
  if (form.A1.over > cTest.A1.over + 0.05 + eps) out.push(`A1 over ${pts(form.A1.over)} > ${pts(cTest.A1.over + 0.05)}`);
  return out;
}

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
          const weight = o.cTestWeight ?? (weighsTexts(s) ? Math.max(1, gaps / C_TEST_GAPS_PER_WEIGHT) : 1);
          const floor = o.estimateGuess === false ? 0 : guess;
          const onThisText = theta + o.textEffectSd * normal(rng);
          let right = 0;
          for (let g = 0; g < gaps; g++) right += rng() < pWithGuess(onThisText, b, guess) ? 1 : 0;
          observations.push({ b, score: right / gaps, weight, ...(floor > 0 ? { guess: floor } : {}) });
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
