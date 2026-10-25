import { compareLevels, levelIndex, shiftLevel } from "../cefr";
import type { Criterion } from "../cefr-descriptors";
import type { GradingFlag } from "../grading";
import { RESULT_LEVELS, type Cefr, type ResultLevel } from "../types";
import type { CalibrationFixture } from "./types";

/**
 * What the calibration harness measures. Pure functions over the outcomes of
 * the runs, so the arithmetic is tested without a model.
 */

/** One run of one fixture through the grading path. */
export type RunOutcome = {
  status: "PROPOSED" | "EMPTY" | "UNPARSEABLE" | "ERROR";
  /** A proposal made by a fixed rule (no model call) or by the model. */
  source?: "MODEL" | "RULE";
  /** The level the skill would get (the stored `ai_level`), after the code checks. Null when nothing was proposed. */
  level: ResultLevel | null;
  /** The model's own overall judgement after the code checks. */
  overall: ResultLevel | null;
  /** The level from the model's proposal before the code checks. */
  rawLevel: ResultLevel | null;
  criteria: Partial<Record<Criterion, ResultLevel>>;
  flags: GradingFlag[];
  rawFlags: GradingFlag[];
  /** What the model wrote, for reading the failures. Not used by the summary. */
  detail?: { summary: string; rationales: Partial<Record<Criterion, string>> };
  error?: string;
};

export type FixtureResult = {
  fixture: Pick<CalibrationFixture, "id" | "task" | "kind" | "target" | "trap" | "flags">;
  taskLevel: Cefr;
  runs: RunOutcome[];
};

/** The flags whose precision and recall are reported (the others are diagnostics). */
export const MEASURED_FLAGS: GradingFlag[] = ["OFF_TOPIC", "TOO_SHORT", "NOT_GERMAN", "EMPTY", "COPIED_TASK"];

/** Signed distance in levels: positive means the proposal is above the target. */
export const levelDistance = (proposed: ResultLevel, target: ResultLevel): number => levelIndex(proposed) - levelIndex(target);

const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d);

export type Summary = {
  fixtures: number;
  runs: number;
  /** Runs that produced a level. */
  graded: number;
  /** Runs counted against the target (a run without a level is a miss). */
  exact: number | null;
  withinOne: number | null;
  /** Mean signed distance per target level, over the runs that produced a level. */
  bias: Partial<Record<ResultLevel, { mean: number; runs: number }>>;
  /** Share of fixtures on which all runs gave the same level. */
  unanimous: number | null;
  /** Share of run pairs (same fixture) that gave the same level. */
  pairwise: number | null;
  /** A0 fixtures with at least one run above A0 (or without a level), with the ids. */
  a0Misses: string[];
  a0Fixtures: number;
  /** Runs whose final level is above the task cap, and runs whose raw model level was. */
  aboveCap: number;
  rawAboveCap: number;
  /** Runs with a level two or more away from the target. */
  farMisses: Array<{ id: string; target: ResultLevel; levels: Array<ResultLevel | null> }>;
  flags: Partial<Record<GradingFlag, { precision: number | null; recall: number | null; tp: number; fp: number; fn: number }>>;
  /** Runs that carried a flag the harness only observes. */
  diagnostics: { LEVEL_CAPPED: number; A0_RAISED: number; EVIDENCE_UNVERIFIED: number };
  unparseable: number;
  errors: number;
  /** The same agreement over the fixtures nobody contests (see `contested` of `summarize`). Null without a contested list. */
  uncontested: { fixtures: number; exact: number | null; withinOne: number | null } | null;
};

/**
 * `contested`: ids of fixtures whose target an independent rater did not share
 * (`contestedFixtureIds`). The summary then also reports the agreement without
 * them, so a disagreement about an edge case is told apart from a miss.
 */
