import { afterEach, describe, expect, it, vi } from "vitest";
import { clearHash, isHashStepEntry, leaveHashStep, pushHash, replaceHash, subscribeHash } from "./hash-step";

/** A window with only what the helpers use: listeners by type and a history that records its pushes. */
function fakeWindow() {
  const target = new EventTarget();
  const pushes: unknown[][] = [];
  const replaces: unknown[][] = [];
  const backs: number[] = [];
  return {
    pushes,
    replaces,
    backs,
    location: { pathname: "/a/tok", search: "?lang=en", hash: "#consent" },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    history: {
      state: null as unknown,
      pushState: (...args: unknown[]) => void pushes.push(args),
      replaceState: (...args: unknown[]) => void replaces.push(args),
      back: () => void backs.push(1),
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("a page step in the hash (K3, ruling 2)", () => {
  it("pushes the step as a new history entry, so the browser's back returns to the step before, and tells the subscribers", () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const notify = vi.fn();
    const stop = subscribeHash(notify);
    pushHash("#consent");
    // The entry carries the marker (Next's patched pushState adds its own state next to it).
    expect(win.pushes).toEqual([[{ hashStep: true }, "", "#consent"]]);
    expect(notify).toHaveBeenCalledTimes(1);
    // The browser's back and forward buttons are heard too.
    win.dispatchEvent(new Event("popstate"));
    expect(notify).toHaveBeenCalledTimes(2);
    stop();
    pushHash("#consent");
    win.dispatchEvent(new Event("popstate"));
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("leaves a step the page was opened on without leaving the page, keeping the path and the language", () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const notify = vi.fn();
    subscribeHash(notify);
    clearHash();
    expect(win.replaces).toEqual([[null, "", "/a/tok?lang=en"]]);
    expect(win.pushes).toEqual([]);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("knows an entry it pushed, also after a reload, since the browser keeps the entry's state (review fix 3)", () => {
    expect(isHashStepEntry({ hashStep: true, __NA: true })).toBe(true);
    expect(isHashStepEntry({ __NA: true })).toBe(false);
    expect(isHashStepEntry(null)).toBe(false);
    expect(isHashStepEntry("hashStep")).toBe(false);
  });

  it("goes back in history from an entry it pushed, and swaps the address only on a page opened directly on the step (review fix 3)", () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    win.history.state = { hashStep: true, __NA: true };
    leaveHashStep();
    expect(win.backs).toHaveLength(1);
    expect(win.replaces).toEqual([]);
    win.history.state = { __NA: true };
    leaveHashStep();
    expect(win.backs).toHaveLength(1);
    expect(win.replaces).toEqual([[null, "", "/a/tok?lang=en"]]);
  });
});

describe("the address catching up with the step shown (W3, Task 19 fix)", () => {
  it("rewrites the hash in place: no new entry, no event, the entry's state and the path and language kept", () => {
    const win = fakeWindow();
    win.history.state = { hashStep: true, __NA: true };
    vi.stubGlobal("window", win);
    const notify = vi.fn();
    subscribeHash(notify);
    replaceHash("#decider");
    replaceHash("");
    expect(win.replaces).toEqual([
      [{ hashStep: true, __NA: true }, "", "/a/tok?lang=en#decider"],
      [{ hashStep: true, __NA: true }, "", "/a/tok?lang=en"],
    ]);
    expect(win.pushes).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });
});
