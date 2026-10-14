/**
 * What the candidate is told about the continuous recording, decided without
 * a browser so it is tested on its own: the exam header's line while it runs,
 * and the last screen's line while its final segments upload.
 */

/** What is being recorded right now (src/lib/client/proctor/recording.ts). */
export type RecordingActivity = { camera: boolean; audio: boolean; screen: boolean };

export type RecordingLabel = "cameraAudioScreen" | "cameraScreen" | "cameraAudio" | "camera" | "screen";

/**
 * The header line names everything that is recorded, the sound included:
 * under STANDARD the camera and the microphone are recorded the whole time,
 * so "camera on" would say less than what happens. Null when nothing records.
 */
export function recordingLabel(activity: RecordingActivity | null): RecordingLabel | null {
  if (!activity) return null;
  const { camera, audio, screen } = activity;
  if (camera && screen) return audio ? "cameraAudioScreen" : "cameraScreen";
  if (camera) return audio ? "cameraAudio" : "camera";
  if (screen) return "screen";
  return null;
}

/** How long the last screen waits for the final segments before it says the upload is slow. */
export const FINISH_DRAIN_MS = 60_000;

/**
 * The last screen's upload line.
 *   none     this tab recorded nothing; nothing to say
 *   sending  the last segments are being cut or uploaded: keep the tab open
 *   slow     the bounded wait ran out with segments still waiting; the upload goes on
 *   done     everything recorded has left the browser
 */
export type FinishUpload = "none" | "sending" | "slow" | "done";

export function finishUploadPhase(input: {
  /** This tab recorded (the engine's upload line exists). */
  recorded: boolean;
  /** The engine has stopped: the last segments are cut and queued. */
  stopped: boolean;
  /** Segments still waiting, the one in flight included. */
  pending: number;
  /** The bounded wait (FINISH_DRAIN_MS) gave up. */
  timedOut: boolean;
}): FinishUpload {
  if (!input.recorded) return "none";
  if (!input.stopped) return "sending";
  if (input.pending <= 0) return "done";
  return input.timedOut ? "slow" : "sending";
}
