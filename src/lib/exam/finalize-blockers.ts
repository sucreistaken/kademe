import type { ComputedResult } from "./result";
import { isObjectiveSection, type Section } from "./types";

/**
 * What stands between a result and "finalize", as data. One pure function, so
 * the server (finalizeResult in src/lib/exam-results.ts) and the teacher's
 * result screen read the same rules and can never disagree about whether the
 * button may work.
 */

export type FinalizeBlocker =
  /** The student has not finished the exam. */
  | { code: "RUNNING" }
  /** No result has been computed yet. */
  | { code: "NO_RESULT" }
  /** A writing or speaking task still waits for its AI proposal. */
  | { code: "GRADING" }
  /** These skills carry an AI level the teacher has not confirmed or changed. */
  | { code: "UNDECIDED"; sections: Section[] }
  /** Every skill has a decider but no overall level came out (nothing to freeze). */
  | { code: "NO_OVERALL" };

/** Every reason finalize would refuse, in the order the teacher should deal with them. Empty means it may run. */
export function finalizeBlockers(computed: ComputedResult | null | undefined, ended = true): FinalizeBlocker[] {
  if (!ended) return [{ code: "RUNNING" }];
  if (!computed) return [{ code: "NO_RESULT" }];
  const out: FinalizeBlocker[] = [];
  const skills = Object.entries(computed.skills) as Array<[Section, NonNullable<ComputedResult["skills"][Section]>]>;
  if (computed.status === "AWAITING_GRADING" || skills.some(([, s]) => s.pending)) out.push({ code: "GRADING" });
  const undecided = skills.filter(([, s]) => s.decider === "AI").map(([section]) => section);
  if (undecided.length) out.push({ code: "UNDECIDED", sections: undecided });
  if (out.length === 0 && !computed.overall) out.push({ code: "NO_OVERALL" });
  return out;
}

/** The `?error=` code the finalize action puts on the redirect for the first blocker. */
export function blockerErrorCode(b: FinalizeBlocker): "running" | "NOT_READY" | "UNDECIDED" {
  if (b.code === "RUNNING") return "running";
  return b.code === "UNDECIDED" ? "UNDECIDED" : "NOT_READY";
}

export type ChecklistState = "done" | "todo" | "aiPending" | "running";

export type ChecklistRow = {
  section: Section;
  /** AUTO: scored by the engine, nothing to do. TEACHER: writing or speaking, the teacher decides. */
  kind: "AUTO" | "TEACHER";
  state: ChecklistState;
  /** Tasks the teacher still has to decide (TEACHER rows). */
  open: number;
  total: number;
  /** The first task still to decide, for the "Evaluate" link. */
  firstOpenResponseId: string | null;
};

export type ChecklistTask = { id: string; status: "PENDING" | "AI_PROPOSED" | "AI_FAILED" | "CONFIRMED" | "OVERRIDDEN"; decided: boolean };

/**
 * One row per section of the exam, from the same computed result the blockers
 * use. A writing or speaking section is done when the computed skill was
 * decided by the teacher (every task confirmed or changed, or a skill
 * override); otherwise it points at the first task that is still open.
 */
export function finalizeChecklist(input: {
  sections: readonly string[];
  computed: ComputedResult | null | undefined;
  /** Sections whose run has been handed in. */
  submitted: ReadonlySet<string>;
  /** The graded tasks of each writing or speaking section, in order. */
  tasks: Partial<Record<string, ChecklistTask[]>>;
}): { rows: ChecklistRow[]; done: number; total: number } {
  const rows = input.sections.map((name): ChecklistRow => {
    const section = name as Section;
    const skill = input.computed?.skills[section];
    if (isObjectiveSection(section)) {
      const state: ChecklistState = input.submitted.has(section) && skill?.level ? "done" : "running";
      return { section, kind: "AUTO", state, open: 0, total: 0, firstOpenResponseId: null };
    }
    const tasks = input.tasks[section] ?? [];
    const open = tasks.filter((t) => !t.decided);
    const decidedByTeacher = !!skill?.level && skill.decider === "TEACHER" && !skill.pending;
    let state: ChecklistState;
    if (decidedByTeacher) state = "done";
    else if (!input.submitted.has(section)) state = "running";
    else if (open.length === 0 || open.every((t) => t.status === "PENDING")) state = "aiPending";
    else state = "todo";
    const next = open.find((t) => t.status !== "PENDING") ?? open[0] ?? null;
    return { section, kind: "TEACHER", state, open: decidedByTeacher ? 0 : open.length, total: tasks.length, firstOpenResponseId: decidedByTeacher ? null : (next?.id ?? null) };
  });
  return { rows, done: rows.filter((r) => r.state === "done").length, total: rows.length };
}
