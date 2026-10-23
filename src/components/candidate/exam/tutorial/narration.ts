import type { Section } from "@/lib/exam/types";
import data from "./narration.json";
import type { StepDurations, TutorialScript } from "./script-types";
import { estimateNarrationMs, RECORDED_GAP_MS } from "./timeline";

/**
 * The spoken captions, made once by scripts/tutorial-tts.ts: one mp3 per
 * step under public/tutorial/<locale>/<SECTION>/, with its length and the hash
 * of what it says. A step without a recording (no key, quota, a new caption)
 * is timed from its caption's words and shown as captions only.
 */
export type NarrationEntry = { src: string; ms: number; hash: string };
export type NarrationFile = Record<string, Partial<Record<Section, Record<string, NarrationEntry>>>>;

export const NARRATION = data as NarrationFile;

export function narrationFor(locale: string, section: Section): Record<string, NarrationEntry> {
  return NARRATION[locale]?.[section] ?? {};
}

/** Each step's narration length: the recording's plus a short quiet gap when there is one, else estimated from the caption's words. */
export function stepDurations(
  script: TutorialScript,
  captions: Record<string, string>,
  narration: Record<string, NarrationEntry>,
  locale: string,
): StepDurations {
  return Object.fromEntries(script.steps.map((s) => [s.id, narration[s.id] ? narration[s.id].ms + RECORDED_GAP_MS : estimateNarrationMs(captions[s.id] ?? "", locale)]));
}
