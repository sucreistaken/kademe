import { clearLostWords, lostWords, type DraftStorage, type LostKind } from "./draft-store";

/**
 * The finish page's decisions (HIRING-UX 6.13), kept apart from the screen so
 * they are tested.
 */

/**
 * Which "switched off" line the finish says. Only an assessment with video or
 * sound questions ever opened a device in this tab; for a written one the line
 * would be noise. The page stops every stream it can reach before it says it
 * (Task 12 carry: not on the count stopped, since the device check and each
 * take already stop their own).
 */
export function devicesLine(devices: { camera: boolean; microphone: boolean }): "cameraAndMicrophone" | "microphone" | null {
  if (devices.camera) return "cameraAndMicrophone";
  return devices.microphone ? "microphone" : null;
}

/**
 * Task 13 carry: a save the server refused after the last stage's deadline
 * carried words (or a choice) that are not kept, and the finish says so. An
 * earlier stage's flag was said by the next stage's intro. Every flag of this
 * link is cleared once read, so the note is said once.
 */
export function takeLastLostWords(storage: DraftStorage | null, token: string, positions: number[]): LostKind | null {
  const last = positions.length ? Math.max(...positions) : null;
  const kind = last === null ? null : lostWords(storage, token, last);
  for (const position of positions) clearLostWords(storage, token, position);
  return kind;
}

/** A send that failed: the server holding an answer already means it was sent (another tab, a lost reply). */
export function surveyAfterFailure(err: unknown): "sent" | "failed" {
  return err && typeof err === "object" && (err as { code?: unknown }).code === "ALREADY_ANSWERED" ? "sent" : "failed";
}
