import { useEffect, useRef, useState } from "react";

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
