import { afterEach, describe, expect, it, vi } from "vitest";
import { UPLOAD_HOLD_PREFIX, captureHeld, captureHeldOnServer, captureUploadOnly, captureUploadOnlyOnServer, holdCapture, holdUntilSettled, holdWhile, releaseCapture, subscribeCapture } from "./capture-hold";

/**
 * Task 5 fix round 2: a recording or an upload in progress holds the page, so
 * the frame's language link (a full page load) cannot cut it.
 */
afterEach(() => {
  for (const id of ["a", "b", "take", "file", "outcome", `${UPLOAD_HOLD_PREFIX}1`, `${UPLOAD_HOLD_PREFIX}2`]) releaseCapture(id);
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

describe("which kind of capture holds the page (Task 11, the Task 5 carry)", () => {
  it("is upload-only while every holder is an upload, so the language link can say the upload's own wait", () => {
    expect(captureUploadOnly()).toBe(false);
    holdCapture(`${UPLOAD_HOLD_PREFIX}1`);
    expect(captureUploadOnly()).toBe(true);
    holdCapture(`${UPLOAD_HOLD_PREFIX}2`);
    expect(captureUploadOnly()).toBe(true);
    releaseCapture(`${UPLOAD_HOLD_PREFIX}1`);
    releaseCapture(`${UPLOAD_HOLD_PREFIX}2`);
    expect(captureUploadOnly()).toBe(false);
  });

  it("falls back to the recording wording as soon as a take also holds the page", () => {
    holdCapture(`${UPLOAD_HOLD_PREFIX}1`);
    holdCapture("take");
    expect(captureHeld()).toBe(true);
    expect(captureUploadOnly()).toBe(false);
    releaseCapture("take");
    expect(captureUploadOnly()).toBe(true);
  });

  it("is never upload-only on the server", () => {
    holdCapture(`${UPLOAD_HOLD_PREFIX}1`);
    expect(captureUploadOnlyOnServer()).toBe(false);
  });
});
