"use client";

import { useEffect, useRef, useState } from "react";
import { apiSend } from "@/lib/client/api";

/**
 * Renders the countdown the server already decided on.
 *
 * The device clock is not trusted: the offset between it and the server is
 * measured once from the state payload, the countdown is drawn locally so it
 * ticks smoothly, and every heartbeat re-anchors it. A candidate who changes
 * their system clock changes nothing, and a refresh reads the same
 * `deadline_at` back, so time neither resets nor stretches.
 */

const HEARTBEAT_MS = 15_000;
const TICK_MS = 250;

export type StageClock = {
  remainingMs: number;
  expired: boolean;
};

export function useStageClock(
  token: string,
  input: { serverNow: number; deadlineAt: number | null },
  onExpire?: () => void,
): StageClock {
  const offsetRef = useRef(0);
  const deadlineRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const expireRef = useRef(onExpire);

  // The last tick, with the deadline it was counted for. Until the first tick
  // for a new deadline arrives, the value is computed from the payload, so a
  // stage that just started never reads as zero for a moment.
  const [tickState, setTickState] = useState<{ anchor: number | null; left: number }>(() => ({
    anchor: input.deadlineAt,
    left: input.deadlineAt ? Math.max(0, input.deadlineAt - input.serverNow) : 0,
  }));

  useEffect(() => {
    expireRef.current = onExpire;
  });

  useEffect(() => {
    // Anchor to the server's clock once, then draw locally between heartbeats.
    offsetRef.current = input.serverNow - Date.now();
    deadlineRef.current = input.deadlineAt;
    firedRef.current = false;
    const anchor = input.deadlineAt;
    if (!anchor) return;

    const tick = () => {
      const deadline = deadlineRef.current;
      if (!deadline) return;
      const serverNow = Date.now() + offsetRef.current;
      const left = Math.max(0, deadline - serverNow);
      setTickState({ anchor, left });
      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        expireRef.current?.();
      }
    };

    const ticker = window.setInterval(tick, TICK_MS);

    const beat = window.setInterval(async () => {
      try {
        const res = await apiSend<{
          serverNow: string;
          deadlineAt: string | null;
          remainingMs: number | null;
        }>(token, "/heartbeat", {});
        offsetRef.current = Date.parse(res.serverNow) - Date.now();
        if (res.deadlineAt) deadlineRef.current = Date.parse(res.deadlineAt);
      } catch {
        // A missed heartbeat is not a reason to stop the countdown. The stage
        // is closed by the server either way.
      }
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(ticker);
      window.clearInterval(beat);
    };
  }, [token, input.serverNow, input.deadlineAt]);

  const remaining =
    tickState.anchor === input.deadlineAt
      ? tickState.left
      : input.deadlineAt
        ? Math.max(0, input.deadlineAt - input.serverNow)
        : 0;
  return {
    remainingMs: remaining,
    expired: remaining === 0 && !!input.deadlineAt,
  };
}
