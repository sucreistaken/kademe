import type { Locale } from "@/i18n/locale";

/**
 * Timestamps for the settings and audit screens.
 *
 * `@/lib/format` is the manager panel's Turkish-only formatter and these two
 * screens render in both locales, so they go through Intl instead, the same way
 * `@/i18n/dates` does for the candidate side. The audit log also needs the year
 * and the seconds that a candidate-facing date deliberately drops: the whole
 * point of the screen is answering a question months after the fact, and two
 * views of the same recording a minute apart are two different events.
 */

const TAG: Record<Locale, string> = { tr: "tr-TR", en: "en-GB" };

/** "8 Eyl 2026 22:04:31" */
export function auditStamp(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(TAG[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/** "8 Eyl 2026 22:04" */
export function shortStamp(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(TAG[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** "2026-09-08", the value an <input type="date"> expects. */
export function dateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
