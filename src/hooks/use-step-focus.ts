import { useEffect, useRef, useState, type RefObject } from "react";

export type Focusable = { focus(options?: FocusOptions): void };

/**
 * Moves focus to the new screen's heading whenever a step-by-step flow
 * changes screen, and never on the first render (opening a page must not
 * steal focus). A repeat of the same step (React running an effect twice, a
 * re-render after a language switch) leaves focus alone. True when it moved.
 */
export function stepFocusController() {
  let started = false;
  let last: string | number | undefined;
  return {
    onStep(step: string | number, target: Focusable | null): boolean {
      if (!started) {
        started = true;
        last = step;
        return false;
      }
      if (step === last) return false;
      last = step;
      if (!target) return false;
      target.focus();
      return true;
    },
  };
}

/**
 * For a candidate-style flow (the hiring preview; plan 2's candidate pages):
 * attach the returned ref to each screen's heading, which carries
 * tabIndex={-1}, and pass the current step. When the button a keyboard user
 * pressed disappears with its screen, focus lands on the new heading instead
 * of <body>. Pair it with a polite live region that names the new position.
 */
export function useStepFocus<T extends HTMLElement>(step: string | number) {
  const ref = useRef<T>(null);
  const [controller] = useState(stepFocusController);
  useEffect(() => {
    controller.onStep(step, ref.current);
  }, [controller, step]);
  return ref;
}

/**
 * A screen reached by a navigation is one step with no later change, so
 * stepFocusController never fires on it. This one focuses the heading once,
 * when the screen arrives (a keyboard or screen reader user lands on the new
 * page's title, not on <body>), without scrolling, and not again when React
 * runs the effect twice.
 */
export function arrivalFocusController() {
  let done = false;
  return {
    onArrive(target: Focusable | null): boolean {
      if (done || !target) return false;
      done = true;
      target.focus({ preventScroll: true });
      return true;
    },
  };
}

/**
 * Attach the returned ref to the screen's heading (tabIndex={-1}); it takes
 * focus once, as soon as the heading exists (normally on mount). The effect
 * has no dependency list on purpose: it retries each render until the
 * heading is there, and the controller makes every later call a no-op.
 */
export function useArrivalFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [controller] = useState(arrivalFocusController);
  useEffect(() => {
    controller.onArrive(ref.current);
  });
  return ref;
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

/** The area held the focus and lost it to nothing (its control unmounted) or to a button that turned disabled. */
export const focusDropped = (at: { inside: boolean; active: ActiveKind }): boolean => at.inside && at.active !== "other";

/**
 * A focusout means the user left the area on purpose when focus went to an
 * element outside it, or, with nowhere to go (relatedTarget null), when the
 * element that lost it is still there and enabled (a click on the page
 * background, another window). An element that unmounted or turned disabled
 * did not leave on purpose.
 */
export function leftOnPurpose(at: { relatedInside: boolean | null; targetConnected: boolean; targetDisabled: boolean }): boolean {
  if (at.relatedInside !== null) return !at.relatedInside;
  return at.targetConnected && !at.targetDisabled;
}

/**
 * K12 (panel flows): while focus is inside `area`, a control that unmounts or
 * turns disabled without a step change (a footer action swapped, a primary
 * that starts to wait) never leaves the keyboard user on <body>: after the
 * render, focus moves to `target` (the step's heading). A step change itself
 * is useStepFocus's job; both land on the same heading.
 */
export function useKeepFocus(area: RefObject<HTMLElement | null>, target: RefObject<Focusable | null>) {
  const inside = useRef(false);
  useEffect(() => {
    const node = area.current;
    if (!node) return;
    const onIn = () => {
      inside.current = true;
    };
    const onOut = (event: FocusEvent) => {
      const left = event.target as (Node & { disabled?: boolean }) | null;
      const related = event.relatedTarget as Node | null;
      const decide = () => {
        if (leftOnPurpose({ relatedInside: related ? node.contains(related) : null, targetConnected: left?.isConnected ?? false, targetDisabled: left?.disabled === true })) inside.current = false;
      };
      // With nowhere to go, wait until the render that removed or disabled it is done.
      if (related) decide();
      else queueMicrotask(decide);
    };
    node.addEventListener("focusin", onIn);
    node.addEventListener("focusout", onOut);
    return () => {
      node.removeEventListener("focusin", onIn);
      node.removeEventListener("focusout", onOut);
    };
  }, [area]);
  useEffect(() => {
    if (focusDropped({ inside: inside.current, active: activeKind(document.activeElement, document.body) })) target.current?.focus({ preventScroll: true });
  });
}
