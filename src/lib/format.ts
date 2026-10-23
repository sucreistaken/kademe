import type { PanelLocale } from "@/i18n/locale";
import { dateTime as intlDateTime, shortDate as intlShortDate } from "@/i18n/dates";

/**
 * Presentation helpers for the manager panel. Kept in one place so a duration
 * reads the same way on the dashboard, in the candidate table and on the detail
 * page.
 *
 * Locale aware rather than routed through the dictionary. A span is not one
 * string, it is a unit choice ("3 gün" / "19 saat" / "12 dakika") wrapped in a
 * phrase ("... bekliyor", "... önce"), so pushing it into next-intl would mean
 * a select at every call site and six ICU messages to keep in sync with the
 * thresholds that live here. `@/i18n/dates` owns the calendar formatting and
 * this file delegates to it, so there is exactly one date implementation.
 *
 * Score formatting stays a render concern too; this file never computes.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const TAG: Record<PanelLocale, string> = { tr: "tr-TR", en: "en-GB", de: "de-DE" };

/** The Intl language tag for a panel language; anything unknown reads as Turkish, the panel default. */
export function intlTag(locale: string): string {
  return TAG[locale as PanelLocale] ?? TAG.tr;
}

/** "MT" from "Mert Toprak". Two letters at most, upper cased by locale rules. */
export function initials(fullName: string | null, locale: PanelLocale = "tr"): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toLocaleUpperCase(locale)).join("");
}

/** "8 Eyl" / "8 Sep" */
export function shortDate(date: Date, locale: PanelLocale, timeZone?: string): string {
  return intlShortDate(date, locale, timeZone);
}

/** "12 Eyl 09:41" / "12 Sep 09:41" */
export function dateTime(date: Date, locale: PanelLocale, timeZone?: string): string {
  return intlDateTime(date, locale, timeZone);
}

/** "09:41:02". The same in both locales, so it takes no locale. */
export function clockTime(date: Date): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

const SPAN_WORDS: Record<PanelLocale, { day: string; hour: string; minute: string; moments: string }> = {
  tr: { day: "gün", hour: "saat", minute: "dakika", moments: "birkaç saniye" },
  en: { day: "days", hour: "hours", minute: "minutes", moments: "a few seconds" },
  de: { day: "Tage", hour: "Stunden", minute: "Minuten", moments: "wenige Sekunden" },
};

const SPAN_WORDS_ONE: Record<PanelLocale, { day: string; hour: string; minute: string }> = {
  tr: { day: "gün", hour: "saat", minute: "dakika" },
  en: { day: "day", hour: "hour", minute: "minute" },
  de: { day: "Tag", hour: "Stunde", minute: "Minute" },
};

/** Bare magnitude of a span: "3 gün" / "3 days", "19 saat" / "19 hours". */
export function span(ms: number, locale: PanelLocale): string {
  const abs = Math.abs(ms);
  const words = SPAN_WORDS[locale];
  const one = SPAN_WORDS_ONE[locale];
  if (abs >= DAY) {
    const n = Math.floor(abs / DAY);
    return `${n} ${n === 1 ? one.day : words.day}`;
  }
  if (abs >= HOUR) {
    const n = Math.floor(abs / HOUR);
    return `${n} ${n === 1 ? one.hour : words.hour}`;
  }
  if (abs >= MINUTE) {
    const n = Math.floor(abs / MINUTE);
    return `${n} ${n === 1 ? one.minute : words.minute}`;
  }
  return words.moments;
}

/** German "vor" and "seit" take the dative: "vor 3 Tagen", "seit wenigen Sekunden". */
const dative = (text: string) => text.replace(/ Tage$/, " Tagen").replace(/^wenige /, "wenigen ");

/** "4 saat önce" / "4 hours ago". Anything under a minute reads as "just now". */
export function ago(date: Date, locale: PanelLocale, now = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return locale === "tr" ? "az önce" : locale === "de" ? "gerade eben" : "just now";
  if (locale === "tr") return `${span(diff, locale)} önce`;
  return locale === "de" ? `vor ${dative(span(diff, locale))}` : `${span(diff, locale)} ago`;
}

/** "2 gün bekliyor" / "waiting 2 days", the dashboard queue phrasing. */
export function waiting(date: Date, locale: PanelLocale, now = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return locale === "tr" ? "yeni geldi" : locale === "de" ? "gerade eingegangen" : "just arrived";
  if (locale === "tr") return `${span(diff, locale)} bekliyor`;
  return locale === "de" ? `wartet seit ${dative(span(diff, locale))}` : `waiting ${span(diff, locale)}`;
}

/** Time left before a deadline. Past deadlines say so rather than going negative. */
export function remaining(date: Date, locale: PanelLocale, now = new Date()): string {
  const diff = date.getTime() - now.getTime();
  if (diff <= 0) return locale === "tr" ? "süresi doldu" : locale === "de" ? "abgelaufen" : "expired";
  return span(diff, locale);
}

/** "2:41" for a media duration. */
export function mediaLength(ms: number | null): string {
  if (!ms) return "-";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** "1 180 karakter" / "1,180 characters", grouped so it does not read as 1180. */
export function charCount(text: string, locale: PanelLocale): string {
  const n = text.length.toLocaleString(TAG[locale]);
  return locale === "tr" ? `${n} karakter` : locale === "de" ? `${n} Zeichen` : `${n} characters`;
}

/**
 * "3,5" in Turkish and German, "3.5" in English. `formatScore` in scoring.ts is Turkish
 * only and is left alone because its tests pin that output; the panel renders
 * through this one instead, and a null score is the caller's empty state to
 * name, not this function's.
 */
export function score(n: number, locale: PanelLocale): string {
  return n.toFixed(1).replace(".", locale === "en" ? "." : ",");
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}
