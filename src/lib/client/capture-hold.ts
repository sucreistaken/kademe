import { useEffect } from "react";

/**
 * Whether a recording or an upload is in progress on this page (Task 5 fix
 * round 2). The frame's language link is a full page load, and leaving the
 * page cuts a take (pagehide abandons it, and the take still counts) or an
 * upload; while anything holds this store the link stays where it is and says
 * why. Module state like streams.ts: one tab, one set of holders.
 *
 * Each holder has a kind (Task 11 fix round 1, Minor 1), so the link can name
 * what holds the page; the kind is never read from the id.
 */
export type CaptureKind = "recording" | "upload";

const holders = new Map<string, CaptureKind>();
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

/** `kind` defaults to a recording (every holder before the file question was one). */
export function holdCapture(id: string, kind: CaptureKind = "recording") {
  if (holders.has(id)) return;
  holders.set(id, kind);
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

/**
 * Task 5 carry: whether only file uploads hold the page, so the language link
 * can say "Yükleme bitince" and not "Kayıt bitince". A take holding it as
 * well keeps the recording wording.
 */
export const captureUploadOnly = () => holders.size > 0 && [...holders.values()].every((kind) => kind === "upload");
export const captureUploadOnlyOnServer = () => false;
/** The server never holds anything: the link renders live, the browser settles it. */
export const captureHeldOnServer = () => false;

/** An effect's body: hold while `held`, release on the cleanup (the work settled, or the screen went away). */
export function holdWhile(id: string, held: boolean, kind: CaptureKind = "recording"): () => void {
  if (!held) return () => undefined;
  holdCapture(id, kind);
  return () => releaseCapture(id);
}

/**
 * Holds the page under `id` from now until `outcome` settles (resolved or
 * rejected), however the screen that asked has gone meanwhile: a take whose
 * question was left finishes in the background just like a file upload.
 */
export function holdUntilSettled(id: string, outcome: Promise<unknown>, kind: CaptureKind = "recording") {
  holdCapture(id, kind);
  const release = () => releaseCapture(id);
  outcome.then(release, release);
}

/** Holds the page under `id` while `held` is true; released when it turns false and on unmount. */
export function useCaptureHold(id: string, held: boolean, kind: CaptureKind = "recording") {
  useEffect(() => holdWhile(id, held, kind), [id, held, kind]);
}
