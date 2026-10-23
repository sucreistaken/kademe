import type { ResultLevel } from "./types";

/**
 * How a result level reads on screen and on paper. A1 to C2 stay as they are;
 * A0 carries its CEFR name, "A0 (Pre-A1)", taken from the copy (`preA1`) so
 * every panel and student page writes it the same way. Anything else (a dash,
 * an empty cell) passes through.
 */
export function levelLabel(level: string, preA1: string): string;
export function levelLabel(level: string | null | undefined, preA1: string): string | null;
export function levelLabel(level: string | null | undefined, preA1: string): string | null {
  if (level === undefined || level === null) return null;
  return isPreA1(level) ? preA1 : level;
}

/** True for A0, the result level below A1 (Pre-A1). */
export const isPreA1 = (level: string | null | undefined): level is Extract<ResultLevel, "A0"> => level === "A0";
