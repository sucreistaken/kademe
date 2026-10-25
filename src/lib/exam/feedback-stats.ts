import { intlTag } from "@/lib/format";

/**
 * How the school's overview of the end-of-exam survey is written down. Pure:
 * the numbers come from the database (src/server/exam-feedback.ts), this only
 * words them.
 */

/** An average with one decimal in the panel's language ("4,3" / "4.3"); "-" while there is nothing to average. */
export function formatAverage(value: number | null, locale: string): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat(intlTag(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

/** The share of those who answered "technical problem?" that said yes, as a whole percent; null when nobody answered it. */
export function technicalPercent(answered: number, yes: number): number | null {
  if (answered <= 0) return null;
  return Math.round((Math.min(yes, answered) / answered) * 100);
}
