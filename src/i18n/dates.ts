import type { CandidateLocale } from "@/i18n/locale";
import { ORG_TIMEZONE } from "@/lib/org-timezone";

/**
 * Dates through Intl, in any candidate locale (the manager panel reaches them through
 * `@/lib/format`). They are shown in the organisation's zone, never the zone
 * the server process runs in: a deadline stored as the end of a day in
 * ORG_TIMEZONE reads as that day on a UTC server too. A client component gets
 * the default zone (process.env is not in the browser), the same as the
 * server unless ORG_TIMEZONE is set; pass the zone from the server then.
 */

/** Arabic keeps Latin digits (-nu-latn): the exam shows every number in Latin digits. */
const TAG: Record<CandidateLocale, string> = {
  tr: "tr-TR",
  en: "en-GB",
  de: "de-DE",
  es: "es-ES",
  ar: "ar-u-nu-latn",
};

/** "22 Eyl" / "22 Sep" */
export function shortDate(date: Date, locale: CandidateLocale, timeZone: string = ORG_TIMEZONE): string {
  return new Intl.DateTimeFormat(TAG[locale], {
    day: "numeric",
    month: "short",
    timeZone,
  }).format(date);
}

/** "22 Eyl 09:58" / "22 Sep 09:58" */
export function dateTime(date: Date, locale: CandidateLocale, timeZone: string = ORG_TIMEZONE): string {
  return new Intl.DateTimeFormat(TAG[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}
