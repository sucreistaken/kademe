import { C_TEST_GAPS_PER_WEIGHT, CLOZE_GUESS, eap, mulberry32, pWithGuess, type Observation } from "./adaptive";
import { adaptiveConfigFor, enabledSections, resolveDistribution, textPlanOf, weighsTexts, type BlueprintConfig } from "./blueprint";
import { BAND_CENTER, PRE_A1_CUT, levelIndex, resultLevelFromTheta, thetaForLevel } from "./cefr";
import { poolPosteriors } from "./result";
import { CEFR_LEVELS, isObjectiveSection, type Cefr, type ExamMode, type ResultLevel, type TextGapKind } from "./types";

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
 *
 * The placed level is the result level of the pooled mean, as the engine gives
 * it: below the A1 band it is A0 (Pre-A1). A0 students (`trueLevels`) are
 * spread over the logit below the A1 band, -4 to -3; `fixedTheta` puts every
 * student at one ability instead (a very low one: a student with no German who
 * only guesses).
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
  /**
   * True levels to simulate, in this order (default A1 to C2). Each level draws
   * from the one random stream in turn, so listing A0 after C2 leaves the A1 to
   * C2 numbers as they were.
   */
  trueLevels?: readonly ResultLevel[];
  /** Every simulated student at this ability instead of spread over the level's band. */
  fixedTheta?: number;
};

export type LevelAccuracy = { exact: number; withinOne: number; over: number };
/** Per true level: placed exactly, within one level, and above the true level. A0 only when simulated. */
export type FormAccuracy = Record<Cefr, LevelAccuracy> & Partial<Record<"A0", LevelAccuracy>>;

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
  // C-test and open cloze gaps are typed.
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
  for (const level of o.trueLevels ?? CEFR_LEVELS) {
    let exact = 0;
    let withinOne = 0;
    let over = 0;
    for (let r = 0; r < o.runs; r++) {
      // Spread across the band, not only its centre. A0 is the logit below the A1 band.
      const draw = rng();
      const theta = o.fixedTheta ?? (level === "A0" ? PRE_A1_CUT - 1 + draw : BAND_CENTER[level] - 0.5 + draw);
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
      const got = resultLevelFromTheta(poolPosteriors(posteriors)!.mean);
      const signed = levelIndex(got) - levelIndex(level);
      const diff = Math.abs(signed);
      if (diff === 0) exact++;
      if (diff <= 1) withinOne++;
      if (signed > 0) over++;
    }
    out[level] = { exact: exact / o.runs, withinOne: withinOne / o.runs, over: over / o.runs };
  }
  return out;
}
