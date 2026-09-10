import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  localeFromAcceptLanguage,
  type Locale,
} from "@/i18n/locale";

/**
 * Where the manager panel's language comes from.
 *
 * Not the same source as the candidate side, and it must not pretend to be. A
 * candidate's locale is a property of the assessment they were invited to; the
 * panel is a logged-in surface used by the same people every day, so the choice
 * belongs to the person, not to the request.
 *
 * A cookie rather than a column on `users`: the preference is per browser, it
 * survives a logout, and setting it needs no migration and no write to a table
 * three sessions are editing at once.
 */
export const MANAGER_LOCALE_COOKIE = "kademe-lang";

/** One year. The panel language is not something anyone wants to re-pick. */
export const MANAGER_LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

export async function managerLocale(): Promise<Locale> {
  const jar = await cookies();
  const chosen = jar.get(MANAGER_LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  // Nobody has chosen yet: the browser's preference beats a hard default, but
  // only on the first render, because the switch writes the cookie.
  const header = (await headers()).get("accept-language");
  return header ? localeFromAcceptLanguage(header) : DEFAULT_LOCALE;
}
