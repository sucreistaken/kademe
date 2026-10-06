import type { PassRules } from "./blueprint";
import { compareLevels, levelFromTheta, medianLevel, probAtOrAbove, shiftLevel } from "./cefr";
import type { Posterior } from "./adaptive";
import { placementOf, type Placement } from "./placement";
import { PRODUCTIVE_SECTIONS, type Cefr, type ExamMode, type ProductiveSection, type Section } from "./types";

/**
 * Turning section evidence into a result.
 *
 * Objective sections give a posterior on the ability scale. Productive sections
 * give a level from a grader: first the AI's proposal, then whatever the
 * teacher confirms or sets. The overall level is the lower median of the skill
 * levels, which a teacher may override with a reason.
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
    }
  | {
      section: Section;
      kind: "PRODUCTIVE";
      /** Null while no grader has produced a level yet. */
      level: Cefr | null;
      decider: Decider | null;
    };

export type SkillResult = {
  level: Cefr | null;
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

export type ComputedResult = {
  skills: Partial<Record<Section, SkillResult>>;
  overall: Cefr | null;
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

export function computeResult(input: {
  mode: ExamMode;
  claimed: Cefr | null;
  sections: SectionEvidence[];
  rules: PassRules;
  /** Teacher overrides already saved. */
  overrides?: { overall?: Cefr | null; skills?: Partial<Record<Section, Cefr>> };
}): ComputedResult {
  const skills: Partial<Record<Section, SkillResult>> = {};
  for (const e of input.sections) {
    if (e.kind === "OBJECTIVE") {
      skills[e.section] = {
        level: levelFromTheta(e.posterior.mean).level,
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
    if (s && level) skills[section as Section] = { ...s, level, decider: "TEACHER", pending: false };
  }

  const levels = Object.values(skills)
    .map((s) => s!.level)
    .filter((l): l is Cefr => l !== null);
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
    placement = placementOf(pooled, productive);
  }

  return { skills, overall, pooled, status, verification, placement };
}
