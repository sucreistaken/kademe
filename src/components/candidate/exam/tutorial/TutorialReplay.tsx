"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useProctor } from "@/components/candidate/proctor/ProctorProvider";
import type { Section } from "@/lib/exam/types";
import { TutorialPlayer } from "./TutorialPlayer";
import { TUTORIAL_SCRIPTS } from "./scripts";

/**
 * The how-it-works video opened from the exam top bar, for the section on
 * screen. The exam clock keeps running, which the dialog says. Like the one on
 * the section introduction it is not the exam: while it is open its voice is
 * not "talking during the exam" and no big warning covers it; both come back
 * on close or unmount. It touches no answers and no navigation state.
 */
export function TutorialReplay({ section, open, onOpenChange }: { section: Section; open: boolean; onOpenChange: (open: boolean) => void }) {
  const tt = useTranslations("tutorial");
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
  return <TutorialPlayer script={TUTORIAL_SCRIPTS[section]} open={open} onOpenChange={onOpenChange} note={tt("clockRunning")} />;
}
