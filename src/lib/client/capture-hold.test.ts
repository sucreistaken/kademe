import { afterEach, describe, expect, it, vi } from "vitest";
import { captureHeld, captureHeldOnServer, holdCapture, holdUntilSettled, holdWhile, releaseCapture, subscribeCapture } from "./capture-hold";

/**
 * Task 5 fix round 2: a recording or an upload in progress holds the page, so
 * the frame's language link (a full page load) cannot cut it.
 */
afterEach(() => {
  for (const id of ["a", "b", "take", "file", "outcome"]) releaseCapture(id);
});

describe("the capture-in-progress store", () => {
  it("is held while anyone holds it, and free again after the last release", () => {
    expect(captureHeld()).toBe(false);
    holdCapture("a");
    expect(captureHeld()).toBe(true);
    holdCapture("b");
    releaseCapture("a");
    expect(captureHeld()).toBe(true);
    releaseCapture("b");
    expect(captureHeld()).toBe(false);
  });

  it("counts a holder once, so a repeated hold needs one release, and an unknown release changes nothing", () => {
    holdCapture("a");
    holdCapture("a");
    releaseCapture("a");
    expect(captureHeld()).toBe(false);
    releaseCapture("nobody");
    expect(captureHeld()).toBe(false);
  });

  it("tells subscribers only when the answer changes hands, and stops after unsubscribe", () => {
    const notify = vi.fn();
    const stop = subscribeCapture(notify);
    holdCapture("a");
    holdCapture("a");
    holdCapture("b");
    releaseCapture("a");
    releaseCapture("b");
    expect(notify).toHaveBeenCalledTimes(4);
    stop();
    holdCapture("a");
    expect(notify).toHaveBeenCalledTimes(4);
  });

  it("is never held on the server, so the link renders live there", () => {
    holdCapture("a");
    expect(captureHeldOnServer()).toBe(false);
  });

  it("holds until an outcome settles, resolved or rejected: a take outlives its screen like a file upload (Task 5 carry)", async () => {
    let done!: (v: string) => void;
    const first = new Promise<string>((resolve) => (done = resolve));
    holdUntilSettled("outcome", first);
    expect(captureHeld()).toBe(true);
    done("ok");
    await first;
    await Promise.resolve();
    expect(captureHeld()).toBe(false);
    let fail!: (e: Error) => void;
    const second = new Promise<string>((_, reject) => (fail = reject));
    holdUntilSettled("outcome", second);
    expect(captureHeld()).toBe(true);
    fail(new Error("x"));
    await second.catch(() => undefined);
    await Promise.resolve();
    expect(captureHeld()).toBe(false);
  });

  it("holds through an effect while the work runs and releases on its cleanup: on settle and on unmount (RecordedActivity, FileActivity)", () => {
    const cleanupWhileRecording = holdWhile("take", true);
    expect(captureHeld()).toBe(true);
    cleanupWhileRecording(); // the take settled, or the screen went away mid-take
    expect(captureHeld()).toBe(false);
    const idle = holdWhile("file", false);
    expect(captureHeld()).toBe(false);
    idle();
    expect(captureHeld()).toBe(false);
  });
});
