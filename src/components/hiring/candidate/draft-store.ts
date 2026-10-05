/**
 * The tab's own copy of a typed answer (ruling 3). A reload's page request
 * can read the database before the last autosave (or the pagehide beacon,
 * which a reload sends only after the new request) has landed; the copy in
 * sessionStorage is this tab's latest typing, so the field restores it and
 * saves it again. sessionStorage lives with the tab only: closing the tab
 * clears it, and the server's copy is what a new tab starts from.
 *
 * The copy carries its `base`: the server text the tab last knew (the text it
 * opened with, then each text the server accepted). It is restored only over
 * that same text; when the server holds something else (written on another
 * device), the server wins and the copy is dropped (Task 13 review).
 */

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type Draft = { text: string; base: string };

/**
 * By link, stage, the stage's run (its start time: a later run of the same
 * stage never sees an older copy) and question; another candidate's link
 * opened in the same tab never sees it either.
 */
export const draftKey = (token: string, position: number, run: string, activityId: string) => `kademe-hiring-draft:${token}:${position}:${run}:${activityId}`;

/** The tab's sessionStorage, or null where the browser refuses it. */
export function sessionDrafts(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readDraft(storage: DraftStorage | null, key: string): Draft | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const { text, base } = value as { text?: unknown; base?: unknown };
    return typeof text === "string" && typeof base === "string" ? { text, base } : null;
  } catch {
    return null;
  }
}

export function writeDraft(storage: DraftStorage | null, key: string, draft: Draft): void {
  try {
    storage?.setItem(key, JSON.stringify(draft));
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

/**
 * The text a field opens with. The copy wins only over the text it was typed
 * on; `drop` says the copy is stale (the server holds newer text from elsewhere).
 */
export function restoreText(server: string, draft: Draft | null): { text: string; restored: boolean; drop: boolean } {
  if (!draft || draft.text === server) return { text: server, restored: false, drop: false };
  if (draft.base === server) return { text: draft.text, restored: true, drop: false };
  return { text: server, restored: false, drop: true };
}

const lostKey = (token: string, position: number) => `kademe-hiring-lost:${token}:${position}`;

/** Minor 6: the server refused a save after the deadline, so the last words typed were not kept. */
export function markLostWords(storage: DraftStorage | null, token: string, position: number): void {
  try {
    storage?.setItem(lostKey(token, position), "1");
  } catch {
    // Without storage the next intro cannot know; it still says only "up to that moment".
  }
}

export function lostWords(storage: DraftStorage | null, token: string, position: number): boolean {
  try {
    return storage?.getItem(lostKey(token, position)) === "1";
  } catch {
    return false;
  }
}
