"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { narrationFor, stepDurations } from "./narration";
import type { TutorialScript } from "./script-types";
import { buildTimeline } from "./timeline";

/** A tutorial in the page's language: its captions, its recordings and its timeline. */
export function useTutorial(script: TutorialScript) {
  const locale = useLocale();
  const t = useTranslations("tutorial");
  const captions = t.raw(script.section) as Record<string, string>;
  return useMemo(() => {
    const narration = narrationFor(locale, script.section);
    const timeline = buildTimeline(script, stepDurations(script, captions, narration, locale));
    return { captions, narration, timeline };
  }, [script, locale, captions]);
}
