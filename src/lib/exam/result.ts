import type { PassRules } from "./blueprint";
import { PRE_A1_CUT, compareLevels, levelFromTheta, medianLevel, probAtOrAbove, shiftLevel } from "./cefr";
import type { Posterior } from "./adaptive";
import type { ChanceTest } from "./chance";
import { placementOf, type Placement } from "./placement";
import { PRODUCTIVE_SECTIONS, type Cefr, type ExamMode, type ProductiveSection, type ResultLevel, type Section } from "./types";

/**
 * Turning section evidence into a result.
 *
 * Objective sections give a posterior on the ability scale. Productive sections
 * give a level from a grader: first the AI's proposal, then whatever the
 * teacher confirms or sets. The overall level is the lower median of the skill
 * levels, which a teacher may override with a reason.
 *
 * Levels here are result levels: below the A1 band a section is A0 (Pre-A1),
 * see `objectiveLevel`, and so is a section whose score is not credibly above
 * pure guessing (`chance`, reason AT_CHANCE, see chance.ts). A claimed level
 * stays a CEFR level (A1 to C2), so A0 is below every claim.
 *
 * Nothing in here decides for the teacher. `status` says what is still open,
 * and a verification is INCONCLUSIVE rather than FAIL while a skill is still
 * waiting for its grader.
 */

export type Decider = "ENGINE" | "AI" | "TEACHER";

export type SectionEvidence =
  | {
      section: Section;
      kind: "OBJECTIVE";
      posterior: Posterior;
      answered: number;
      /** Below the section's minimum: too little to trust the level. */
      insufficient: boolean;
      /** The section's answers against pure guessing (chance.ts); absent where nobody computed it. */
      chance?: (Pick<ChanceTest, "atChance"> & Partial<Pick<ChanceTest, "blank" | "beginner" | "all">>) | null;
    }
  | {
      section: Section;
      kind: "PRODUCTIVE";
      /** Null while no grader has produced a level yet. */
      level: ResultLevel | null;
      decider: Decider | null;
    };

/** Why a skill has its level, when it is not the plain band: AT_CHANCE is A0 by the chance rule. */
export type SkillReason = "AT_CHANCE";

export type SkillResult = {
  level: ResultLevel | null;
  /** Set when the level comes from a rule the teacher should see (AT_CHANCE). A teacher's level drops it. */
  reason?: SkillReason;
  /** AT_CHANCE only: the answered A1 to A2 units the rule tested, or a blank section. */
  chance?: { right: number; answered: number; blank: boolean };
  decider: Decider | null;
  /** Objective sections only. */
  posterior?: Posterior;
  pending: boolean;
  insufficient: boolean;
};

export type VerificationReason =
  | "AWAITING_GRADING"
  | "INSUFFICIENT_EVIDENCE"
  | "OVERALL_BELOW_CLAIMED"
  | `SKILL_BELOW:${Section}`
  | `REQUIRED_SKILL_BELOW:${Section}`
  | "HOLD_PROBABILITY_LOW";

/**
 * Why a result must wait for a teacher whatever its mode. CHANCE_BELOW_POOLED: a
 * section at chance pulls the overall level to A0 while the pooled estimate is
 * at or above the A1 band; the two disagree, so a person decides.
 */
export type ReviewReason = "CHANCE_BELOW_POOLED";

export type ComputedResult = {
  skills: Partial<Record<Section, SkillResult>>;
  overall: ResultLevel | null;
  /** Absent on results stored before it existed, and when there is no such reason. */
  reviewReasons?: ReviewReason[];
  /** From the objective sections pooled together. Null without any. */
  pooled: Posterior | null;
  status: "AWAITING_GRADING" | "AWAITING_REVIEW" | "READY";
  verification: {
    claimed: Cefr;
    outcome: "PASS" | "FAIL" | "INCONCLUSIVE";
    reasons: VerificationReason[];
    holdProbability: number | null;
  } | null;
  /**
   * PLACEMENT only: sublevel and borderline flag from the pooled objective
   * posterior. Null otherwise; absent on results stored before it existed.
   */
  placement?: Placement | null;
};

