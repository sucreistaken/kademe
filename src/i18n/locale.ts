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

/** Owner 2026-10-23: students default to English. */
export const DEFAULT_CANDIDATE_LOCALE: CandidateLocale = "en";

export function isCandidateLocale(value: unknown): value is CandidateLocale {
  return typeof value === "string" && (CANDIDATE_LOCALES as readonly string[]).includes(value);
}

/**
 * The public front door (sign in, password setup) in the languages a visitor
 * can pick there. English first: it is the default for anyone who has not
 * chosen. Behind the door the panel still speaks only `Locale`; see
 * `panelLocaleOf`.
 */
export const AUTH_LOCALES = ["en", "de", "tr", "es"] as const;

export type AuthLocale = (typeof AUTH_LOCALES)[number];

export const DEFAULT_AUTH_LOCALE: AuthLocale = "en";

export function isAuthLocale(value: unknown): value is AuthLocale {
  return typeof value === "string" && (AUTH_LOCALES as readonly string[]).includes(value);
}

/** Each candidate language in its own script: what a picker or a summary shows. */
export const CANDIDATE_LANGUAGE_NAME: Record<CandidateLocale, string> = {
  tr: "Türkçe",
  en: "English",
  de: "Deutsch",
  es: "Español",
  ar: "العربية",
};

/** Writing direction of a candidate locale: only Arabic runs right to left. */
export function dirOf(locale: CandidateLocale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * The languages the admin panel speaks. `Locale` (tr/en) stays the language of
 * database content (`I18nText`) and of the hiring candidate flow; the panel adds
 * German on top of it.
 */
export const PANEL_LOCALES = ["tr", "en", "de"] as const;

export type PanelLocale = (typeof PANEL_LOCALES)[number];

export function isPanelLocale(value: unknown): value is PanelLocale {
  return typeof value === "string" && (PANEL_LOCALES as readonly string[]).includes(value);
}

/**
 * The content language behind a panel language. Database content (`I18nText`)
 * and hiring copy exist only in tr/en, so German reads the English text.
 */
export function contentLocale(panel: PanelLocale): Locale {
  return panel === "tr" ? "tr" : "en";
}

/**
 * The panel speaks Turkish, English and German. Anything a teacher reads that
 * is derived from a student's locale (review notes, reports) maps through here;
 * Spanish and Arabic students' notes are read in English.
 */
export function panelLocaleOf(locale: CandidateLocale): PanelLocale {
  return locale === "tr" || locale === "de" ? locale : "en";
}

/** Accept-Language for the panel's first render: tr, en or de, else the default. */
export function panelLocaleFromAcceptLanguage(header: string | null): PanelLocale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().slice(0, 2);
    if (isPanelLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

/**
 * Same as localeFromAcceptLanguage, for the exam student's five languages. A
 * browser asking for none of them gets English, not Turkish: a French or Dutch
 * student with a mistyped link should not meet a Turkish screen.
 */
export function candidateLocaleFromAcceptLanguage(header: string | null): CandidateLocale {
  if (!header) return "en";
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().slice(0, 2);
    if (isCandidateLocale(tag)) return tag;
  }
  return "en";
}
