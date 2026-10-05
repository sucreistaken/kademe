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

/**
 * Opens the step as a new history entry, so the browser's back button returns
 * to the step before it on the same page. history.pushState (patched by Next)
 * keeps the router's state in the entry and leaves the page mounted; it fires
 * no event of its own, so the subscribers are told with a hashchange.
 */
export function pushHash(hash: string) {
  window.history.pushState(null, "", hash);
  window.dispatchEvent(new Event("hashchange"));
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
