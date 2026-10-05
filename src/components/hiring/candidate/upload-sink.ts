"use client";

import { apiBeacon } from "@/lib/client/api";
import { ChunkedUploader, PATIENT_RETRY } from "@/lib/client/recorder";
import type { OpenTake, RecordingResult, RecordingSink } from "./recording-sink";
import { isRetryable } from "./save-queue";

/** Pauses between tries of a completion the connection dropped: 1, 2, 4, 8, 15, 15 s (about 45 s in all). */
const FINISH_DELAYS_MS = [1000, 2000, 4000, 8000, 15_000, 15_000];
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A completion (core /media/complete) tried again while the connection is to
 * blame; completing twice changes nothing on the server. A refusal is passed
 * on at once. Shared by a take and a file answer (Task 15).
 */
export async function finishPatiently<T>(finish: () => Promise<T>, pause: (ms: number) => Promise<void> = wait): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await finish();
    } catch (err) {
      if (!isRetryable(err) || attempt >= FINISH_DELAYS_MS.length) throw err;
      await pause(FINISH_DELAYS_MS[attempt]);
    }
  }
}

/**
 * An answer's take: opened on the server (which counts takes), uploaded in
 * parts while the candidate talks (core recorder, iOS-safe, patient with a
 * connection that drops: PATIENT_RETRY), completed by the core
 * /media/complete, which attaches the newest take to the answer. A completion
 * lost on the way is tried again (completing twice changes nothing on the
 * server); a refusal (NO_PARTS: the take was given back) is passed on at once.
 */
export function uploadSink(token: string, stagePosition: number, activityId: string): RecordingSink {
  return {
    async open(mime, onProgress): Promise<OpenTake> {
      const uploader = await ChunkedUploader.open(
        token,
        "/hiring/media/init",
        { stagePosition, activityId, kind: "recording" },
        mime,
        (s) => {
          const total = s.uploadedBytes + s.queuedBytes;
          onProgress?.({ ratio: total > 0 ? s.uploadedBytes / total : 0, stalled: s.stalled });
        },
        PATIENT_RETRY,
      );
      return {
        push: (chunk) => uploader.push(chunk),
        async finish(durationMs): Promise<RecordingResult> {
          const done = await finishPatiently(() => uploader.finish(durationMs));
          return { status: done.status === "INCOMPLETE" ? "INCOMPLETE" : "READY", ref: uploader.uploadRef };
        },
        abandon(durationMs, cut = true) {
          // Fix round 1 (Minor 3): a take whose recording had ended and whose parts all landed is whole.
          const incomplete = cut || uploader.interrupted || uploader.pendingBytes > 0;
          apiBeacon(token, "/media/complete", { uploadRef: uploader.uploadRef, durationMs, incomplete });
        },
      };
    },
  };
}
