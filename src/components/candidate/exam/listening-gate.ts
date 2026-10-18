import type { StorageLike } from "@/components/candidate/exam/pending-answer";

/**
 * The "read the questions first" gate in front of a listening recording.
 *
 * The student sees the questions at once but the player only after they say
 * they have read them. Once opened for a recording it stays open, in this tab
 * (sessionStorage) and, through the server's play count, on any other. Storage
 * can be missing or throw, so every access is guarded: without it the gate may
 * show again after a reload, which costs one click and nothing else.
 */

/** One flag per invitation, exam section and recording (the recording's first question). */
export const gateKey = (token: string, sectionPosition: number, firstSequence: number): string =>
  `kademe.exam.listenGate.${token}.${sectionPosition}.${firstSequence}`;

/** Open once the student revealed the player, or the recording has been played at least once. */
export function isGateOpen(state: { revealed: boolean; playsLeft: number; maxPlays: number }): boolean {
  return state.revealed || (state.maxPlays > 0 && state.playsLeft < state.maxPlays);
}

export function readRevealed(storage: StorageLike | null, key: string): boolean {
  try {
    return storage?.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function markRevealed(storage: StorageLike | null, key: string): void {
  try {
    storage?.setItem(key, "1");
  } catch {
    /* no storage: the screen still remembers it until a reload */
  }
}

/**
 * The player's play button: truly disabled ("off") only when no play is left.
 * While a clip loads or plays it is "busy": still focusable (aria-disabled, a
 * click does nothing), so the focus moved onto it from the gate's button, which
 * goes away on the click, is not dropped to the page.
 */
export function playButtonMode(s: { state: "IDLE" | "LOADING" | "PLAYING" | "FAILED"; freeRetry: boolean; playsLeft: number }): "ready" | "busy" | "off" {
  if (s.state === "LOADING" || s.state === "PLAYING") return "busy";
  return !s.freeRetry && s.playsLeft <= 0 ? "off" : "ready";
}