/**
 * Combine independent normal posteriors by precision weighting. Each section
 * started from the same wide prior, which this counts more than once; with a
 * prior sd of 1.5 against section sds near 0.5 the effect is small, and it
 * pulls toward the anchor, i.e. it errs toward not over-placing.
 */
export function poolPosteriors(ps: Posterior[]): Posterior | null {
  const usable = ps.filter((p) => p.sd > 0);
  if (usable.length === 0) return null;
  const precision = usable.reduce((a, p) => a + 1 / (p.sd * p.sd), 0);
  const mean = usable.reduce((a, p) => a + p.mean / (p.sd * p.sd), 0) / precision;
  return { mean, sd: Math.sqrt(1 / precision) };
}

/**
 * An objective section's level by its band. Below the A1 band it is A0
 * (Pre-A1), but not when `keepA1`: a section that stopped short of its minimum
 * (a few answers, and the unanswered ones counted wrong, say too little to call
 * someone a beginner without any German; such a result never finalizes by
 * itself), or one whose answers are credibly above chance (A0 means "shows no
 * German"; blanks count as wrong in the estimate and can pull a student who
 * answered some gaps right below the band). The teacher can still set A0.
 */
export function objectiveLevel(posterior: Posterior, keepA1: boolean): ResultLevel {
  const { level, belowScale } = levelFromTheta(posterior.mean);
  return belowScale && !keepA1 ? "A0" : level;
}

/** The section's answers are credibly above chance on either test (chance.ts): it shows German. */
const showsGerman = (chance: { beginner?: { aboveChance: boolean }; all?: { aboveChance: boolean } } | null | undefined): boolean =>
  chance?.beginner?.aboveChance === true || chance?.all?.aboveChance === true;

export function computeResult(input: {
  mode: ExamMode;
  claimed: Cefr | null;
  sections: SectionEvidence[];
  rules: PassRules;
  /** Teacher overrides already saved. */
  overrides?: { overall?: ResultLevel | null; skills?: Partial<Record<Section, ResultLevel>> };
}): ComputedResult {
  const skills: Partial<Record<Section, SkillResult>> = {};
  for (const e of input.sections) {
    if (e.kind === "OBJECTIVE") {
      // Not credibly above guessing: A0 whatever the band says (chance.ts decides only with enough units).
      const atChance = e.chance?.atChance === true;
      const tested = e.chance?.beginner;
      skills[e.section] = {
        level: atChance ? "A0" : objectiveLevel(e.posterior, e.insufficient || showsGerman(e.chance)),
        ...(atChance
          ? { reason: "AT_CHANCE" as const, chance: { right: tested?.right ?? 0, answered: tested?.answered ?? 0, blank: e.chance?.blank ?? false } }
          : {}),
        decider: "ENGINE",
        posterior: e.posterior,
        pending: false,
        insufficient: e.insufficient,
      };
    } else {
      skills[e.section] = {
        level: e.level,
        decider: e.decider,
        pending: e.level === null,
        insufficient: false,
      };
    }
  }
  for (const [section, level] of Object.entries(input.overrides?.skills ?? {})) {
    const s = skills[section as Section];
    if (!s || !level) continue;
    // The teacher's level is not the chance rule's: its reason and tally go.
    const { reason: _reason, chance: _chance, ...rest } = s;
    void _reason;
    void _chance;
    skills[section as Section] = { ...rest, level, decider: "TEACHER", pending: false };
  }

  const levels = Object.values(skills)
    .map((s) => s!.level)
    .filter((l): l is ResultLevel => l !== null);
  const anyPending = Object.values(skills).some((s) => s!.pending);
  const overall = input.overrides?.overall ?? (anyPending ? null : medianLevel(levels));

  const pooled = poolPosteriors(
    input.sections.flatMap((e) => (e.kind === "OBJECTIVE" ? [e.posterior] : [])),
  );

  const needsTeacher = Object.values(skills).some((s) => s!.decider === "AI");
  const status = anyPending ? "AWAITING_GRADING" : needsTeacher ? "AWAITING_REVIEW" : "READY";

  let verification: ComputedResult["verification"] = null;
  if (input.mode === "LEVEL_VERIFICATION" && input.claimed) {
    const claimed = input.claimed;
    const rules = input.rules;
    const reasons: VerificationReason[] = [];
    const holdProbability = pooled ? probAtOrAbove(pooled, claimed) : null;

    if (anyPending) reasons.push("AWAITING_GRADING");
    const requiredMissing = rules.requiredSkills.some((sec) => !skills[sec]?.level);
    if (Object.values(skills).some((s) => s!.insufficient) || requiredMissing) reasons.push("INSUFFICIENT_EVIDENCE");
    const inconclusive = reasons.length > 0;

    if (!inconclusive) {
      if (rules.overallAtLeastClaimed && overall && compareLevels(overall, claimed) < 0)
        reasons.push("OVERALL_BELOW_CLAIMED");
      if (rules.minSkillOffset !== null) {
        const floor = shiftLevel(claimed, rules.minSkillOffset);
        for (const [section, s] of Object.entries(skills)) {
          if (s!.level && compareLevels(s!.level, floor) < 0) reasons.push(`SKILL_BELOW:${section as Section}`);
        }
      }
      for (const section of rules.requiredSkills) {
        const s = skills[section];
        if (s?.level && compareLevels(s.level, claimed) < 0) reasons.push(`REQUIRED_SKILL_BELOW:${section}`);
      }
      if (rules.minHoldProbability !== null && holdProbability !== null && holdProbability < rules.minHoldProbability)
        reasons.push("HOLD_PROBABILITY_LOW");
    }

    verification = {
      claimed,
      outcome: inconclusive ? "INCONCLUSIVE" : reasons.length === 0 ? "PASS" : "FAIL",
      reasons,
      holdProbability,
    };
  }

  let placement: Placement | null = null;
  if (input.mode === "PLACEMENT") {
    const productive = PRODUCTIVE_SECTIONS.flatMap((section: ProductiveSection) => {
      const level = skills[section]?.level;
      return level ? [{ section, level }] : [];
    });
    const insufficient = input.sections.some((e) => e.kind === "OBJECTIVE" && e.insufficient);
    placement = placementOf(pooled, productive, { insufficient });
  }

  const reviewReasons: ReviewReason[] = [];
  if (overall === "A0" && pooled && pooled.mean >= PRE_A1_CUT && Object.values(skills).some((s) => s?.reason === "AT_CHANCE")) reviewReasons.push("CHANCE_BELOW_POOLED");

  return { skills, overall, pooled, status, verification, placement, ...(reviewReasons.length ? { reviewReasons } : {}) };
}

