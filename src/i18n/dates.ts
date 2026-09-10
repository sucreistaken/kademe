import type { Locale } from "@/i18n/locale";

/**
 * Candidate-facing dates. `@/lib/format` is Turkish only by design (it serves
 * the manager panel, which the company runs in one language); the candidate can
 * be reading either locale, so these go through Intl instead.
 */

const TAG: Record<Locale, string> = { tr: "tr-TR", en: "en-GB" };

/** "22 Eyl" / "22 Sep" */
export function shortDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(TAG[locale], {
    day: "numeric",
    month: "short",
  }).format(date);
}

/** "22 Eyl 09:58" / "22 Sep 09:58" */
export function dateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(TAG[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
