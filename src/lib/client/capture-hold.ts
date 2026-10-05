import { useEffect } from "react";

/**
 * Whether a recording or an upload is in progress on this page (Task 5 fix
 * round 2). The frame's language link is a full page load, and leaving the
 * page cuts a take (pagehide abandons it, and the take still counts) or an
 * upload; while anything holds this store the link stays where it is and says
 * why. Module state like streams.ts: one tab, one set of holders.
 */
const holders = new Set<string>();
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

export function holdCapture(id: string) {
  if (holders.has(id)) return;
  holders.add(id);
  emit();
}

export function releaseCapture(id: string) {
  if (holders.delete(id)) emit();
}

export function subscribeCapture(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const captureHeld = () => holders.size > 0;
/** The server never holds anything: the link renders live, the browser settles it. */
export const captureHeldOnServer = () => false;

/** An effect's body: hold while `held`, release on the cleanup (the work settled, or the screen went away). */
export function holdWhile(id: string, held: boolean): () => void {
  if (!held) return () => undefined;
  holdCapture(id);
  return () => releaseCapture(id);
}

/** Holds the page under `id` while `held` is true; released when it turns false and on unmount. */
export function useCaptureHold(id: string, held: boolean) {
  useEffect(() => holdWhile(id, held), [id, held]);
}
