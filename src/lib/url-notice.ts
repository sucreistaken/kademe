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

export type NoticeWindow = {
  location: { pathname: string; search: string; hash: string };
  history: { state: unknown; replaceState(state: unknown, unused: string, url?: string | URL | null): void };
  setTimeout(fn: () => void, ms?: number): number;
  clearTimeout(id: number): void;
};

/**
 * Takes the notice parameters out of the address one tick later. On a full
 * page load (a native form POST before hydration, an opened URL) Next writes
 * its own history entry after the first effects; a replaceState before that is
 * overwritten and a later router.refresh brings the parameter back (plan 1
 * review).
 *
 * The state passed is null, never Next's own: the app router patches
 * history.replaceState (next/dist/client/components/app-router.js) and treats
 * a state carrying `__NA` as its own write, so it would not learn the new
 * address and the next server action or refresh (the language switch, "Tamam")
 * would put the parameter back (seen in the Task 18 browser check). Given
 * null, the patch copies Next's internal state into the entry itself and
 * moves the router to the clean address without asking the server. Returns
 * the cancel for unmount.
 */
export function scheduleNoticeCleanup(win: NoticeWindow, names: readonly string[]): () => void {
  const id = win.setTimeout(() => {
    const next = withoutParams(`${win.location.pathname}${win.location.search}${win.location.hash}`, names);
    if (next !== null) win.history.replaceState(null, "", next);
  }, 0);
  return () => win.clearTimeout(id);
}
