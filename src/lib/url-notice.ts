/**
 * Notices that arrive in the URL after a redirect ("?publish=refused",
 * "?published=2", "?closed=1"): read once on the server, shown, then taken out
 * of the address by <UrlNotice> so a reload does not show them again.
 */

export type SearchParams = Record<string, string | string[] | undefined>;

/** One string value of a search parameter; a repeated or missing one is nothing. */
export const one = (value: string | string[] | undefined): string | undefined => (typeof value === "string" ? value : undefined);

/** The notice a known value of `param` stands for; anything else (an inherited key too) is null. */
export function noticeOf<K extends string, V>(sp: SearchParams, param: string, table: Record<K, V>): V | null {
  const value = one(sp[param]);
  return value !== undefined && Object.hasOwn(table, value) ? table[value as K] : null;
}

/** `href` (path, search and hash) without the given parameters; null when it has none of them. */
export function withoutParams(href: string, names: readonly string[]): string | null {
  const url = new URL(href, "http://local");
  if (!names.some((name) => url.searchParams.has(name))) return null;
  for (const name of names) url.searchParams.delete(name);
  return `${url.pathname}${url.search}${url.hash}`;
}
