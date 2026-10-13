import { BAND_CENTER, thetaForLevel } from "./cefr";
import type { Cefr } from "./types";

/**
 * Kolay / Orta / Zor inside a CEFR level (user decision 2026-10-14: "A2 Zor"
 * is still A2). It is the engine's `within` of `thetaForLevel`, nothing new:
 * an item's numeric difficulty (a Rasch logit) is what the engine reads, and
 * the word is derived from it, never stored beside it.
 *
 * The word is the nearest of the three points `thetaForLevel` gives the level
 * (centre - 0.3, centre, centre + 0.3), so a value written by the bank comes
 * back as the word it was written with, and a value calibrated later still
 * reads sensibly. Halfway between two points counts as Orta.
 */
export const WITHINS = ["EASY", "MID", "HARD"] as const;
export type Within = (typeof WITHINS)[number];

export const isWithin = (value: unknown): value is Within => typeof value === "string" && (WITHINS as readonly string[]).includes(value);

/** The numeric difficulty an item of this level and word gets. */
export const difficultyFor = (level: Cefr, within: Within): number => thetaForLevel(level, within);

/** Half the step between two points: the edge between Kolay and Orta, Orta and Zor. */
export const WITHIN_EDGE = Math.abs(thetaForLevel("B1", "HARD") - thetaForLevel("B1", "MID")) / 2;

export function withinOf(level: Cefr, difficulty: number): Within {
  const offset = difficulty - BAND_CENTER[level];
  // A small tolerance: the column is a 4-byte real, so -1.2 comes back as -1.2000000477.
  if (offset < -WITHIN_EDGE - 1e-6) return "EASY";
  if (offset > WITHIN_EDGE + 1e-6) return "HARD";
  return "MID";
}

const fold = (s: string) =>
  s
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9äöüçğşß]/g, "");

const WORDS: Record<string, Within> = {
  kolay: "EASY",
  easy: "EASY",
  leicht: "EASY",
  "1": "EASY",
  orta: "MID",
  medium: "MID",
  mid: "MID",
  mittel: "MID",
  normal: "MID",
  "2": "MID",
  zor: "HARD",
  hard: "HARD",
  schwer: "HARD",
  difficult: "HARD",
  "3": "HARD",
};

/** A spreadsheet cell's word for the difficulty; null when empty or not one of them. */
export function parseWithin(raw: string | null | undefined): Within | null {
  if (!raw) return null;
  return WORDS[fold(raw)] ?? null;
}

/** The SQL edges of a word for a level, so a list filter matches `withinOf` exactly. */
export function withinRange(level: Cefr, within: Within): { min: number | null; max: number | null } {
  const c = BAND_CENTER[level];
  const edge = WITHIN_EDGE + 1e-6;
  if (within === "EASY") return { min: null, max: c - edge };
  if (within === "HARD") return { min: c + edge, max: null };
  return { min: c - edge, max: c + edge };
}
