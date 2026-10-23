/** How the exam clock should look and what it should announce. */
export type TimeCue = "normal" | "low" | "last" | "up";

/** How long the 5- and 2-minute callout stays before it hides itself (spec 2026-10-23: 12 s). */
export const TIME_NOTICE_MS = 12_000;

const LAST_MS = 120_000;
const LOW_MS = 300_000;
/** Sections up to 10 minutes get no "low" step: 5 minutes would be half of them. */
const LOW_MIN_SECTION_MS = 600_000;

export function timeCue(remainingMs: number, sectionMs: number): TimeCue {
  if (remainingMs <= 0) return "up";
  if (remainingMs <= LAST_MS) return "last";
  if (remainingMs <= LOW_MS && sectionMs > LOW_MIN_SECTION_MS) return "low";
  return "normal";
}

/** The cue to announce when the clock moves from `prev` to `next`: only a step into low or last. */
export function crossedCue(prev: TimeCue, next: TimeCue): "low" | "last" | null {
  if (next === "low" && prev === "normal") return "low";
  if (next === "last" && (prev === "normal" || prev === "low")) return "last";
  return null;
}

/** sessionStorage key remembering which cues a section run already announced. */
export function timeCueKey(token: string, sectionPosition: number): string {
  return `kademe.exam.timecue.${token}.${sectionPosition}`;
}
