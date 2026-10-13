import type { ItemAnswer } from "@/lib/exam/types";

/**
 * The one answer the server has not confirmed yet, kept in this tab's
 * sessionStorage as well as in memory. A dropped connection, or a reload
 * while it is down, then sends it again instead of losing it. Every save
 * carries the whole answer of one item, so one slot per invitation is enough.
 *
 * Storage can be missing or throw (private mode, blocked site data); every
 * access is guarded and the exam works without it, only without the reload
 * safety net.
 */
export type PendingAnswer = { sectionPosition: number; sequence: number; answer: ItemAnswer };

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const keyOf = (token: string) => `kademe.exam.pending.${token}`;

export function sessionStore(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function isPending(v: unknown): v is PendingAnswer {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.sectionPosition === "number" &&
    typeof p.sequence === "number" &&
    !!p.answer &&
    typeof p.answer === "object" &&
    !Array.isArray(p.answer)
  );
}

export function readPending(storage: StorageLike | null, token: string): PendingAnswer | null {
  try {
    const raw = storage?.getItem(keyOf(token));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPending(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writePending(storage: StorageLike | null, token: string, pending: PendingAnswer): void {
  try {
    storage?.setItem(keyOf(token), JSON.stringify(pending));
  } catch {
    /* no storage: memory still holds it */
  }
}

/** Clears the slot once `saved` reached the server, unless a newer answer (another item) took it meanwhile. */
export function clearPending(storage: StorageLike | null, token: string, saved: Pick<PendingAnswer, "sectionPosition" | "sequence">): void {
  try {
    const current = readPending(storage, token);
    if (!current || (current.sectionPosition === saved.sectionPosition && current.sequence === saved.sequence)) {
      storage?.removeItem(keyOf(token));
    }
  } catch {
    /* nothing to clear */
  }
}
