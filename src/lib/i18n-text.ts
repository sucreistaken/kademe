import type { I18nText } from "@/db/schema/types";
import type { Locale } from "@/i18n/locale";

/** The text in the viewer's language, or the other language when that one is empty. */
export function pickText(text: I18nText | null | undefined, locale: Locale): string {
  if (!text) return "";
  const own = text[locale].trim();
  return own || text[locale === "tr" ? "en" : "tr"].trim();
}
