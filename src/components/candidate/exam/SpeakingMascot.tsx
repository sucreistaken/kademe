"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Mascot } from "@/components/visual/mascot";
import { isTalking, lettersShown, typingStepMs } from "./mascot-line";

/**
 * The mascot on the speaking task of a course test (spec 2026-10-28, the one
 * question screen that has one): it stands beside the task card and "says" the
 * task's first sentence in a speech bubble that is typed in while its mouth
 * moves. There is no sound, so nothing changes for the proctoring.
 *
 * The line is only ever the first sentence of the card beside it, so the whole
 * row is hidden from assistive technology (a screen reader would hear the task
 * twice, and a letter-by-letter update is noise). The typed part is visible
 * and the rest is `invisible`, not absent: the bubble has its final size from
 * the first frame and nothing below it moves while the line is typed.
 *
 * Under prefers-reduced-motion nothing is typed and the mouth never moves: the
 * whole line is there at once. The same goes for a task opened after the
 * recording started or finished (`talk` false), and for the moment the student
 * presses "start speaking" while the line is still being typed.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// The server and the first client render agree on "motion is fine"; a visitor who asked for less sees the whole line right after.
const readReduced = () => window.matchMedia(REDUCED).matches;
const serverReduced = () => false;

export function SpeakingMascot({ line, talk }: { line: string; talk: boolean }) {
  const reduced = useSyncExternalStore(subscribeReduced, readReduced, serverReduced);
  const [typed, setTyped] = useState(0);
  const typing = talk && !reduced;

  useEffect(() => {
    if (!typing || line.length === 0) return;
    let count = 0;
    const id = window.setInterval(() => {
      count += 1;
      setTyped(count);
      if (count >= line.length) window.clearInterval(id);
    }, typingStepMs(line.length));
    return () => window.clearInterval(id);
  }, [typing, line]);

  const shown = typing ? lettersShown(typed, line.length) : line.length;
  return (
    <div data-speaking-mascot aria-hidden="true" className="mb-4 flex items-start gap-1.5">
      {/* The drawing starts 18px down its 64px box; the 12px pulled up leaves it clear of the column's scroll edge. */}
      <Mascot pose="talk" talking={typing && isTalking(typed, line.length)} size="small" className="-mt-3 w-16 rtl:-scale-x-100" />
      <div className="relative min-w-0 flex-1 rounded-[18px] border-2 border-line bg-surface px-3.5 py-2.5 shadow-lip-soft">
        {/* The tail points at the mascot, on the start side of the bubble in either direction. */}
        <span className="absolute -start-[7px] top-4 size-3 rotate-45 border-b-2 border-s-2 border-line bg-surface rtl:border-b-0 rtl:border-t-2" />
        <p lang="de" className="text-[15px] font-bold leading-[1.45] text-ink">
          <span>{line.slice(0, shown)}</span>
          <span className="invisible">{line.slice(shown)}</span>
        </p>
      </div>
    </div>
  );
}
