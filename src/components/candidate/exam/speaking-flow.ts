/**
 * The pure side of the speaking recorder: which step of "prepare, speak,
 * saved" a phase belongs to, how much of the ring is left and how many bars of
 * the microphone meter are lit. Kept apart from the markup so it can be tested.
 */

/** Where the recorder of a speaking question is. */
export type SpeakingPhase = "THINKING" | "RECORDING" | "UPLOADING" | "DONE" | "FAILED";

/** Where the recorder starts: a question that already has a take (after a reload) starts at "saved". */
export function initialSpeakingPhase(takesUsed: number | null | undefined): SpeakingPhase {
  return takesUsed && takesUsed > 0 ? "DONE" : "THINKING";
}

/** The three steps the panel shows, in order. */
export const SPEAKING_STEPS = ["prepare", "speak", "saved"] as const;
export type SpeakingStepId = (typeof SPEAKING_STEPS)[number];

/**
 * The step in progress: 0 prepare, 1 speak, 2 saved. 3 means every step is
 * behind the student. A failed recording stays on "speak" (it did not finish).
 */
export function speakingStep(phase: SpeakingPhase): 0 | 1 | 2 | 3 {
  switch (phase) {
    case "THINKING":
      return 0;
    case "RECORDING":
    case "FAILED":
      return 1;
    case "UPLOADING":
      return 2;
    case "DONE":
      return 3;
  }
}

/** done: behind the student; active: in progress; todo: still to come. */
export function speakingStepState(phase: SpeakingPhase, index: number): "done" | "active" | "todo" {
  const at = speakingStep(phase);
  return index < at ? "done" : index === at ? "active" : "todo";
}

/** The part of the running time still left, 0 to 1 (the ring's length). Unknown or empty totals read as empty. */
export function timeLeftFraction(leftMs: number, totalMs: number): number {
  if (!Number.isFinite(leftMs) || !Number.isFinite(totalMs) || totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, leftMs / totalMs));
}

/**
 * How many of `bars` the microphone meter lights for a peak level of 0 to 1.
 * Speech peaks sit low, so the scale is stretched (a level of 0.25 fills it).
 */
export function litBars(level: number, bars: number): number {
  if (!Number.isFinite(level) || level <= 0) return 0;
  return Math.round(Math.min(1, level * 4) * bars);
}
