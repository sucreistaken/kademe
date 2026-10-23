"use client";

import { useEffect } from "react";
import { useProctor } from "@/components/candidate/proctor/ProctorProvider";

/**
 * The tutorial speaks and is not the exam: while it is open its voice is not
 * "talking during the exam" and no big warning covers it. Both come back on
 * close or unmount.
 */
export function useTutorialSuppression(open: boolean): void {
  const { engine } = useProctor();
  useEffect(() => {
    if (!open || !engine) return;
    engine.suppressVoice("tutorial", true);
    engine.suppressWarnings("tutorial", true);
    return () => {
      engine.suppressVoice("tutorial", false);
      engine.suppressWarnings("tutorial", false);
    };
  }, [engine, open]);
}
