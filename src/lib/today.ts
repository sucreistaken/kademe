import type { TodayItem, TodayTaskKind } from "@/solutions/types";

/**
 * HIRING-VISUAL-FLOW 4.3, M2: what the shared Today screen orders. The review
 * queue is the exam's, sorted exactly as the dashboard always did (oldest
 * first); the next task follows K10: a data-rights request (a legal clock),
 * then an accommodation request (a candidate waits), then a decision, then the
 * oldest review. In plan 2b hiring emits only accommodation tasks (ruling C6);
 * the data-rights and decision ranks are kept for plan 3.
 */
const RANK: Record<TodayTaskKind, number> = { DATA_RIGHTS: 0, ACCOMMODATION: 1, DECISION: 2 };
const time = (item: TodayItem) => item.sortAt?.getTime() ?? 0;

export function reviewQueue(items: TodayItem[]): TodayItem[] {
  return items.filter((i) => i.lane === "review").sort((a, b) => time(a) - time(b));
}

export function pickNextTask(items: TodayItem[]): TodayItem | null {
  const tasks = items.filter((i) => i.lane === "task" && i.task).sort((a, b) => RANK[a.task!] - RANK[b.task!] || time(a) - time(b));
  return tasks[0] ?? reviewQueue(items)[0] ?? null;
}

export const attentionRows = (items: TodayItem[]) => items.filter((i) => i.lane === "attention");

/**
 * "N iş seni bekliyor": what waits for a person, each thing once. A task is
 * not counted on its own: its opening's attention row already counts it
 * (TodayItem.lane; hiringToday emits an accommodation request as a task and
 * in its opening's requests row, whose date is its oldest request's).
 */
export function todaySummary(items: TodayItem[]): { count: number; oldest: Date | null } {
  const waiting = items.filter((i) => i.lane === "review" || i.lane === "attention");
  const dated = waiting.map((i) => i.sortAt).filter((d): d is Date => d !== null);
  return { count: waiting.length, oldest: dated.length ? new Date(Math.min(...dated.map((d) => d.getTime()))) : null };
}

/** 4.3: Today has one filled button: the next task's; without one, the invite (in the header, or in the empty state when nothing waits). */
export function inviteEmphasis(input: { next: boolean; attention: number }): "outline" | "filled" | "empty" {
  if (input.next) return "outline";
  return input.attention > 0 ? "filled" : "empty";
}
