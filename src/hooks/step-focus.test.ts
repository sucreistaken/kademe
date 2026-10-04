import { describe, expect, it, vi } from "vitest";
import { stepFocusController } from "./use-step-focus";

/**
 * A step-by-step flow (the hiring preview now, plan 2's candidate flow later)
 * moves focus to the new screen's heading whenever the step changes, so a
 * keyboard or screen reader user is never left on <body> when the button they
 * pressed disappears. Never on the first render: opening a page must not
 * steal focus.
 */
describe("stepFocusController", () => {
  const target = () => ({ focus: vi.fn() });

  it("does not move focus on the first render, nor when React runs the same effect twice", () => {
    const c = stepFocusController();
    const h = target();
    expect(c.onStep(0, h)).toBe(false);
    expect(c.onStep(0, h)).toBe(false);
    expect(h.focus).not.toHaveBeenCalled();
  });

  it("focuses the new heading on every change: forward, back to the start, and a restart", () => {
    const c = stepFocusController();
    c.onStep(0, target());
    for (const step of [1, 2, 1, 0, 5, 0]) {
      const h = target();
      expect(c.onStep(step, h)).toBe(true);
      expect(h.focus).toHaveBeenCalledTimes(1);
    }
  });

  it("a re-render on the same step (a language switch) leaves focus where it is", () => {
    const c = stepFocusController();
    c.onStep(0, target());
    c.onStep(3, target());
    const h = target();
    expect(c.onStep(3, h)).toBe(false);
    expect(h.focus).not.toHaveBeenCalled();
  });

  it("a step without a heading to focus changes nothing and does not throw", () => {
    const c = stepFocusController();
    c.onStep(0, null);
    expect(() => c.onStep(1, null)).not.toThrow();
  });
});
