import type { ObjectiveSection, ProductiveSection } from "../types";
import { COURSE_TESTS, courseLabel, levelAbove, levelBelow } from "./catalog";
import {
  CRITERION_MAX,
  SPEAKING_CRITERIA,
  SPEAKING_MAX,
  WRITING_CRITERIA,
  WRITING_MAX,
  type CourseConfig,
  type CourseCriterion,
  type CourseOutcome,
  type CourseReason,
  type CourseResult,
  type CourseRules,
  type CourseTest,
} from "./types";

/**
 * The result of a course test from raw points and fixed cut scores (spec
 * 2026-10-28, "Scoring and result"). Pure: no database, no clock, no model.
 * The caller (`recomputeResult`) counts the objective units and resolves each
 * writing and speaking task's points (the teacher's, else the AI's proposal,
 * else none yet); this decides what they add up to.
 *
 * Nothing here estimates a CEFR level. A pass or a recommendation comes from
 * `points >= ceil(pct * max / 100)` and from nothing else, so a teacher can
 * check it with a calculator against the school's marking sheet.
 */

/** Points of one writing or speaking task per criterion. A missing or null criterion has no number yet. */
export type CourseTaskPoints = Partial<Record<CourseCriterion, number | null>>;

export type CourseObjectiveScore = {
  /** Scored units answered right (a teacher's "accepted as correct" counts); null while the section is not scored yet. */
  right: number | null;
  /** Every scored unit of the form's items in the section. Unanswered and not reached units count 0 of this. */
  max: number;
};

export type CourseResultInput = {
  /** Which test, which form, which cut scores. */
  config: CourseConfig;
  /** The form's objective sections. */
  objective: Partial<Record<ObjectiveSection, CourseObjectiveScore>>;
  /**
   * One entry per task of the form. Null: the form has no such section. An empty
   * list: the section exists but nothing is graded yet, so it is pending.
   */
  writing: CourseTaskPoints[] | null;
  speaking: CourseTaskPoints[] | null;
};

/**
 * The points a rule of `pct` percent of `max` asks for: `ceil(pct * max / 100)`
 * (the school's 65% of 64 is 42). The tolerance only keeps a percentage such as
 * 43.75 or 33.3 from tipping a whole number up by floating point error.
 */
export function courseMinPoints(pct: number, max: number): number {
  return Math.max(0, Math.ceil((pct * max) / 100 - 1e-9));
}

const clampPoints = (n: number, max: number): number => Math.min(max, Math.max(0, Math.round(n)));

type ProductiveScore = { points: number | null; inhalt: number | null };

/**
 * A productive section's points: per task the sum of its criteria, over several
 * tasks the mean rounded down ("keine halben Punkte, kein Aufrunden"). One
 * criterion without a number makes the whole section pending: a total that
 * hides a missing number would pass or fail a student on a guess.
 */
function scoreProductive(section: ProductiveSection, tasks: CourseTaskPoints[]): ProductiveScore {
  const criteria: readonly CourseCriterion[] = section === "WRITING" ? WRITING_CRITERIA : SPEAKING_CRITERIA;
  const cap = CRITERION_MAX[section];
  if (tasks.length === 0) return { points: null, inhalt: null };
  let sum = 0;
  let inhaltSum = 0;
  for (const task of tasks) {
    for (const criterion of criteria) {
      const given = task[criterion];
      if (typeof given !== "number" || !Number.isFinite(given)) return { points: null, inhalt: null };
      const points = clampPoints(given, cap);
      sum += points;
      if (criterion === "INHALT") inhaltSum += points;
    }
  }
  return {
    points: Math.floor(sum / tasks.length),
    inhalt: section === "WRITING" ? Math.floor(inhaltSum / tasks.length) : null,
  };
}

const share = (points: number, max: number): number => Math.round((points / max) * 1000) / 10;

export function computeCourseResult(input: CourseResultInput): CourseResult {
  const { key, form, rules } = input.config;
  const test = COURSE_TESTS[key];

  // Telc order, which is also the order the panel and the report list them in.
  const sections: CourseResult["sections"] = {};
  for (const section of ["READING", "GRAMMAR", "LISTENING"] as const) {
    const objective = input.objective[section];
    if (!objective) continue;
    sections[section] = {
      points: objective.right === null ? null : clampPoints(objective.right, objective.max),
      max: objective.max,
      pending: objective.right === null,
    };
  }
  let writingContent: number | null = null;
  if (input.writing) {
    const scored = scoreProductive("WRITING", input.writing);
    writingContent = scored.inhalt;
    sections.WRITING = { points: scored.points, max: WRITING_MAX, pending: scored.points === null };
  }
  if (input.speaking) {
    const scored = scoreProductive("SPEAKING", input.speaking);
    sections.SPEAKING = { points: scored.points, max: SPEAKING_MAX, pending: scored.points === null };
  }

  const all = Object.values(sections);
  const max = all.reduce((sum, s) => sum + s.max, 0);
  const pending = all.some((s) => s.pending);
  if (pending) {
    return { key, form, sections, total: null, max, pct: null, outcome: null, reasons: [], recommendation: null, focus: null };
  }

  const total = all.reduce((sum, s) => sum + (s.points ?? 0), 0);
  const belowPass = total < courseMinPoints(rules.passPct, max);
  const speaking = sections.SPEAKING?.points ?? null;
  const speakingBelowMin = rules.speakingMinPct !== null && speaking !== null && speaking < courseMinPoints(rules.speakingMinPct, SPEAKING_MAX);
  const contentZero = rules.writingContentZeroFails && writingContent === 0;

  const reasons: CourseReason[] = [];
  if (belowPass) reasons.push("BELOW_PASS");
  if (speakingBelowMin) reasons.push("SPEAKING_BELOW_MIN");
  if (contentZero) reasons.push("WRITING_CONTENT_ZERO");
  const outcome: CourseOutcome = reasons.length === 0 ? "PASS" : "FAIL";

  // Failed only because of speaking or the writing content, with the points of a pass: practise that skill.
  const focus = !belowPass && outcome === "FAIL" ? (speakingBelowMin ? "SPEAKING" : "WRITING") : null;

  return {
    key,
    form,
    sections,
    total,
    max,
    pct: share(total, max),
    outcome,
    reasons,
    recommendation: recommend(test, rules, { total, max, outcome, focus }),
    focus,
  };
}

/**
 * The course to continue in. Passed: the second half of an interim test's level,
 * the next level's first half after a final test. Not passed an interim test: the
 * same half again. Not passed a final test: by the points band (second half, first
 * half, the level below), or the second half with a focus when only speaking or the
 * writing content failed it.
 */
function recommend(
  test: CourseTest,
  rules: CourseRules,
  r: { total: number; max: number; outcome: CourseOutcome; focus: CourseResult["focus"] },
): string {
  const { level, kind } = test;
  if (kind === "INTERIM") return courseLabel(level, r.outcome === "PASS" ? 2 : 1);
  if (r.outcome === "PASS") {
    const above = levelAbove(level);
    return above ? courseLabel(above, 1) : courseLabel(level, 2);
  }
  if (r.focus) return courseLabel(level, 2);
  if (rules.secondHalfPct !== null && r.total >= courseMinPoints(rules.secondHalfPct, r.max)) return courseLabel(level, 2);
  if (rules.firstHalfPct !== null && r.total >= courseMinPoints(rules.firstHalfPct, r.max)) return courseLabel(level, 1);
  const below = levelBelow(level);
  // A1 has no level below: the first half again.
  return below ? courseLabel(below, 2) : courseLabel(level, 1);
}
