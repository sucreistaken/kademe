"use client";

import { useEffect, useState } from "react";
import { apiBeacon, apiSend } from "@/lib/client/api";
import type { FlushRegistry } from "@/lib/client/flush-registry";
import { SaveQueue, type SaveState } from "./save-queue";

export type { SaveStatus } from "./save-queue";

/**
 * HIRING-UX 6.7 "Kaydedildi · 4 sn önce": the autosave of one question
 * (save-queue.ts holds the rules). The runner flushes every pending save
 * before it closes a question or a stage (FlushRegistry); a hidden or closing
 * page sends the pending draft with a beacon; a refusal reaches the runner.
 */
export function useAutosave(
  input: {
    token: string;
    position: number;
    activityId: string;
    flushes: FlushRegistry;
    onRefused?: (err: unknown) => void;
    /** Each answer the server accepted (the text field keeps its draft's base with it). */
    onSaved?: (answer: unknown) => void;
  },
  delayMs = 800,
) {
  const { token, position, activityId, flushes, onRefused, onSaved } = input;
  const [state, setState] = useState<SaveState>({ status: "idle", savedAt: null });
  const [queue] = useState(
    () =>
      new SaveQueue(
        {
          send: (answer) => apiSend(token, "/hiring/response", { stagePosition: position, activityId, answer }, "PUT"),
          beacon: (answer) => void apiBeacon(token, "/hiring/response", { stagePosition: position, activityId, answer }),
          now: () => Date.now(),
          setTimer: (fn, ms) => window.setTimeout(fn, ms),
          clearTimer: (id) => window.clearTimeout(id),
          onState: setState,
          onRefused: () => undefined,
        },
        delayMs,
      ),
  );

  // The runner's handler changes with its state; the queue always calls the latest one.
  useEffect(() => queue.listen(onRefused), [queue, onRefused]);
  useEffect(() => queue.listenSaved(onSaved), [queue, onSaved]);

  // The runner's flush before a question or the stage closes; leaving sends the last draft.
  useEffect(() => {
    queue.open();
    const unregister = flushes.register(activityId, queue.flush);
    return () => {
      void queue.close();
      unregister();
    };
  }, [flushes, activityId, queue]);

  // A tab switch on a phone can be the page's last moment; pagehide is the closing tab's.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") queue.hide();
    };
    window.addEventListener("pagehide", queue.hide);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", queue.hide);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [queue]);

  return { save: queue.save, flush: queue.flush, status: state.status, savedAt: state.savedAt };
}
