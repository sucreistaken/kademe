/**
 * The language link of the hiring frame. `?lang=` is applied on the server and
 * taken out of the address; the hash of a page step (#consent) is kept, so a
 * switch on Consent stays on Consent (Task 5 review fix 2). Only a simple name
 * is carried.
 */
export function langHref(locale: string, hash: string): string {
  return `?lang=${locale}${/^#[\w-]+$/.test(hash) ? hash : ""}`;
}
