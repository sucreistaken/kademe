import type { CourseKey, CourseOutcome, CoursePoints, CourseResult, CourseRules } from "@/lib/exam/course/types";
import { intlTag } from "@/lib/format";
import { isObjectiveSection, type Section } from "@/lib/exam/types";
import { isDecidedStatus, pointsTotal, type CourseGradingStatus } from "./grading-model";
import { sectionMaxOf } from "./totals";

/**
 * The course test result screen as data (spec 2026-10-28): Halil Bey's
 * Bewertungsbogen turned into rows the page draws. Pure, so the screen and its
 * tests agree and the page holds no rule of its own.
 */

export type SheetRow = { section: Section; points: number | null; max: number; pending: boolean };

/**
 * The section table of the sheet ("Prüfungsteil, max., erreicht"): one row per
 * section of the exam in its order, with the engine's points when it has them.
 * A section the engine has not reported yet is pending, with the catalog's
 * maximum.
 */
export function sheetRows(sections: readonly string[], course: CourseResult | null | undefined, key: CourseKey): SheetRow[] {
  return sections.map((name) => {
    const section = name as Section;
    const row = course?.sections[section];
    return { section, points: row?.points ?? null, max: row?.max ?? sectionMaxOf(key, section), pending: row ? row.pending : true };
  });
}

export type Thresholds = {
  /** Points needed to pass: `ceil(pct * max / 100)`, Halil Bey's 65% of 64 is 42. */
  pass: number;
  /** The rule's own percentage, for the sentence under the sheet. */
  passPct: number;
  /** FINAL only: the speaking minimum in points (60% of 20 is 12), else null. */
  speakingMin: number | null;
  speakingMinPct: number | null;
  /** Writing INHALT 0 fails the test whatever the total. */
  contentZeroFails: boolean;
  /** FINAL only: from here a student who did not pass goes back to the second half of the level, else null. */
  secondHalf: number | null;
  /** FINAL only: from here to the first half; below it, the level below. */
  firstHalf: number | null;
};

const need = (pct: number, of: number): number => Math.ceil((pct * of) / 100);

/** The cut scores of a course test in points, for the line under the sheet. */
export function courseThresholds(rules: CourseRules, max: number, speakingMax: number): Thresholds {
  return {
    pass: need(rules.passPct, max),
    passPct: rules.passPct,
    speakingMin: rules.speakingMinPct === null ? null : need(rules.speakingMinPct, speakingMax),
    speakingMinPct: rules.speakingMinPct,
    contentZeroFails: rules.writingContentZeroFails,
    secondHalf: rules.secondHalfPct === null ? null : need(rules.secondHalfPct, max),
    firstHalf: rules.firstHalfPct === null ? null : need(rules.firstHalfPct, max),
  };
}

export type ChecklistState = "done" | "todo" | "aiPending" | "running";
export type CourseChecklistRow = {
  section: Section;
  /** AUTO: counted by the engine, nothing to do. TEACHER: writing or speaking, the teacher decides. */
  kind: "AUTO" | "TEACHER";
  state: ChecklistState;
  /** Tasks the teacher still has to decide (TEACHER rows). */
  open: number;
  total: number;
  /** The first task still to decide, for the "Bewerten" link: one with an AI proposal first. */
  firstOpenResponseId: string | null;
};

/**
 * Where the teacher is: one row per section. A writing or speaking section is
 * done when every task is confirmed or changed (a teacher may grade while the
 * AI proposal is still on its way, so a pending task counts as open).
 */
export function courseChecklist(input: {
  sections: readonly string[];
  /** Sections whose run has been handed in. */
  submitted: ReadonlySet<string>;
  /** The graded tasks of each writing or speaking section, in order. */
  tasks: Partial<Record<string, Array<{ id: string; status: CourseGradingStatus }>>>;
}): { rows: CourseChecklistRow[]; done: number; total: number } {
  const rows = input.sections.map((name): CourseChecklistRow => {
    const section = name as Section;
    if (isObjectiveSection(section)) {
      return { section, kind: "AUTO", state: input.submitted.has(section) ? "done" : "running", open: 0, total: 0, firstOpenResponseId: null };
    }
    const tasks = input.tasks[section] ?? [];
    const open = tasks.filter((t) => !isDecidedStatus(t.status));
    const state: ChecklistState = !input.submitted.has(section) ? "running" : tasks.length === 0 ? "aiPending" : open.length === 0 ? "done" : "todo";
    const next = open.find((t) => t.status !== "PENDING") ?? open[0] ?? null;
    return { section, kind: "TEACHER", state, open: open.length, total: tasks.length, firstOpenResponseId: state === "todo" ? (next?.id ?? null) : null };
  });
  return { rows, done: rows.filter((r) => r.state === "done").length, total: rows.length };
}

