import { createTranslator } from "next-intl";
import type { AuthLocale } from "@/i18n/locale";
import tr from "@/i18n/messages/auth.tr.json";
import en from "@/i18n/messages/auth.en.json";
import de from "@/i18n/messages/auth.de.json";

/**
 * The public front door: sign in and password setup. Its own small dictionary
 * because it is read before anyone is signed in, and a
 * German visitor must not meet a single Turkish word on the way in.
 *
 * English is the source of truth for the key set here, since it is the default.
 */
export type AuthMessages = typeof en;

export const authMessages: Record<AuthLocale, AuthMessages> = {
  en,
  de: de satisfies AuthMessages,
  tr: tr satisfies AuthMessages,
};

export function authT(locale: AuthLocale) {
  return createTranslator({ locale, messages: authMessages[locale] });
}
