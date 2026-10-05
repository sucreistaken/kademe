"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/candidate-client";

const SECONDS = 8;

/**
 * HIRING-UX 6.10: finishing the last stage is the one action that cannot be
 * taken back, so it waits 8 seconds with "Geri al" instead of asking "emin
 * misin" (EXAM-UX rule 6). Nothing is sent until the time is up. "Geri al"
 * takes focus (the button that was pressed is disabled meanwhile); a screen
 * reader hears the strip once, not every second.
 */
export function SubmitDelay({ onElapsed, onUndo }: { onElapsed: () => void; onUndo: () => void }) {
  const t = useT("hiringStage");
  const [left, setLeft] = useState(SECONDS);
  const fired = useRef(false);
  const undo = useRef<HTMLButtonElement>(null);
  // The runner re-renders four times a second (its clock): keep the latest callback
  // in a ref so the one-second timer is not restarted by every render.
  const elapsed = useRef(onElapsed);
  useEffect(() => {
    elapsed.current = onElapsed;
  });
  useEffect(() => {
    undo.current?.focus();
  }, []);
  // Counted from the wall clock, not by chained one-second timers: a throttled tab
  // never stretches the wait, and the send still happens only after the full 8 seconds.
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      const now = Math.max(0, SECONDS - Math.floor((Date.now() - started) / 1000));
      setLeft(now);
      if (now === 0 && !fired.current) {
        fired.current = true;
        window.clearInterval(id);
        elapsed.current();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3 shadow-overlay">
        <p role="status" className="sr-only">
          {t("sendingAnnounce")}
        </p>
        <span className="tnum text-[16px] text-ink" aria-hidden>
          {t("sending", { seconds: Math.max(0, left) })}
        </span>
        <Button ref={undo} className="min-h-11 text-[16px]" onClick={onUndo}>
          {t("undo")}
        </Button>
      </div>
    </div>
  );
}
