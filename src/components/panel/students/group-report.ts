import { CEFR_LEVELS, type Cefr } from "@/lib/exam/types";

/** The part of a student row the group numbers need. */
export type GroupRow = { status: string; level: Cefr | null };

export type GroupCounts = {
  invited: number;
  /** Opened the exam: running now or already done. */
  started: number;
  /** Handed in (even if grading or review is still open). */
  finished: number;
  /** Not opened: waiting, or the link expired unused. */
  notStarted: number;
};

const FINISHED = new Set(["AWAITING_GRADING", "AWAITING_REVIEW", "FINAL", "RELEASED"]);
const STARTED = new Set(["IN_EXAM", ...FINISHED]);

export function groupCounts(rows: readonly GroupRow[]): GroupCounts {
  const started = rows.filter((r) => STARTED.has(r.status)).length;
  return {
    invited: rows.length,
    started,
    finished: rows.filter((r) => FINISHED.has(r.status)).length,
    notStarted: rows.length - started,
  };
}

/** Finished students per level, A1 to C2 in order (every level present, zero or not); a finished student with no level yet is not counted. */
export function levelDistribution(rows: readonly GroupRow[]): Record<Cefr, number> {
  const out = Object.fromEntries(CEFR_LEVELS.map((l) => [l, 0])) as Record<Cefr, number>;
  for (const r of rows) if (FINISHED.has(r.status) && r.level) out[r.level] += 1;
  return out;
}
