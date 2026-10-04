import type { I18nText } from "@/db/schema/types";
import type { Locale } from "@/i18n/locale";

/** The text in the viewer's language, or the other language when that one is empty. */
export function pickText(text: I18nText | null | undefined, locale: Locale): string {
  if (!text) return "";
  const own = text[locale].trim();
  return own || text[locale === "tr" ? "en" : "tr"].trim();
}

/**
 * pickText plus the language the shown text is in. A text that fell back to
 * the other language is marked with its own `lang` attribute, so a screen
 * reader pronounces it right (HIRING-UX 6: "yoksa diğer dilde ve lang etiketiyle").
 */
export function pickTextLang(text: I18nText | null | undefined, locale: Locale): { text: string; lang: Locale } {
  const own = text?.[locale].trim() ?? "";
  if (own || !text) return { text: own, lang: locale };
  const other: Locale = locale === "tr" ? "en" : "tr";
  const fallback = text[other].trim();
  return fallback ? { text: fallback, lang: other } : { text: "", lang: locale };
}
