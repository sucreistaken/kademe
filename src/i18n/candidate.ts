import { createTranslator } from "next-intl";
import { DEFAULT_CANDIDATE_LOCALE, type CandidateLocale } from "@/i18n/locale";
import tr from "@/i18n/messages/candidate.tr.json";
import en from "@/i18n/messages/candidate.en.json";
import de from "@/i18n/messages/candidate.de.json";
import es from "@/i18n/messages/candidate.es.json";
import ar from "@/i18n/messages/candidate.ar.json";

/**
 * Candidate-side dictionaries.
 *
 * One file per surface per locale, rather than one big file split by a
 * top-level `candidate` / `manager` key. Two reasons: the provider then ships
 * only the strings the page actually renders, and the key you read in the code
 * (`t("intro.start")`) is the key you find in the file, with no prefix to
 * remember. The manager side mirrors this with `manager.tr.json`.
 *
 * `candidate.tr.json` is the source of truth for the key set; the English, German,
 * Spanish and Arabic files follow it. `CandidateMessages` is derived from the Turkish one so a key that
 * exists in only one of them is a type error.
 */
export type CandidateMessages = typeof tr;

export const candidateMessages: Record<CandidateLocale, CandidateMessages> = {
  tr,
  en: en satisfies CandidateMessages,
  de: de satisfies CandidateMessages,
  es: es satisfies CandidateMessages,
  ar: ar satisfies CandidateMessages,
};

export function messagesFor(locale: CandidateLocale): CandidateMessages {
  return candidateMessages[locale] ?? candidateMessages[DEFAULT_CANDIDATE_LOCALE];
}

/**
 * A translator for server components and route handlers. Client components use
 * `useTranslations()` under the provider instead.
 */
export function candidateT(locale: CandidateLocale) {
  return createTranslator({ locale, messages: messagesFor(locale) });
}
