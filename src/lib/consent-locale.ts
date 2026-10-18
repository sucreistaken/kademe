import { panelLocaleOf, type CandidateLocale, type Locale } from "@/i18n/locale";

/** The consent copy exists in Turkish and English only; it is never machine-translated. */
type ConsentBody = { tr: string; en: string };

/** A student in German, Spanish or Arabic reads the English text, with a note and a way to the Turkish one. */
export function consentIsFallback(locale: CandidateLocale): boolean {
  return locale !== "tr" && locale !== "en";
}

/**
 * The language of the consent text the student is actually shown, which is
 * what the consent record stores: Turkish for a Turkish student, English for
 * every other language, and Turkish when the student chose to read the Turkish
 * text instead (`asked`, only honoured for the fallback languages) or when no
 * English text is on file.
 */
export function consentShownLocale(locale: CandidateLocale, body: Partial<ConsentBody>, asked?: unknown): Locale {
  if (consentIsFallback(locale) && asked === "tr" && body.tr) return "tr";
  const wanted = panelLocaleOf(locale);
  return body[wanted] ? wanted : "tr";
}
