"use client";

import { useEffect, useRef } from "react";
import { apiBeacon, apiSend } from "@/lib/client/api";

/**
 * Logs the interruptions a browser genuinely reports. Nothing here claims to
 * see a second screen, a phone or another person in the room, because none of
 * that is observable and pretending otherwise would be dishonest to the
 * candidate and misleading to the manager.
 *
 * These events never fail anybody. They land in the manager's log next to the
 * answer, and the manager decides whether a retake is fair.
 */

export type TechEvent = {
  type: string;
  at: string;
  meta?: Record<string, unknown>;
};

const FLUSH_MS = 10_000;

export function useTechnicalEvents(
  token: string,
  active: boolean,
  stream?: MediaStream | null,
) {
  const queue = useRef<TechEvent[]>([]);

  useEffect(() => {
    if (!active) return;

    const push = (type: string, meta?: Record<string, unknown>) => {
      queue.current.push({ type, at: new Date().toISOString(), meta });
    };

    const flush = async () => {
      if (queue.current.length === 0) return;
      const batch = queue.current.splice(0, queue.current.length);
      try {
        await apiSend(token, "/event", { events: batch });
      } catch {
        // Keep going; a lost log line must never interrupt a recording.
      }
    };

    const onVisibility = () =>
      push(document.hidden ? "VISIBILITY_HIDDEN" : "VISIBILITY_VISIBLE");
    const onBlur = () => push("WINDOW_BLUR");
    const onFocus = () => push("WINDOW_FOCUS");
    const onFullscreen = () =>
      push(document.fullscreenElement ? "FULLSCREEN_ENTER" : "FULLSCREEN_EXIT");
    const onOnline = () => push("ONLINE");
    const onOffline = () => push("OFFLINE");
    const onUnload = () => {
      push("PAGE_UNLOAD");
      const batch = queue.current.splice(0, queue.current.length);
      if (batch.length > 0) apiBeacon(token, "/event", { events: batch });
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("pagehide", onUnload);

    const trackHandlers: Array<() => void> = [];
    for (const track of stream?.getTracks() ?? []) {
      const kind = track.kind === "audio" ? "MIC" : "CAMERA";
      const onMute = () => push(`${kind}_MUTED`, { label: track.label });
      const onUnmute = () => push(`${kind}_UNMUTED`, { label: track.label });
      track.addEventListener("mute", onMute);
      track.addEventListener("unmute", onUnmute);
      trackHandlers.push(() => {
        track.removeEventListener("mute", onMute);
        track.removeEventListener("unmute", onUnmute);
      });
    }

    const timer = window.setInterval(flush, FLUSH_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pagehide", onUnload);
      for (const off of trackHandlers) off();
      window.clearInterval(timer);
      void flush();
    };
  }, [token, active, stream]);
}
