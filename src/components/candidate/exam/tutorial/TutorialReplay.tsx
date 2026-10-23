"use client";

import { useTranslations } from "next-intl";
import type { Section } from "@/lib/exam/types";
import { TutorialPlayer } from "./TutorialPlayer";
import { TUTORIAL_SCRIPTS } from "./scripts";
import { useTutorialSuppression } from "./use-tutorial-suppression";

/**
 * The how-it-works video opened from the exam top bar, for the section on
 * screen. The exam clock keeps running, which the dialog says. Like the one on
 * the section introduction it is not the exam: while it is open its voice is
 * not "talking during the exam" and no big warning covers it; both come back
 * on close or unmount. It touches no answers and no navigation state.
 */
export function TutorialReplay({ section, open, onOpenChange }: { section: Section; open: boolean; onOpenChange: (open: boolean) => void }) {
  const tt = useTranslations("tutorial");
  useTutorialSuppression(open);
  return <TutorialPlayer script={TUTORIAL_SCRIPTS[section]} open={open} onOpenChange={onOpenChange} note={tt("clockRunning")} />;
}
