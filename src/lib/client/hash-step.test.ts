import { afterEach, describe, expect, it, vi } from "vitest";
import { clearHash, pushHash, subscribeHash } from "./hash-step";

/** A window with only what the helpers use: listeners by type and a history that records its pushes. */
function fakeWindow() {
  const target = new EventTarget();
  const pushes: unknown[][] = [];
  const replaces: unknown[][] = [];
  return {
    pushes,
    replaces,
    location: { pathname: "/a/tok", search: "?lang=en", hash: "#consent" },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    history: { pushState: (...args: unknown[]) => void pushes.push(args), replaceState: (...args: unknown[]) => void replaces.push(args) },
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
    expect(win.pushes).toEqual([[null, "", "#consent"]]);
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
});
