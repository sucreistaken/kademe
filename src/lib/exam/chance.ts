import { guessOf } from "./adaptive";
import { compareLevels } from "./cefr";
import { isTextGap, type Cefr, type ItemAnswer, type ItemSnapshot } from "./types";

/**
 * The chance rule for A0 (Pre-A1): A0 means "shows no German". A right answer
 * anywhere is evidence of German; a blank is evidence of nothing. So the rule
 * looks at the ANSWERED units only and asks whether they are right more often
 * than pure guessing would make them. If not, the section's level is A0 with
 * the reason "AT_CHANCE", whatever the ability band says. Pure, so the engine
 * and the simulation share it (src/lib/exam/form-simulation.ts).
 *
 * Answer units are the parts the engine already scores: one per single-choice
 * item, per statement (Richtig/Falsch), per pair (matching), per gap, per
 * correct box of a tick-n item. A unit is answered when the student put
 * something in it. Each has a chance of being right by guessing alone: one
 * over the options, a third (a half for two-way statements), one over the
 * right-hand column, a quarter for a cloze gap, one over the pool for a word
 * bank, nothing for a typed answer. Under pure guessing the right units among
 * the answered ones are a sum of independent Bernoullis: the expected count is
 * the sum of their chances, its variance the sum of p(1 - p). Answered units
 * are "not above chance" when
 *
 *   right <= expected + CHANCE_Z * sd     (one-sided, 98%; no answered unit: trivially)
 *
 * A section is at chance when BOTH hold:
 *   1. its answered A1 to A2 units are not above chance, and
 *   2. all its answered units are not above chance (right answers on B1 to C2
 *      material are German too),
 * and it served enough evidence: at least CHANCE_MIN_UNITS units written for
 * A1 to A2 (CHANCE_MAX_LEVEL). A real A1 student is near chance on B1 to C2
 * material, so the first test looks at beginner material; one short A1 or A2
 * text (3 to 10 units in the bank) cannot tell A0 from A1, hence the minimum.
 * A fully blank section (nothing answered) is at chance once it served
 * BLANK_MIN_UNITS units of any level. The simulation behind these numbers is
 * in docs/EXAM-ENGINE.md.
 *
 * Approximations: the gaps or statements of one item are not independent
 * under real answering, but they are under pure guessing, which is the
 * hypothesis tested. A tick-n item's chance is taken as correct boxes over
 * options per box, which overstates it a little (safe side: it calls fewer
 * students above chance, never more).
 */

/** One-sided 98% bound: chosen by simulation (docs/EXAM-ENGINE.md). */
export const CHANCE_Z = 2.054;
/** Fewer served A1 to A2 answer units than this decide nothing: about two short texts' worth. */
export const CHANCE_MIN_UNITS = 16;
/** A blank section needs this many served units to count as at chance. */
export const BLANK_MIN_UNITS = 8;
/** Units written above this level do not count for the beginner test (they still count for the all-units test). */
export const CHANCE_MAX_LEVEL: Cefr = "A2";

/**
 * One scored item as answer units: `units` served, `answered` of them with an
 * answer, the guessing mean and variance of the right count over the answered
 * units, and how many were right.
 */
export type ChanceUnits = { units: number; answered: number; expected: number; variance: number; right: number };

/** Answered units against guessing. */
export type ChanceTally = { answered: number; right: number; expected: number; sd: number; aboveChance: boolean };

export type ChanceTest = {
  /** Served units written for A1 to A2. */
  units: number;
  /** The beginner test: answered A1 to A2 units. */
  beginner: ChanceTally;
  /** The all-units test: every answered unit of the section. */
  all: ChanceTally;
  /** Enough served units for the rule to decide. */
  enough: boolean;
  /** Nothing in the section was answered. */
  blank: boolean;
  /** Decided: not above chance on both tests (or blank). */
  atChance: boolean;
};

export type ChanceOptions = { z?: number; minUnits?: number; maxLevel?: Cefr };

/** Each answered unit right by guessing with probability `p`. */
const bernoulli = (units: number, answered: number, p: number, right: number): ChanceUnits => ({
  units,
  answered,
  expected: answered * p,
  variance: answered * p * (1 - p),
  right,
});

const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;

/**
 * Answer units of one scored objective item; null for an item without them
 * (writing, speaking). Without `answer` (the simulation) every unit counts as
 * answered.
 */
