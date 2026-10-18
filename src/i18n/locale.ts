/**
 * The two locales the panel and the hiring flow ship in. Kept in one place so
 * the dictionaries and the URL parameter can never drift apart. Exam
 * candidates additionally get de, es and ar (see CANDIDATE_LOCALES).
 */
export const LOCALES = ["tr", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "tr";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Last resort when there is no assessment to read a locale from, which happens
 * on an invalid token: nothing is known about the candidate except the language
 * their browser asked for.
 */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().slice(0, 2);
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

/**
 * Languages a student can take the exam UI and the invite in. The database enum
 * `locale` holds exactly this list. Panel and hiring surfaces stay on `Locale`.
 */
export const CANDIDATE_LOCALES = ["tr", "en", "de", "es", "ar"] as const;

export type CandidateLocale = (typeof CANDIDATE_LOCALES)[number];

export function isCandidateLocale(value: unknown): value is CandidateLocale {
  return typeof value === "string" && (CANDIDATE_LOCALES as readonly string[]).includes(value);
}

/** Writing direction of a candidate locale: only Arabic runs right to left. */
export function dirOf(locale: CandidateLocale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * The panel only speaks Turkish and English. Anything a teacher reads that is
 * derived from a student's locale (review notes, reports) maps through here.
 */
export function panelLocaleOf(locale: CandidateLocale): Locale {
  return locale === "tr" ? "tr" : "en";
}

/** Same as localeFromAcceptLanguage, for the exam student's five languages. */
export function candidateLocaleFromAcceptLanguage(header: string | null): CandidateLocale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().slice(0, 2);
    if (isCandidateLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}
