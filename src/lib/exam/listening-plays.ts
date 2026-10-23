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
 * for every recording. The intro is shown before the clips are drawn, so it
 * cannot know whether one of them plays once; it adds the hint whenever a
 * clip could play fewer times than the exam setting (setting above 1).
 */
export function introNeedsMixedPlaysRule(examMax: number): boolean {
  return examMax > 1;
}
