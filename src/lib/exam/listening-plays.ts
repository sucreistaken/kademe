import { adaptiveLevels } from "./blueprint";
import { levelIndex } from "./cefr";
import type { Cefr, ExamMode } from "./types";

/**
 * How often a listening clip may be played: the exam-wide setting, lowered by
 * the clip's own limit when it has one (real B2+ exams play some recordings
 * only once). Never below 1; a missing or invalid clip limit means the exam
 * setting, which is also what snapshots taken before the field existed mean.
 */
export function playsAllowed(examMax: number, clipMax: number | null | undefined): number {
  const clip = typeof clipMax === "number" && Number.isFinite(clipMax) ? clipMax : examMax;
  return Math.max(1, Math.min(examMax, clip));
}

/**
 * Whether the listening section intro must stop promising the exam-wide number
 * for every recording. Only clips of B2 and above can play once (A1-B1 clips
 * never do), so the hint is shown when the exam setting is above 1 and the
 * levels the section can draw from (see adaptiveLevels: all levels in
 * PLACEMENT, the claimed level and its neighbours in verification) reach B2.
 */
export function introNeedsMixedPlaysRule(examMax: number, mode: ExamMode, claimed: Cefr | null): boolean {
  return examMax > 1 && adaptiveLevels(mode, claimed).some((l) => levelIndex(l) >= levelIndex("B2"));
}
