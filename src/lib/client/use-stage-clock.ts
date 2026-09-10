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

  const [remaining, setRemaining] = useState(() =>
    input.deadlineAt ? Math.max(0, input.deadlineAt - input.serverNow) : 0,
  );

  useEffect(() => {
    expireRef.current = onExpire;
  });

  useEffect(() => {
    // Anchor to the server's clock once, then draw locally between heartbeats.
    offsetRef.current = input.serverNow - Date.now();
    deadlineRef.current = input.deadlineAt;
    firedRef.current = false;
    if (!input.deadlineAt) return;

    const tick = () => {
      const deadline = deadlineRef.current;
      if (!deadline) return;
      const serverNow = Date.now() + offsetRef.current;
      const left = Math.max(0, deadline - serverNow);
      setRemaining(left);
      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        expireRef.current?.();
      }
    };

    const ticker = window.setInterval(tick, TICK_MS);

    const beat = window.setInterval(async () => {
      try {
        const res = await apiSend<{
          active: boolean;
          serverNow: number;
          deadlineAt: number | null;
          remainingMs: number;
        }>(token, "/stage/heartbeat", {});
        if (!res.active) return;
        offsetRef.current = res.serverNow - Date.now();
        if (res.deadlineAt) deadlineRef.current = res.deadlineAt;
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

  return {
    remainingMs: remaining,
    expired: remaining === 0 && !!input.deadlineAt,
  };
}
