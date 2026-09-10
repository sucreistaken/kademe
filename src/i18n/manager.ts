import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import baseTr from "@/i18n/messages/manager.tr.json";
import baseEn from "@/i18n/messages/manager.en.json";
import settingsTr from "@/i18n/messages/settings.tr.json";
import settingsEn from "@/i18n/messages/settings.en.json";
import screensTr from "@/i18n/messages/screens.tr.json";
import screensEn from "@/i18n/messages/screens.en.json";

/**
 * Manager-side dictionaries, mirroring `@/i18n/candidate`: the panel never ships
 * the candidate strings, and the key read in the code is the key found in the
 * file, with no prefix to remember.
 *
 * Three source files per locale rather than one, merged here at the top level:
 *
 *   manager.*.json    the shell. Navigation, and the words every screen shares.
 *   settings.*.json   the settings and audit screens.
 *   screens.*.json    dashboard, positions, candidates, compare, library, review.
 *
 * The split is not cosmetic. Several people edit this panel at once, and a
 * single dictionary file means one of them silently overwrites the other's
 * strings. Disjoint files make that a merge instead of a loss. Namespaces stay
 * unique across the three, so a caller still writes `t("settings.title")`
 * without knowing which file it came from.
 *
 * The Turkish files are the source of truth for the key set; the English ones
 * follow key for key. `ManagerMessages` is derived from Turkish, so a key that
 * exists in only one of the pair is a type error rather than a missing string
 * discovered by a user.
 */
export type ManagerMessages = typeof baseTr &
  typeof settingsTr &
  typeof screensTr;

const tr: ManagerMessages = { ...baseTr, ...settingsTr, ...screensTr };
const en: ManagerMessages = {
  ...baseEn,
  ...settingsEn,
  ...screensEn,
} satisfies ManagerMessages;

export const managerMessages: Record<Locale, ManagerMessages> = { tr, en };

export function managerMessagesFor(locale: Locale): ManagerMessages {
  return managerMessages[locale] ?? managerMessages[DEFAULT_LOCALE];
}

/**
 * A translator for server components and server actions. Client components use
 * `useMT()` under the provider instead.
 */
export function managerT(locale: Locale) {
  return createTranslator({ locale, messages: managerMessagesFor(locale) });
}
