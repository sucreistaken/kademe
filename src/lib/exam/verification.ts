import { chanceUnitsOf } from "./chance";
import { compareLevels, levelIndex, shiftLevel } from "./cefr";
import type { Cefr, ItemAnswer, ItemSnapshot, ResultLevel } from "./types";

/**
 * The level verification verdict (docs/EXAM-ENGINE.md, "Seviye doğrulama kararı").
 *
 * A verification asks one question: does the claimed level hold? The ability
 * estimate answers a different one (how high could this student go) and its
 * ceiling turns a near-perfect pattern on easy material into B2 or C1, so the
 * verdict here never reads it. Objective skills are decided by raw points on
 * the answer units of the items served at claim-1, claim and claim+1 (the same
 * units chance.ts counts); writing and speaking by the level of each task. The
 * cut points are a convention (Goethe passes A2 at 60%), not standard-set.
 * Pure, so the engine and its tests share it.
 */

export type Band = "below" | "at" | "above";
export type BandPoints = { earned: number; served: number };
export type VerificationBands = Record<Band, BandPoints>;

/** Share of the claim-1 and claim units that must be earned to pass. */
export const PASS_POOLED = 0.6;
/** Below this share of the claim-1 and claim units the claim fails; between this and PASS_POOLED it is borderline. */
export const BORDERLINE_POOLED = 0.5;
/** The share of the claim units alone that a pass also needs. */
export const PASS_AT_CLAIM = 0.5;
/** Fewer served claim units than this decide nothing. */
export const MIN_AT_CLAIM_UNITS = 4;
/** The teacher hint: share of the pooled claim+1 units earned. */
export const HINT_ABOVE_SHARE = 0.75;
/** The hint also needs this many served claim+1 units (a single right answer is no evidence). */
export const HINT_MIN_ABOVE_UNITS = 4;

const EPS = 1e-9;

export type ObjectiveVerdict = "PASS" | "BORDERLINE" | "FAIL" | "INCONCLUSIVE";
export type ProductiveVerdict = "PASS" | "FAIL" | "SPLIT" | "TRUNCATED";
export type SkillVerdict = ObjectiveVerdict | ProductiveVerdict;

export const emptyBands = (): VerificationBands => ({ below: { earned: 0, served: 0 }, at: { earned: 0, served: 0 }, above: { earned: 0, served: 0 } });

/** Where an item written for `level` sits against the claim. A1 has nothing below it: such units fold onto the claim. */
export function bandOf(level: Cefr, claimed: Cefr): Band {
  const c = compareLevels(level, claimed);
  if (c > 0) return "above";
  if (c === 0 || claimed === "A1") return "at";
  return "below";
}

type ScoredResponse = { itemSnapshot: Pick<ItemSnapshot, "type" | "skillTag" | "content" | "key" | "level">; score: number | null; answer: ItemAnswer | null };

/**
 * Earned and served answer units of one objective section by band. Blank and
 * not-reached units are served and earn 0. An item without answer units
 * (writing, speaking) is skipped. In GRAMMAR a cloze or word bank at claim+1
 * is "above" evidence like any other item at that level.
 */
export function verificationBands(responses: ScoredResponse[], claimed: Cefr): VerificationBands {
  const bands = emptyBands();
  for (const r of responses) {
    const u = chanceUnitsOf(r.itemSnapshot, r.score ?? 0, r.answer ?? null);
    if (!u) continue;
    const b = bands[bandOf(r.itemSnapshot.level, claimed)];
    b.served += u.units;
    b.earned += Math.min(u.units, Math.max(0, u.right));
  }
  for (const b of Object.values(bands)) b.earned = Math.round(b.earned * 1000) / 1000;
  return bands;
}

