/**
 * The tab's own copy of a typed answer (ruling 3). A reload's page request
 * can read the database before the last autosave (or the pagehide beacon,
 * which a reload sends only after the new request) has landed; the copy in
 * sessionStorage is this tab's latest typing, so the field restores it and
 * saves it again. sessionStorage lives with the tab only: closing the tab
 * clears it, and the server's copy is what a new tab starts from.
 */

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** By link, stage and question: another candidate's link opened in the same tab never sees it. */
export const draftKey = (token: string, position: number, activityId: string) => `kademe-hiring-draft:${token}:${position}:${activityId}`;

/** The tab's sessionStorage, or null where the browser refuses it. */
export function sessionDrafts(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readDraft(storage: DraftStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeDraft(storage: DraftStorage | null, key: string, text: string): void {
  try {
    storage?.setItem(key, text);
  } catch {
    // A full or blocked storage leaves the autosave as the only copy.
  }
}

export function clearDraft(storage: DraftStorage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

/** The tab's copy wins when it differs: it is never older than what this tab sent. */
export function restoreText(server: string, draft: string | null): { text: string; restored: boolean } {
  return draft !== null && draft !== server ? { text: draft, restored: true } : { text: server, restored: false };
}
