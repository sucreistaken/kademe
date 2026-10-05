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
 * device), the server wins and the copy is dropped (Task 13 review). A text
 * whose save was on its way when the tab reloaded counts as known too: the
 * server may hold it by the time the page reads it (fix round 2).
 */

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/**
 * `pending`: a text whose save left but had no answer yet (fix round 2): the server may hold it already.
 * `older`: up to two earlier such texts (Task 13 residual): an older save can land after a newer one.
 */
export type Draft = { text: string; base: string; pending?: string; older?: string[] };

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
    const { text, base, pending, older } = value as { text?: unknown; base?: unknown; pending?: unknown; older?: unknown };
    if (typeof text !== "string" || typeof base !== "string") return null;
    const draft: Draft = { text, base };
    if (typeof pending === "string") draft.pending = pending;
    if (Array.isArray(older) && older.every((o) => typeof o === "string") && older.length) draft.older = older.slice(0, 2);
    return draft;
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
  if (draft.base === server || draft.pending === server || draft.older?.includes(server)) return { text: draft.text, restored: true, drop: false };
  return { text: server, restored: false, drop: true };
}

/** A save of `sent` left for the server; the text sent before it is kept (two at most). */
export function draftAfterSend(draft: Draft, sent: string): Draft {
  const older = [draft.pending, ...(draft.older ?? [])].filter((o): o is string => typeof o === "string" && o !== sent).slice(0, 2);
  return older.length ? { ...draft, pending: sent, older } : { ...draft, pending: sent };
}

/** The server accepted `saved`: it is the new base; the copy is gone when nothing is left unsaved. */
export function draftAfterSaved(draft: Draft, saved: string): Draft | null {
  const pending = draft.pending === saved ? undefined : draft.pending;
  const older = draft.older?.filter((o) => o !== saved);
  if (pending === undefined && draft.text === saved) return null;
  const next: Draft = { text: draft.text, base: saved };
  if (pending !== undefined) next.pending = pending;
  if (older?.length) next.older = older;
  return next;
}

const lostKey = (token: string, position: number) => `kademe-hiring-lost:${token}:${position}`;

export type LostKind = "text" | "choice";

/** Minor 6: the server refused a save after the deadline, so the last change (typed words or a choice) was not kept. */
export function markLostWords(storage: DraftStorage | null, token: string, position: number, kind: LostKind): void {
  try {
    storage?.setItem(lostKey(token, position), kind);
  } catch {
    // Without storage the next intro cannot know; it still says only "up to that moment".
  }
}

export function lostWords(storage: DraftStorage | null, token: string, position: number): LostKind | null {
  try {
    const value = storage?.getItem(lostKey(token, position));
    return value === "text" || value === "choice" ? value : null;
  } catch {
    return null;
  }
}

/** The flag was shown (the finish page, Task 16): it is not said twice. */
export function clearLostWords(storage: DraftStorage | null, token: string, position: number): void {
  try {
    storage?.removeItem(lostKey(token, position));
  } catch {
    // Nothing to clear.
  }
}