export function summarize(results: FixtureResult[], contested?: ReadonlySet<string>): Summary {
  let runs = 0;
  let graded = 0;
  let exact = 0;
  let withinOne = 0;
  const biasSum = new Map<ResultLevel, { sum: number; n: number }>();
  let unanimousFixtures = 0;
  let unanimousCounted = 0;
  let pairAgree = 0;
  let pairTotal = 0;
  const a0Misses: string[] = [];
  let a0Fixtures = 0;
  let aboveCap = 0;
  let rawAboveCap = 0;
  const farMisses: Summary["farMisses"] = [];
  const flagCounts = new Map<GradingFlag, { tp: number; fp: number; fn: number }>();
  for (const f of MEASURED_FLAGS) flagCounts.set(f, { tp: 0, fp: 0, fn: 0 });
  const diagnostics = { LEVEL_CAPPED: 0, A0_RAISED: 0, EVIDENCE_UNVERIFIED: 0 };
  let unparseable = 0;
  let errors = 0;
  const calm = { fixtures: 0, runs: 0, exact: 0, withinOne: 0 };

  for (const r of results) {
    const target = r.fixture.target;
    const cap = shiftLevel(r.taskLevel, 1);
    const levels = r.runs.map((x) => x.level);
    runs += r.runs.length;

    if (target === "A0") {
      a0Fixtures += 1;
      if (levels.some((l) => l !== "A0")) a0Misses.push(r.fixture.id);
    }

    const isCalm = !!contested && !contested.has(r.fixture.id);
    if (isCalm) calm.fixtures += 1;
    for (const run of r.runs) {
      if (isCalm) {
        calm.runs += 1;
        if (run.level && levelDistance(run.level, target) === 0) calm.exact += 1;
        if (run.level && Math.abs(levelDistance(run.level, target)) <= 1) calm.withinOne += 1;
      }
      if (run.status === "UNPARSEABLE") unparseable += 1;
      if (run.status === "ERROR") errors += 1;
      if (run.level) {
        graded += 1;
        const d = levelDistance(run.level, target);
        if (d === 0) exact += 1;
        if (Math.abs(d) <= 1) withinOne += 1;
        const b = biasSum.get(target) ?? { sum: 0, n: 0 };
        b.sum += d;
        b.n += 1;
        biasSum.set(target, b);
        if (compareLevels(run.level, cap) > 0) aboveCap += 1;
      }
      if (run.rawLevel && compareLevels(run.rawLevel, cap) > 0) rawAboveCap += 1;
      for (const d of ["LEVEL_CAPPED", "A0_RAISED", "EVIDENCE_UNVERIFIED"] as const) {
        if (run.flags.includes(d)) diagnostics[d] += 1;
      }
      // A run without a flag list (error) says nothing about flags.
      if (run.status === "PROPOSED" || run.status === "EMPTY") {
        for (const flag of MEASURED_FLAGS) {
          const c = flagCounts.get(flag)!;
          const predicted = run.flags.includes(flag);
          const must = r.fixture.flags.must.includes(flag);
          const allowed = must || (r.fixture.flags.may ?? []).includes(flag);
          if (predicted && must) c.tp += 1;
          else if (predicted && !allowed) c.fp += 1;
          else if (!predicted && must) c.fn += 1;
        }
      }
    }

    const far = levels.filter((l) => l === null || Math.abs(levelDistance(l, target)) >= 2);
    if (far.length) farMisses.push({ id: r.fixture.id, target, levels });

    const valid = levels.filter((l): l is ResultLevel => l !== null);
    if (valid.length >= 2) {
      unanimousCounted += 1;
      if (valid.every((l) => l === valid[0])) unanimousFixtures += 1;
      for (let i = 0; i < valid.length; i++) {
        for (let j = i + 1; j < valid.length; j++) {
          pairTotal += 1;
          if (valid[i] === valid[j]) pairAgree += 1;
        }
      }
    }
  }

  const bias: Summary["bias"] = {};
  for (const level of RESULT_LEVELS) {
    const b = biasSum.get(level);
    if (b && b.n) bias[level] = { mean: Math.round((b.sum / b.n) * 100) / 100, runs: b.n };
  }
  const flags: Summary["flags"] = {};
  for (const [flag, c] of flagCounts) {
    flags[flag] = { precision: ratio(c.tp, c.tp + c.fp), recall: ratio(c.tp, c.tp + c.fn), ...c };
  }

  return {
    fixtures: results.length,
    runs,
    graded,
    exact: ratio(exact, runs),
    withinOne: ratio(withinOne, runs),
    bias,
    unanimous: ratio(unanimousFixtures, unanimousCounted),
    pairwise: ratio(pairAgree, pairTotal),
    a0Misses,
    a0Fixtures,
    aboveCap,
    rawAboveCap,
    farMisses,
    flags,
    diagnostics,
    unparseable,
    errors,
    uncontested: contested ? { fixtures: calm.fixtures, exact: ratio(calm.exact, calm.runs), withinOne: ratio(calm.withinOne, calm.runs) } : null,
  };
}

/** Whether a summary meets the goals the owner set (exact, within one, A0, cap, agreement). */
export function meetsGoals(s: Summary): { ok: boolean; misses: string[] } {
  const misses: string[] = [];
  if ((s.exact ?? 0) < 0.7) misses.push("exact agreement below 70%");
  if ((s.withinOne ?? 0) < 0.95) misses.push("within one level below 95%");
  if (s.a0Misses.length) misses.push(`${s.a0Misses.length} A0 fixture(s) not A0 in every run`);
  if (s.aboveCap > 0) misses.push(`${s.aboveCap} proposal(s) above the task cap`);
  if ((s.pairwise ?? 0) < 0.9) misses.push("repeated runs agree below 90%");
  return { ok: misses.length === 0, misses };
}
