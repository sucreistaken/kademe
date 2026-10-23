import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, type PanelLocale } from "@/i18n/locale";
import baseTr from "@/i18n/messages/manager.tr.json";
import baseEn from "@/i18n/messages/manager.en.json";
import baseDe from "@/i18n/messages/manager.de.json";
import settingsTr from "@/i18n/messages/settings.tr.json";
import settingsEn from "@/i18n/messages/settings.en.json";
import settingsDe from "@/i18n/messages/settings.de.json";
import screensTr from "@/i18n/messages/screens.tr.json";
import screensEn from "@/i18n/messages/screens.en.json";
import screensDe from "@/i18n/messages/screens.de.json";
import libraryTr from "@/i18n/messages/library.tr.json";
import libraryEn from "@/i18n/messages/library.en.json";
import libraryDe from "@/i18n/messages/library.de.json";
import hiringTr from "@/i18n/messages/hiring.tr.json";
import hiringEn from "@/i18n/messages/hiring.en.json";
import hiringDe from "@/i18n/messages/hiring.de.json";
import advancedTr from "@/i18n/messages/advanced.tr.json";
import advancedEn from "@/i18n/messages/advanced.en.json";
import advancedDe from "@/i18n/messages/advanced.de.json";

/**
 * Manager-side dictionaries, mirroring `@/i18n/candidate`: the panel never ships
 * the candidate strings, and the key read in the code is the key found in the
 * file, with no prefix to remember.
 *
 * Several source files per locale rather than one, merged here at the top level:
 *
 *   manager.*.json    the shell. Navigation, and the words every screen shares.
 *   settings.*.json   the settings and audit screens.
 *   screens.*.json    dashboard, positions, candidates, compare, library, review.
 *   library.*.json    organisation library (positions, competencies, scales).
 *   hiring.*.json     hiring screens.
 *   advanced.*.json   the Advanced page and its creators.
 *
 * The split is not cosmetic. Several people edit this panel at once, and a
 * single dictionary file means one of them silently overwrites the other's
 * strings. Disjoint files make that a merge instead of a loss. Namespaces stay
 * unique across the files, so a caller still writes `t("settings.title")`
 * without knowing which file it came from.
 *
 * The Turkish files are the source of truth for the key set; the English ones
 * follow key for key. `ManagerMessages` is derived from Turkish, so a key that
 * exists in only one of the pair is a type error rather than a missing string
 * discovered by a user.
 */
export type ManagerMessages = typeof baseTr &
  typeof settingsTr &
  typeof screensTr &
  typeof libraryTr &
  typeof hiringTr &
  typeof advancedTr;

const tr: ManagerMessages = { ...baseTr, ...settingsTr, ...screensTr, ...libraryTr, ...hiringTr, ...advancedTr };
const en: ManagerMessages = {
  ...baseEn,
  ...settingsEn,
  ...screensEn,
  ...libraryEn,
  ...hiringEn,
  ...advancedEn,
} satisfies ManagerMessages;

// German is a copy of English until the translation pass: same keys, same types.
const de: ManagerMessages = {
  ...baseDe,
  ...settingsDe,
  ...screensDe,
  ...libraryDe,
  ...hiringDe,
  ...advancedDe,
} satisfies ManagerMessages;

export const managerMessages: Record<PanelLocale, ManagerMessages> = { tr, en, de };

export function managerMessagesFor(locale: PanelLocale): ManagerMessages {
  return managerMessages[locale] ?? managerMessages[DEFAULT_LOCALE];
}

/**
 * A translator for server components and server actions. Client components use
 * `useMT()` under the provider instead.
 */
export function managerT(locale: PanelLocale) {
  return createTranslator({ locale, messages: managerMessagesFor(locale) });
}
