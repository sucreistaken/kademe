import { describe, expect, it, vi } from "vitest";

/**
 * Final wave A-I3: useArrivalFocusOn runs outside React here (no DOM in this
 * suite): useState keeps its first value per hook instance and every effect
 * runs at once, as a commit would.
 */
const slots: unknown[] = [];
let cursor = 0;
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (init: unknown) => {
    const at = cursor++;
    if (!(at in slots)) slots[at] = typeof init === "function" ? (init as () => unknown)() : init;
    return [slots[at], () => undefined];
  },
  useEffect: (effect: () => void) => effect(),
}));

import { useArrivalFocusOn } from "./use-step-focus";

/** One render of a component that uses the hook: same instance, so the slot cursor restarts. */
function Heading({ target, active }: { target: { current: { focus: (o?: FocusOptions) => void } | null }; active?: boolean }) {
  useArrivalFocusOn(target, active);
  return null;
}
const render = (target: { current: { focus: (o?: FocusOptions) => void } | null }, active?: boolean) => {
  cursor = 0;
  return Heading({ target, active });
};

describe("useArrivalFocusOn (a heading another hook already owns)", () => {
  it("focuses the heading once when the screen arrives, without scrolling, and not on later renders", () => {
    slots.length = 0;
    const focus = vi.fn();
    const ref = { current: { focus } };
    render(ref);
    render(ref);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("waits for the heading to exist, and does nothing while the screen is not the arrival one", () => {
    slots.length = 0;
    const focus = vi.fn();
    const ref: { current: { focus: typeof focus } | null } = { current: null };
    render(ref);
    expect(focus).not.toHaveBeenCalled();
    ref.current = { focus };
    render(ref, false);
    expect(focus).not.toHaveBeenCalled();
    render(ref, true);
    expect(focus).toHaveBeenCalledTimes(1);
  });
});