/**
 * True when the engine itself is not sure enough to release a level on its own:
 * the placement is borderline (near a cut, imprecise, or a productive gap), or
 * it recommends a level other than the computed one; or, in any mode, a review
 * reason (CHANCE_BELOW_POOLED). Such a result waits for a teacher even when no
 * writing or speaking is involved.
 */
export function isUncertainResult(computed: Pick<ComputedResult, "overall" | "placement" | "reviewReasons"> | null | undefined): boolean {
  if (computed?.reviewReasons?.length) return true;
  const p = computed?.placement;
  if (!p) return false;
  return p.borderline || p.reasons.includes("HIGH_UNCERTAINTY") || (p.recommended !== null && p.recommended !== computed?.overall);
}

/**
 * The engine finalizes by itself only when nothing needs a person: no writing
 * or speaking, nothing undecided, complete and clean evidence, and a clear
 * (not uncertain) computed result.
 */
export function autoFinalizes(input: {
  status: string;
  hasProductive: boolean;
  anyUndecided: boolean;
  clean: boolean;
  computed: Pick<ComputedResult, "overall" | "placement" | "reviewReasons"> | null | undefined;
}): boolean {
  return input.status === "AWAITING_REVIEW" && !input.hasProductive && !input.anyUndecided && input.clean && !isUncertainResult(input.computed);
}

/** What the finished screen tells the student while the result is not final. */
export function studentWaitingFor(input: {
  hasProductive: boolean;
  final: boolean;
  computed: Pick<ComputedResult, "overall" | "placement" | "reviewReasons"> | null | undefined;
}): "PRODUCTIVE" | "REVIEW" | null {
  if (input.final) return null;
  if (input.hasProductive) return "PRODUCTIVE";
  return isUncertainResult(input.computed) ? "REVIEW" : null;
}
