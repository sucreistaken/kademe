import { beforeEach, describe, expect, it, vi } from "vitest";

// No jsdom here: useEffect is replaced by a runner that executes the effect
// once and keeps its cleanup, so the hook's real body is what is asserted.
let cleanup: void | (() => void);
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), useEffect: (fn: () => void | (() => void)) => void (cleanup = fn()) }));

const engine = { suppressVoice: vi.fn(), suppressWarnings: vi.fn() };
let current: { engine: typeof engine | null } = { engine };
vi.mock("@/components/candidate/proctor/ProctorProvider", () => ({ useProctor: () => current }));

import { useTutorialSuppression } from "./use-tutorial-suppression";

beforeEach(() => {
  cleanup = undefined;
  current = { engine };
  engine.suppressVoice.mockClear();
  engine.suppressWarnings.mockClear();
});

describe("useTutorialSuppression", () => {
  it("suppresses voice and warnings under the reason tutorial while open, and releases them on cleanup", () => {
    useTutorialSuppression(true);
    expect(engine.suppressVoice).toHaveBeenCalledWith("tutorial", true);
    expect(engine.suppressWarnings).toHaveBeenCalledWith("tutorial", true);
    expect(typeof cleanup).toBe("function");
    (cleanup as () => void)();
    expect(engine.suppressVoice).toHaveBeenLastCalledWith("tutorial", false);
    expect(engine.suppressWarnings).toHaveBeenLastCalledWith("tutorial", false);
  });

  it("does nothing while closed or without an engine", () => {
    useTutorialSuppression(false);
    expect(engine.suppressVoice).not.toHaveBeenCalled();
    expect(cleanup).toBeUndefined();
    current = { engine: null };
    useTutorialSuppression(true);
    expect(cleanup).toBeUndefined();
  });
});
