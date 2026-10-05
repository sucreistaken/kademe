/**
 * A step of one page kept in the address's hash (the hiring landing's Welcome
 * and Consent, the panel's new-opening steps): read it with
 * useSyncExternalStore(subscribeHash, ...), move forward with pushHash.
 */
export const subscribeHash = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  window.addEventListener("popstate", notify);
  return () => {
    window.removeEventListener("hashchange", notify);
    window.removeEventListener("popstate", notify);
  };
};

/** The mark on a history entry pushHash made; the browser keeps it across a reload. */
const MARK = "hashStep";

export const isHashStepEntry = (state: unknown): boolean => typeof state === "object" && state !== null && (state as Record<string, unknown>)[MARK] === true;

/**
 * Opens the step as a new history entry, so the browser's back button returns
 * to the step before it on the same page. The entry is marked; history.pushState
 * (patched by Next) adds the router's state next to the mark and leaves the page
 * mounted. It fires no event of its own, so the subscribers are told with a
 * hashchange.
 */
export function pushHash(hash: string) {
  window.history.pushState({ [MARK]: true }, "", hash);
  window.dispatchEvent(new Event("hashchange"));
}

/**
 * The step's own "Geri": the browser's back when this entry was pushed from the
 * step before (also after a reload), so the history stays one step deep;
 * clearHash only on a page opened directly on the step.
 */
export function leaveHashStep() {
  if (isHashStepEntry(window.history.state)) window.history.back();
  else clearHash();
}

/**
 * Leaves the hash step in place of going back, for a step the page was opened
 * on (a reload on it, a copied link): there is no earlier step in this page's
 * history, and history.back() would leave the page. The address keeps its path
 * and query (?lang= included).
 */
export function clearHash() {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  window.dispatchEvent(new Event("hashchange"));
}
