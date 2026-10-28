import { itemTally } from "../answer-tally";
import type { ComputedResult, SkillResult } from "../result";
import { isObjectiveSection, type ItemAnswer, type ItemSnapshot, type ObjectiveSection, type ProductiveSection, type Section } from "../types";
import { courseSections } from "./catalog";
import { COURSE_CRITERIA, resolveCourseTask, type CourseGradingView, type ResolvedCourseTask } from "./decisions";
import { computeCourseResult, type CourseObjectiveScore } from "./result";
import type { CourseConfig } from "./types";
import { courseUnits } from "./units";

/**
 * A course test's `ComputedResult` from the rows the database holds. Pure, so
 * `recomputeResult` only reads rows and writes the answer, and every rule about
 * what counts is testable without a database.
 *
 * What counts (spec 2026-10-28, "Scoring and result"):
 * - an objective section: units answered right (a gap, a statement, a matching
 *   row, an item; a teacher's "accepted as correct" counts) of every unit of the
 *   form's items in it. Unanswered and not reached units are 0 of the maximum.
 * - a section nobody ran, once the attempt has ended: 0, as not reached. While
 *   the attempt still runs it is pending. A section the system skipped (the bank
 *   lost its items) stays pending: nobody earned that zero.
 * - writing and speaking: the points of each task, the teacher's where decided,
 *   else the AI's proposal, else none (pending).
 */

export type CourseRunView = { id: string; section: Section; submittedAt: Date | null; completion: string };

export type CourseResponseView = {
  id: string;
  sectionRunId: string;
  sequence: number;
  itemSnapshot: ItemSnapshot;
  answer: ItemAnswer | null;
  score: number | null;
};

export type CourseGradingRow = CourseGradingView & { itemResponseId: string };

export type CourseComputedInput = {
  config: CourseConfig;
  /** The exam's enabled sections, in order. */
  sections: readonly Section[];
  runs: readonly CourseRunView[];
  responses: readonly CourseResponseView[];
  gradings: readonly CourseGradingRow[];
  /** Teacher acceptances by response id (`gapIds` empty: the whole short answer). */
  acceptances: Readonly<Record<string, { gapIds: string[] }>>;
  /** The attempt is over (completed or terminated): a section never run counts 0. */
  ended: boolean;
};

/** The section was run and handed in (or closed by the clock). A skipped one has no answers either. */
const closed = (run: CourseRunView | undefined): boolean => !!run?.submittedAt && run.completion !== "SKIPPED";

function objectiveScore(
  run: CourseRunView | undefined,
  rows: readonly CourseResponseView[],
  acceptances: CourseComputedInput["acceptances"],
  planUnits: number,
  ended: boolean,
): CourseObjectiveScore {
  if (!closed(run)) {
    // Nobody ran it: 0 once the attempt is over, unless the system skipped the section.
    return { right: ended && run?.completion !== "SKIPPED" ? 0 : null, max: planUnits };
  }
  if (rows.length === 0) return { right: 0, max: planUnits };
  let right = 0;
  let max = 0;
  for (const r of rows) {
    right += itemTally(r, acceptances[r.id])?.correct ?? 0;
    max += courseUnits(r.itemSnapshot);
  }
  return { right, max };
}

const zeroTask = (section: ProductiveSection): ResolvedCourseTask => ({
  points: Object.fromEntries(COURSE_CRITERIA[section].map((id) => [id, 0])),
  complete: true,
  proposed: true,
  decided: true,
});

function productiveTasks(
  section: ProductiveSection,
  run: CourseRunView | undefined,
  rows: readonly CourseResponseView[],
  gradingOf: ReadonlyMap<string, CourseGradingRow>,
  planTasks: number,
  ended: boolean,
): ResolvedCourseTask[] {
  if (run?.completion === "SKIPPED") return [];
  if (!closed(run)) return ended ? Array.from({ length: planTasks }, () => zeroTask(section)) : [];
  return [...rows].sort((a, b) => a.sequence - b.sequence).map((r) => resolveCourseTask(section, gradingOf.get(r.id)));
}

export function buildCourseComputed(input: CourseComputedInput): ComputedResult {
  const { config, ended } = input;
  const plan = courseSections(config.key);
  const planned = (section: Section) => plan.find((p) => p.section === section)?.units ?? 0;
  const gradingOf = new Map(input.gradings.map((g) => [g.itemResponseId, g]));

  const objective: Partial<Record<ObjectiveSection, CourseObjectiveScore>> = {};
  const tasks: Partial<Record<ProductiveSection, ResolvedCourseTask[]>> = {};
  for (const section of input.sections) {
    const run = input.runs.find((r) => r.section === section);
    const rows = run ? input.responses.filter((r) => r.sectionRunId === run.id) : [];
    if (isObjectiveSection(section)) objective[section] = objectiveScore(run, rows, input.acceptances, planned(section), ended);
    else tasks[section] = productiveTasks(section, run, rows, gradingOf, planned(section), ended);
  }

  const course = computeCourseResult({
    config,
    objective,
    writing: tasks.WRITING ? tasks.WRITING.map((t) => t.points) : null,
    speaking: tasks.SPEAKING ? tasks.SPEAKING.map((t) => t.points) : null,
  });

  // Who stands behind each productive section, in the shape the blockers and the checklist already read: no CEFR
  // level (a course test has none), the decider, and pending while a task has neither a proposal nor a decision
  // (the AI is working, it failed, or the task has no grading yet). A proposal that still lacks one number
  // (AUSSPRACHE from a transcript) is the teacher's to complete, so it is "AI", not pending, although the
  // section's points stay pending in `course` until the number is set.
  const skills: Partial<Record<Section, SkillResult>> = {};
  for (const section of ["WRITING", "SPEAKING"] as const) {
    const list = tasks[section];
    if (!list) continue;
    const proposed = list.length > 0 && list.every((t) => t.proposed);
    const decided = proposed && list.every((t) => t.decided);
    skills[section] = { level: null, decider: decided ? "TEACHER" : proposed ? "AI" : null, pending: !proposed, insufficient: false };
  }

  const waitingForPoints = Object.entries(course.sections).some(([section, s]) => s.pending && !skills[section as Section]?.decider);
  const anyOpen = Object.values(skills).some((s) => s.decider === "AI");
  return {
    skills,
    overall: null,
    pooled: null,
    status: waitingForPoints ? "AWAITING_GRADING" : anyOpen ? "AWAITING_REVIEW" : "READY",
    verification: null,
    placement: null,
    course,
  };
}
