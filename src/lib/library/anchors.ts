import type { I18nText } from "@/db/schema/types";
import type { Locale } from "@/i18n/locale";

/**
 * Behavioural anchors (HIRING-UX 3.3). A competency's levels 1, 3 and 5 must be
 * written before anything that measures it is published; 2 and 4 are optional.
 * Pure: the library form, the publish gate and the scorecard share it.
 */
export const REQUIRED_ANCHOR_LEVELS = [1, 3, 5] as const;
export const ANCHOR_LEVELS = [1, 2, 3, 4, 5] as const;

/** HIRING-UX 5.10: at most six observation tags on each side. */
export const MAX_TAGS_PER_SIDE = 6;

/** Length bounds per language, checked by the server actions and set as maxLength on the inputs. */
export const COMPETENCY_NAME_MAX = 120;
export const TAG_LABEL_MAX = 80;

/** Written in at least one language. A one-language org must not be blocked. */
export function hasText(text: I18nText | null | undefined): boolean {
  return !!text && (text.tr.trim().length > 0 || text.en.trim().length > 0);
}

export function missingAnchorLevels(anchors: Partial<Record<number, I18nText>>): number[] {
  return REQUIRED_ANCHOR_LEVELS.filter((level) => !hasText(anchors[level]));
}

export type AnchorHint = "ADJECTIVE" | "TOO_SHORT";

/**
 * Words that describe a person instead of something a reviewer can observe.
 * The check is a nudge (HIRING-UX 5.10 "kural tabanlı"), never a gate.
 */
const TRAIT_WORDS: Record<Locale, readonly string[]> = {
  tr: ["iyi", "güçlü", "başarılı", "mükemmel", "harika", "yetersiz", "zayıf", "kötü", "etkili", "iletişimci", "özgüvenli", "yetenekli", "çalışkan"],
  en: ["good", "strong", "excellent", "great", "poor", "weak", "bad", "effective", "communicator", "confident", "talented", "hardworking"],
};

export function anchorHint(text: string, locale: Locale): AnchorHint | null {
  const words = text.toLocaleLowerCase(locale === "tr" ? "tr" : "en").match(/[\p{L}']+/gu) ?? [];
  if (words.length === 0) return null;
  const traits = words.filter((w) => TRAIT_WORDS[locale].includes(w)).length;
  if (traits > 0 && traits / words.length >= 0.2) return "ADJECTIVE";
  if (words.length < 4) return "TOO_SHORT";
  return null;
}
