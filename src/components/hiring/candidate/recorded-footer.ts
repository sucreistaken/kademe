import { useEffect, useRef } from "react";
import type { Focusable } from "@/hooks/use-step-focus";

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
 * Fix round 1, Important 4: the picture's place says "Kamera, sen başlatınca
 * açılır." only where pressing the start button really opens the camera: the
 * think screen, and a failure whose "Tekrar dene" starts a new take (not one
 * that only finishes the old take again, and not when no take is left).
 * Elsewhere (saving, saved, a review whose playback has not arrived or never
 * will) the place shows its icon alone.
 */
export function startLineShown(input: { phase: "think" | "record" | "saving" | "review" | "saved" | "failed"; startsNewTake: boolean }): boolean {
  return input.phase === "think" || (input.phase === "failed" && input.startsNewTake);
}

/**
 * Task 4 carry 6: a focused button that time-up turned into a waiting one (or
 * took out of the footer) leaves focus on a disabled control or on nothing;
 * focus then goes to the question's heading, which carries the screen's
 * message. Focus anywhere else (a notes field, a working button) is left alone.
 */
export function refocusAfterTimeUp(input: { timeUp: boolean; wasTimeUp: boolean; active: ActiveKind }): boolean {
  return input.timeUp && !input.wasTimeUp && input.active !== "other";
}

export type ActiveKind = "disabled-control" | "body" | "other";

/**
 * Where focus sits: on nothing (no element, or the page body), on a disabled
 * button (a natively disabled one; a working footer button is aria-disabled
 * and keeps its focus), or anywhere else.
 */
export function activeKind(active: { tagName?: string; disabled?: boolean } | null, body: unknown): ActiveKind {
  if (!active || active === body) return "body";
  return (active.tagName ?? "").toUpperCase() === "BUTTON" && active.disabled === true ? "disabled-control" : "other";
}

/**
 * Task 10 fix round 1: the one effect behind refocusAfterTimeUp, for the
 * recorded answer (its time up) and the stage runner (its time up, and its
 * footer taking over from a recorded question's own). When `on` turns true and
 * focus was left on a disabled button or on nothing, it moves to `target()`.
 * `initial` is what `on` counts as before the first render (the recorded
 * answer passes its time-up state at mount, so a screen opened after time up
 * does not take focus).
 */
export function useRescueFocus(on: boolean, target: () => Focusable | null, initial: boolean): void {
  const was = useRef(initial);
  const latest = useRef(target);
  useEffect(() => {
    latest.current = target;
  });
  useEffect(() => {
    if (refocusAfterTimeUp({ timeUp: on, wasTimeUp: was.current, active: activeKind(document.activeElement, document.body) })) latest.current()?.focus();
    was.current = on;
  }, [on]);
}
