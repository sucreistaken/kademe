import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import tr from "@/i18n/messages/candidate.tr.json";
import en from "@/i18n/messages/candidate.en.json";

/**
 * Candidate-side dictionaries.
 *
 * One file per surface per locale, rather than one big file split by a
 * top-level `candidate` / `manager` key. Two reasons: the provider then ships
 * only the strings the page actually renders, and the key you read in the code
 * (`t("intro.start")`) is the key you find in the file, with no prefix to
 * remember. The manager side mirrors this with `manager.tr.json`.
 *
 * `candidate.tr.json` is the source of truth for the key set; the English file
 * follows it. `CandidateMessages` is derived from the Turkish one so a key that
 * exists in only one of them is a type error.
 */
export type CandidateMessages = typeof tr;

export const candidateMessages: Record<Locale, CandidateMessages> = {
  tr,
  en: en satisfies CandidateMessages,
};

export function messagesFor(locale: Locale): CandidateMessages {
  return candidateMessages[locale] ?? candidateMessages[DEFAULT_LOCALE];
}

/**
 * A translator for server components and route handlers. Client components use
 * `useTranslations()` under the provider instead.
 */
export function candidateT(locale: Locale) {
  return createTranslator({ locale, messages: messagesFor(locale) });
}
