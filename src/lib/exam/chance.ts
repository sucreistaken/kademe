import { guessOf } from "./adaptive";
import { compareLevels } from "./cefr";
import { hasAnswer } from "./item-scoring";
import { isTextGap, type Cefr, type ItemAnswer, type ItemSnapshot } from "./types";

/**
 * The chance rule for A0 (Pre-A1): is an objective section's score credibly
 * above what pure guessing gives? If not, the section shows no German the
 * engine can tell from luck, and its level is A0 with the reason "AT_CHANCE",
 * whatever the ability band says. Pure, so the engine and the simulation share
 * it (src/lib/exam/form-simulation.ts).
 *
 * Counted in answer units, the parts the engine already scores: one per
 * single-choice item, per statement (Richtig/Falsch), per pair (matching), per
 * gap, per correct box of a tick-n item. Each unit has a chance of being right
 * by guessing alone: one over the options, a third (a half for two-way
 * statements), one over the right-hand column, a quarter for a cloze gap, one
 * over the pool for a word bank, nothing for a typed answer. Under pure
 * guessing the right units are a sum of independent Bernoullis: the expected
 * count is the sum of the chances, its variance the sum of p(1 - p). A section
 * is at chance when
 *
 *   right <= expected + CHANCE_Z * sd     (one-sided, 98%)
 *
 * Unanswered and unreached units score 0, like everywhere else.
 *
 * Only units written for A1 and A2 count (CHANCE_MAX_LEVEL), and only a
 * section with at least CHANCE_MIN_UNITS of them is judged. A real A1 student
 * is above chance on A1 to A2 material but near chance on B1 to C2, so
 * counting all of a section would call real beginners A0; and one short A1 or
 * A2 text (3 to 10 units in the bank) cannot tell A0 from A1. The placement's
 * grammar (30 such units) and the quick screen's (38) are judged; its reading
 * and listening (one A2 text or clip) are not. The simulation behind these
 * numbers is in docs/EXAM-ENGINE.md.
 *
 * A blank section (nothing answered) is at chance whatever its levels, once it
 * has BLANK_MIN_UNITS units: there is nothing to tell from luck.
 *
 * Approximations: the gaps or statements of one item are not independent
 * under real answering, but they are under pure guessing, which is the
 * hypothesis tested. A tick-n item's chance is taken as correct boxes over
 * options per box, which overstates it a little (safe side: it calls fewer
 * students above chance, never more).
 */

/** One-sided 98% bound: chosen by simulation (no German -> A0 at least 97%, A1 band false A0 at most 2%). */
export const CHANCE_Z = 2.054;
/** Fewer A1 to A2 answer units than this decide nothing: about two short texts' worth. */
export const CHANCE_MIN_UNITS = 16;
/** A blank section needs this many units to count as at chance. */
export const BLANK_MIN_UNITS = 8;
/** Units written above this level are not counted. */
export const CHANCE_MAX_LEVEL: Cefr = "A2";

/** One scored item as answer units: how many, the guessing mean and variance of its right units, and how many were right. */
export type ChanceUnits = { units: number; expected: number; variance: number; right: number };

export type ChanceTest = {
  /** Answer units counted (A1 to A2 items only, or all for a blank section). */
  units: number;
  right: number;
  /** Right units expected from pure guessing, and the sd of that count. */
  expected: number;
  sd: number;
  /** Enough units for the rule to decide. */
  enough: boolean;
  /** Nothing in the section was answered. */
  blank: boolean;
  /** Decided: not credibly above chance (or blank). */
  atChance: boolean;
};

export type ChanceOptions = { z?: number; minUnits?: number; maxLevel?: Cefr };

const bernoulli = (units: number, p: number, score: number): ChanceUnits => ({
  units,
  expected: units * p,
  variance: units * p * (1 - p),
  right: score * units,
});

/** Answer units of one scored objective item; null for an item without them (writing, speaking). */
export function chanceUnitsOf(snapshot: Pick<ItemSnapshot, "type" | "skillTag" | "content" | "key">, score: number): ChanceUnits | null {
  const c = snapshot.content;
  switch (c.kind) {
    case "CHOICE": {
      const n = Math.max(1, c.options.length);
      if (snapshot.type === "SINGLE_CHOICE") return bernoulli(1, 1 / n, score);
      const correct = snapshot.key.kind === "CHOICE" ? Math.max(1, snapshot.key.correct.length) : 1;
      return bernoulli(correct, Math.min(1, correct / n), score);
    }
    case "TFNG":
      return bernoulli(c.statements.length, c.twoWay ? 1 / 2 : 1 / 3, score);
    case "MATCHING":
      return bernoulli(c.left.length, 1 / Math.max(1, c.right.length), score);
    case "GAP": {
      if (isTextGap(snapshot)) return bernoulli(c.gaps.length, guessOf(snapshot), score);
      // An ordinary gap item: a drop-down gap is one of its choices, a typed one cannot be guessed.
      const ps = c.gaps.map((g) => (g.choices?.length ? 1 / g.choices.length : 0));
      return {
        units: ps.length,
        expected: ps.reduce((s, p) => s + p, 0),
        variance: ps.reduce((s, p) => s + p * (1 - p), 0),
        right: score * ps.length,
      };
    }
    case "SHORT_TEXT":
      return bernoulli(1, 0, score);
    default:
      return null;
  }
}

const total = (units: ChanceUnits[]): ChanceUnits =>
  units.reduce((a, u) => ({ units: a.units + u.units, expected: a.expected + u.expected, variance: a.variance + u.variance, right: a.right + u.right }), {
    units: 0,
    expected: 0,
    variance: 0,
    right: 0,
  });

/** Whether these units, together, are at chance (`blank`: nothing in the section was answered). */
export function chanceTest(units: ChanceUnits[], options: ChanceOptions & { blank?: boolean } = {}): ChanceTest {
  const z = options.z ?? CHANCE_Z;
  const sum = total(units);
  const sd = Math.sqrt(sum.variance);
  const blank = options.blank ?? false;
  const enough = sum.units >= (blank ? BLANK_MIN_UNITS : (options.minUnits ?? CHANCE_MIN_UNITS));
  // A rounding hair (0.9999 of a unit) must not lift a score over the bound.
  const atChance = enough && (blank || sum.right <= sum.expected + z * sd + 1e-9);
  return { units: sum.units, right: sum.right, expected: sum.expected, sd, enough, blank, atChance };
}

/** True for an item the rule counts: written for A1 to `maxLevel`. */
export const countsForChance = (level: Cefr, maxLevel: Cefr = CHANCE_MAX_LEVEL): boolean => compareLevels(level, maxLevel) <= 0;

type ScoredResponse = {
  itemSnapshot: Pick<ItemSnapshot, "type" | "skillTag" | "content" | "key" | "level">;
  score: number | null;
  answer: ItemAnswer | null;
};

/** The chance test of a section from its stored responses (unscored ones, e.g. writing, are skipped). */
export function sectionChance(responses: ScoredResponse[], options: ChanceOptions = {}): ChanceTest {
  const scored = responses.filter((r) => r.score !== null);
  const unitsOf = (rs: ScoredResponse[]) =>
    rs.flatMap((r) => {
      const u = chanceUnitsOf(r.itemSnapshot, r.score as number);
      return u ? [u] : [];
    });
  if (scored.length > 0 && scored.every((r) => !hasAnswer(r.itemSnapshot.type, r.answer))) return chanceTest(unitsOf(scored), { ...options, blank: true });
  return chanceTest(
    unitsOf(scored.filter((r) => countsForChance(r.itemSnapshot.level, options.maxLevel))),
    options,
  );
}
