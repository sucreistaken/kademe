/**
 * C4: what the recorded answer's footer actions say about waiting and working,
 * as one pure rule so the screen cannot show a clickable "Bu cevabı kullan" or
 * "Tekrar dene" beside the runner's own automatic submit, nor a "Kaydediliyor"
 * spinner when nothing is being saved.
 *
 * - Time is up: the action waits with the time-up reason; never a spinner (the
 *   runner's auto submit is the one that works, and it says so itself).
 * - `holdReason`: the runner holds the screen for a reason of its own (the 8
 *   second send strip before the last stage closes): that reason is shown, not
 *   a spinner, because the strip itself is the thing that is waiting.
 * - Otherwise a disabled screen is a screen that is saving: busy.
 */
export function recordedFooterState(input: { timeUp: boolean; disabled: boolean; timeUpReason: string; holdReason?: string | null }): { waitReason: string | null; busy: boolean } {
  if (input.timeUp) return { waitReason: input.timeUpReason, busy: false };
  if (input.holdReason) return { waitReason: input.holdReason, busy: false };
  return { waitReason: null, busy: input.disabled };
}

/**
 * Task 4 carry 6: a focused button that time-up turned into a waiting one (or
 * took out of the footer) leaves focus on a disabled control or on nothing;
 * focus then goes to the question's heading, which carries the screen's
 * message. Focus anywhere else (a notes field, a working button) is left alone.
 */
export function refocusAfterTimeUp(input: { timeUp: boolean; wasTimeUp: boolean; active: "disabled-control" | "body" | "other" }): boolean {
  return input.timeUp && !input.wasTimeUp && input.active !== "other";
}