export function chanceUnitsOf(
  snapshot: Pick<ItemSnapshot, "type" | "skillTag" | "content" | "key">,
  score: number,
  answer?: ItemAnswer | null,
): ChanceUnits | null {
  const c = snapshot.content;
  const all = answer === undefined;
  const a = answer ?? {};
  switch (c.kind) {
    case "CHOICE": {
      const n = Math.max(1, c.options.length);
      const picked = all || (a.choiceIds?.length ?? 0) > 0;
      if (snapshot.type === "SINGLE_CHOICE") return bernoulli(1, picked ? 1 : 0, 1 / n, score);
      const correct = snapshot.key.kind === "CHOICE" ? Math.max(1, snapshot.key.correct.length) : 1;
      return bernoulli(correct, picked ? correct : 0, Math.min(1, correct / n), score * correct);
    }
    case "TFNG": {
      const answered = all ? c.statements.length : c.statements.filter((s) => filled(a.tfng?.[s.id])).length;
      return bernoulli(c.statements.length, answered, c.twoWay ? 1 / 2 : 1 / 3, score * c.statements.length);
    }
    case "MATCHING": {
      const answered = all ? c.left.length : c.left.filter((l) => filled(a.matches?.[l.id])).length;
      return bernoulli(c.left.length, answered, 1 / Math.max(1, c.right.length), score * c.left.length);
    }
    case "GAP": {
      const isAnswered = (id: string) => all || filled(a.gaps?.[id]);
      const right = score * c.gaps.length;
      if (isTextGap(snapshot)) return bernoulli(c.gaps.length, c.gaps.filter((g) => isAnswered(g.id)).length, guessOf(snapshot), right);
      // An ordinary gap item: a drop-down gap is one of its choices, a typed one cannot be guessed.
      const ps = c.gaps.filter((g) => isAnswered(g.id)).map((g) => (g.choices?.length ? 1 / g.choices.length : 0));
      return {
        units: c.gaps.length,
        answered: ps.length,
        expected: ps.reduce((s, p) => s + p, 0),
        variance: ps.reduce((s, p) => s + p * (1 - p), 0),
        right,
      };
    }
    case "SHORT_TEXT":
      return bernoulli(1, all || filled(a.text) ? 1 : 0, 0, score);
    default:
      return null;
  }
}

const total = (units: ChanceUnits[]): ChanceUnits =>
  units.reduce(
    (s, u) => ({ units: s.units + u.units, answered: s.answered + u.answered, expected: s.expected + u.expected, variance: s.variance + u.variance, right: s.right + u.right }),
    { units: 0, answered: 0, expected: 0, variance: 0, right: 0 },
  );

function tally(sum: ChanceUnits, z: number): ChanceTally {
  const sd = Math.sqrt(sum.variance);
  // No answered unit is trivially not above chance; a rounding hair (0.9999 of a unit) must not lift a score over the bound.
  const aboveChance = sum.answered > 0 && sum.right > sum.expected + z * sd + 1e-9;
  return { answered: sum.answered, right: Math.round(sum.right * 1000) / 1000, expected: sum.expected, sd, aboveChance };
}

/**
 * The chance test from a section's units, each with the level it was written
 * for: the beginner test on A1 to `maxLevel`, the all-units test on all.
 */
export function chanceTest(units: Array<ChanceUnits & { level: Cefr }>, options: ChanceOptions = {}): ChanceTest {
  const z = options.z ?? CHANCE_Z;
  const low = total(units.filter((u) => countsForChance(u.level, options.maxLevel)));
  const sum = total(units);
  const beginner = tally(low, z);
  const all = tally(sum, z);
  const blank = sum.answered === 0;
  const enough = blank ? sum.units >= BLANK_MIN_UNITS : low.units >= (options.minUnits ?? CHANCE_MIN_UNITS);
  const atChance = enough && (blank || (!beginner.aboveChance && !all.aboveChance));
  return { units: low.units, beginner, all, enough, blank, atChance };
}

/** True for an item the beginner test counts: written for A1 to `maxLevel`. */
export const countsForChance = (level: Cefr, maxLevel: Cefr = CHANCE_MAX_LEVEL): boolean => compareLevels(level, maxLevel) <= 0;

/** The chance test of a section from its stored responses (unscored ones, e.g. writing, are skipped). */
export function sectionChance(
  responses: Array<{ itemSnapshot: Pick<ItemSnapshot, "type" | "skillTag" | "content" | "key" | "level">; score: number | null; answer: ItemAnswer | null }>,
  options: ChanceOptions = {},
): ChanceTest {
  const units = responses.flatMap((r) => {
    if (r.score === null) return [];
    const u = chanceUnitsOf(r.itemSnapshot, r.score, r.answer ?? null);
    return u ? [{ ...u, level: r.itemSnapshot.level }] : [];
  });
  return chanceTest(units, options);
}