export type CourseBlocker = "RUNNING" | "NO_RESULT" | "UNDECIDED" | "NOT_READY";

/**
 * What stands between a course result and "finalize", in the order the
 * teacher should deal with them. Empty means the button may work; the server
 * (finalizeResult) applies its own check on top, and a refusal comes back
 * under the button.
 */
export function courseBlockers(input: {
  ended: boolean;
  /** The engine has stored a course result for this attempt. */
  hasResult: boolean;
  /** Writing and speaking tasks no teacher has confirmed or changed. */
  open: number;
  /** The outcome as it stands: the teacher's decision, else the engine's; null while a section is pending. */
  outcome: CourseOutcome | null;
}): CourseBlocker[] {
  if (!input.ended) return ["RUNNING"];
  if (!input.hasResult) return ["NO_RESULT"];
  if (input.open > 0) return ["UNDECIDED"];
  return input.outcome === null ? ["NOT_READY"] : [];
}

/** The decided point total of each task of a section, in order; null for a task nobody decided yet. */
export function taskTotals(tasks: ReadonlyArray<{ status: CourseGradingStatus; points: CoursePoints | null }>): Array<number | null> {
  return tasks.map((t) => (isDecidedStatus(t.status) && t.points ? pointsTotal(t.points) : null));
}

/** A percentage the way the panel's language writes it: "70,3" in German and Turkish, "70.3" in English, one decimal at most. */
export function percentText(pct: number, locale: string): string {
  return new Intl.NumberFormat(intlTag(locale), { maximumFractionDigits: 1 }).format(pct);
}

/** Words the way the existing result page counts them: runs of non-space characters. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type HistoryEntry =
  | { kind: "points"; at: Date; who: string | null; from: number | null; to: number; reason: string }
  | { kind: "errors"; at: Date; who: string | null; count: number }
  | { kind: "outcome"; at: Date; who: string | null; from: string | null; to: string; reason: string }
  | { kind: "other"; at: Date; who: string | null; text: string };

type GradingRevision = { at: Date; changedBy: string | null; before: Record<string, unknown> | null; after: Record<string, unknown>; reason: string };
type ResultRevision = { at: Date; changedBy: string | null; field: string; before: unknown; after: unknown; reason: string | null };

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

/**
 * One list for the "Änderungsverlauf": the rubric decisions (points before and
 * after, or the number of ticked boxes), the teacher's PASS or FAIL, and the
 * other result steps (finalize, release), newest first.
 */
export function courseHistory(gradingRevs: readonly GradingRevision[], resultRevs: readonly ResultRevision[]): HistoryEntry[] {
  const fromGradings = gradingRevs.map((r): HistoryEntry => {
    const total = num(r.after.total);
    if (total !== null) return { kind: "points", at: r.at, who: r.changedBy, from: num(r.before?.total), to: total, reason: r.reason };
    if (Array.isArray(r.after.commonErrors)) return { kind: "errors", at: r.at, who: r.changedBy, count: r.after.commonErrors.length };
    return { kind: "other", at: r.at, who: r.changedBy, text: r.reason };
  });
  const fromResult = resultRevs.map((r): HistoryEntry =>
    r.field === "course_outcome"
      ? { kind: "outcome", at: r.at, who: r.changedBy, from: typeof r.before === "string" ? r.before : null, to: String(r.after ?? ""), reason: r.reason ?? "" }
      : { kind: "other", at: r.at, who: r.changedBy, text: `${r.field}: ${r.after ?? ""}${r.reason ? ` (${r.reason})` : ""}` },
  );
  return [...fromGradings, ...fromResult].sort((a, b) => b.at.getTime() - a.at.getTime());
}
