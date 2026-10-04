"use client";

import { useEffect, useState } from "react";
import { saveActivityAction, saveStageAction, setCompetenciesAction } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/actions";
import type { ActivityPatch, StagePatch } from "@/solutions/hiring/rules/patches";
import { createSaveQueue, type SaveEntry, type SaverState, type SaveStorage } from "./save-queue";

export type { SaverState } from "./save-queue";

/**
 * Unsaved values live in this tab's sessionStorage until the server has them,
 * so a reload replays them (carry 7). Storage can be missing or full (private
 * mode, quota): then the queue simply runs without it.
 */
function sessionStore(openingId: string): SaveStorage {
  const key = `kademe.builder.unsaved.${openingId}`;
  return {
    load() {
      try {
        const raw = window.sessionStorage.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? (parsed as SaveEntry[]) : [];
      } catch {
        return [];
      }
    },
    save(entries) {
      try {
        if (entries.length) window.sessionStorage.setItem(key, JSON.stringify(entries));
        else window.sessionStorage.removeItem(key);
      } catch {
        // Storage unavailable: the in-memory queue still saves.
      }
    },
  };
}

/**
 * The builder's save line (HIRING-UX 5.5): typed values are debounced and
 * sent through one queue (save-queue.ts); "Kaydedildi 14:02" comes from the
 * server's `at`. Leaving the tab sends what is waiting at once; anything a
 * reload still cut off is replayed on the next load (only where the draft can
 * be edited); the builder shows queued values through `queue.entries()`.
 */
export function useSaver(openingId: string, editable: boolean, onReplay: () => void) {
  const [state, setState] = useState<SaverState>({ kind: "idle" });
  const [queue] = useState(() =>
    createSaveQueue({
      send: (target, patch) => {
        if (target.kind === "stage") return saveStageAction(openingId, target.id, patch as StagePatch);
        if (target.kind === "activity") return saveActivityAction(openingId, target.id, patch as ActivityPatch);
        return setCompetenciesAction(openingId, target.id, patch.ids as string[]);
      },
      onState: setState,
      storage: typeof window === "undefined" ? undefined : sessionStore(openingId),
    }),
  );

  useEffect(() => {
    // A read-only view (a live version, a closed opening, a viewer's role) replays nothing and keeps
    // what is stored for when the draft can be edited again.
    if (editable && queue.replay().entries.length) onReplay();
    const leave = () => void queue.flush();
    const hidden = () => {
      if (document.visibilityState === "hidden") leave();
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hidden);
      void queue.flush();
      queue.dispose();
    };
    // The queue, the opening and the edit right live as long as the page; onReplay only bumps a counter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  return { state, queue };
}