/** Objective skill verdict from its bands (the AT_CHANCE rule is applied by the caller). */
export function objectiveVerdict(bands: VerificationBands): ObjectiveVerdict {
  if (bands.at.served < MIN_AT_CLAIM_UNITS) return "INCONCLUSIVE";
  const servedPooled = bands.below.served + bands.at.served;
  const pooled = (bands.below.earned + bands.at.earned) / servedPooled;
  const atClaim = bands.at.earned / bands.at.served;
  if (pooled < BORDERLINE_POOLED - EPS) return "FAIL";
  if (pooled >= PASS_POOLED - EPS && atClaim >= PASS_AT_CLAIM - EPS) return "PASS";
  return "BORDERLINE";
}

export type TaskEvidence = {
  level: ResultLevel | null;
  decider: "ENGINE" | "AI" | "TEACHER" | null;
  /** A speaking take that ran into its answer time cap. */
  truncated?: boolean;
};

/** Recordings this close to the cap (ms) count as cut by the timer. */
export const TRUNCATION_SLACK_MS = 1500;

/** True when a recording reached the answer time cap of its task. */
export const reachedAnswerCap = (durationMs: number | null | undefined, answerSeconds: number | null | undefined): boolean =>
  !!answerSeconds && answerSeconds > 0 && !!durationMs && durationMs >= answerSeconds * 1000 - TRUNCATION_SLACK_MS;

/** Levels below the claim, 0 when at or above. */
const gap = (level: ResultLevel, claimed: Cefr): number => Math.max(0, levelIndex(claimed) - levelIndex(level));

/**
 * Writing or speaking verdict from its tasks (all written at the claim). A
 * truncated take (unless the teacher already decided it) never fails the skill
 * by itself: it sends the skill to the teacher. Call only with every task graded.
 */
export function productiveVerdict(tasks: TaskEvidence[], claimed: Cefr): ProductiveVerdict {
  const flagged = tasks.filter((t) => t.truncated && t.decider !== "TEACHER");
  const rest = tasks.filter((t) => !flagged.includes(t) && t.level !== null) as Array<TaskEvidence & { level: ResultLevel }>;
  let judged: ProductiveVerdict | null = null;
  if (rest.length > 0) {
    const gaps = rest.map((t) => gap(t.level, claimed));
    if (gaps.some((g) => g >= 2) || gaps.every((g) => g > 0)) judged = "FAIL";
    else if (gaps.every((g) => g === 0)) judged = "PASS";
    else judged = "SPLIT";
  }
  if (judged === "FAIL") return "FAIL";
  if (flagged.length > 0) return "TRUNCATED";
  return judged ?? "FAIL";
}

/** The level the hint points at, or null for a C2 claim. */
export const hintLevel = (claimed: Cefr): Cefr | null => (claimed === "C2" ? null : shiftLevel(claimed, 1));

/** Pooled claim+1 units of all objective skills. */
export function pooledAbove(all: VerificationBands[]): BandPoints {
  return all.reduce((s, b) => ({ earned: s.earned + b.above.earned, served: s.served + b.above.served }), { earned: 0, served: 0 });
}

/** The claim+1 hint: enough above-claim units earned (the caller also requires every skill to pass). */
export function aboveClaimPossible(all: VerificationBands[], claimed: Cefr): boolean {
  if (hintLevel(claimed) === null) return false;
  const a = pooledAbove(all);
  return a.served >= HINT_MIN_ABOVE_UNITS && a.earned / a.served >= HINT_ABOVE_SHARE - EPS;
}

/**
 * What a skill shows: reached, not reached, or a teacher decides. A borderline
 * skill the verdict tolerates (the claim is confirmed) counts as reached.
 */
export type SkillShown = "REACHED" | "NOT_REACHED" | "REVIEW";
export function skillShown(verdict: SkillVerdict | undefined, outcome: "PASS" | "FAIL" | "INCONCLUSIVE"): SkillShown {
  if (verdict === "PASS") return "REACHED";
  if (verdict === "FAIL") return "NOT_REACHED";
  if (verdict === "BORDERLINE" && outcome === "PASS") return "REACHED";
  return "REVIEW";
}
