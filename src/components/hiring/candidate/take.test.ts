import { describe, expect, it, vi } from "vitest";
import type { OpenTake, RecordingResult, RecordingSink } from "./recording-sink";
import { afterExhausted, canTryAgain, finishFailure, retakesLeft, startFailure, Take, takeHoldsCapture, usedAfterStartFailure, type RecorderLike } from "./take";

/** A MediaRecorder stand-in: chunks and stops are driven by the test. */
class FakeRecorder implements RecorderLike {
  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  timeslice: number | undefined;
  start(timeslice?: number) {
    this.timeslice = timeslice;
    this.state = "recording";
  }
  emit(text: string) {
    this.ondataavailable?.({ data: new Blob([text]) });
  }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    // Like the browser: the last chunk, then the stop.
    this.emit("tail");
    this.onstop?.();
  }
}

function fakeSink(finish?: (durationMs: number) => Promise<RecordingResult>) {
  const pushed: string[] = [];
  const opened = {
    push: (chunk: Blob) => void chunk.text().then((t) => pushed.push(t)),
    finish: vi.fn<(durationMs: number) => Promise<RecordingResult>>(finish ?? (async () => ({ status: "READY", ref: "t1" }))),
    abandon: vi.fn<(durationMs: number, cut?: boolean) => void>(),
  } satisfies OpenTake;
  const sink = { open: vi.fn<RecordingSink["open"]>(async () => opened) };
  return { sink, opened, pushed };
}

const clock = () => {
  let t = 1000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe("one take", () => {
  it("opens the sink first, records in CHUNK_MS slices, passes every chunk on and finishes with its length", async () => {
    const { sink, opened, pushed } = fakeSink();
    const rec = new FakeRecorder();
    const c = clock();
    const take = await Take.begin({ sink, mime: "video/webm", makeRecorder: () => rec, now: c.now, chunkMs: 5000 });
    expect(sink.open).toHaveBeenCalledWith("video/webm", undefined);
    expect(rec.timeslice).toBe(5000);
    expect(take.recording).toBe(true);
    rec.emit("a");
    c.advance(7000);
    take.stop();
    expect(take.recording).toBe(false);
    await expect(take.outcome).resolves.toEqual({ ok: true, result: { status: "READY", ref: "t1" } });
    expect(opened.finish).toHaveBeenCalledWith(7000);
    await Promise.resolve();
    expect(pushed).toEqual(["a", "tail"]);
  });

  it("a recorder error stops the take and keeps what was recorded", async () => {
    const { sink, opened } = fakeSink();
    const rec = new FakeRecorder();
    const take = await Take.begin({ sink, mime: "audio/webm", makeRecorder: () => rec, chunkMs: 5000 });
    rec.onerror?.(new Event("error"));
    await expect(take.outcome).resolves.toMatchObject({ ok: true });
    expect(opened.finish).toHaveBeenCalledTimes(1);
  });

  it("a finish that fails is said, never thrown, and can be tried again with the same length", async () => {
    let fail = true;
    const { sink, opened } = fakeSink(async () => {
      if (fail) throw new TypeError("Failed to fetch");
      return { status: "INCOMPLETE", ref: "t1" };
    });
    const rec = new FakeRecorder();
    const c = clock();
    const take = await Take.begin({ sink, mime: "video/webm", makeRecorder: () => rec, now: c.now, chunkMs: 5000 });
    c.advance(3000);
    take.stop();
    await expect(take.outcome).resolves.toMatchObject({ ok: false });
    fail = false;
    c.advance(60_000);
    await expect(take.retry()).resolves.toEqual({ ok: true, result: { status: "INCOMPLETE", ref: "t1" } });
    await expect(take.outcome).resolves.toMatchObject({ ok: true });
    expect(opened.finish.mock.calls).toEqual([[3000], [3000]]);
  });

  it("a page going away mid-take keeps what landed (abandon), once; a finished take is left alone", async () => {
    const { sink, opened } = fakeSink();
    const rec = new FakeRecorder();
    const c = clock();
    const take = await Take.begin({ sink, mime: "video/webm", makeRecorder: () => rec, now: c.now, chunkMs: 5000 });
    c.advance(4000);
    take.hide();
    take.hide();
    expect(opened.abandon).toHaveBeenCalledTimes(1);
    // Still recording: the recorder had not handed its last seconds over, so the take is cut.
    expect(opened.abandon).toHaveBeenCalledWith(4000, true);

    const other = fakeSink();
    const rec2 = new FakeRecorder();
    const done = await Take.begin({ sink: other.sink, mime: "video/webm", makeRecorder: () => rec2, chunkMs: 5000 });
    done.stop();
    await done.outcome;
    done.hide();
    expect(other.opened.abandon).not.toHaveBeenCalled();
  });

  it("a page going away while the take is finishing still completes what landed", async () => {
    const { sink, opened } = fakeSink(() => new Promise(() => undefined));
    const rec = new FakeRecorder();
    const take = await Take.begin({ sink, mime: "video/webm", makeRecorder: () => rec, chunkMs: 5000 });
    take.stop();
    take.hide();
    expect(opened.abandon).toHaveBeenCalledTimes(1);
    // The recording had ended: whether it is whole is the sink's to say (fix round 1, Minor 3).
    expect(opened.abandon.mock.calls[0][1]).toBe(false);
  });

  it("listens for the page going away from its start until it is finished, even after its screen is gone (fix round 1, Minor 4)", async () => {
    const { sink, opened } = fakeSink();
    let handler: (() => void) | null = null;
    const unwatch = vi.fn(() => {
      handler = null;
    });
    const watchPageHide = vi.fn((h: () => void) => {
      handler = h;
      return unwatch;
    });
    const rec = new FakeRecorder();
    const take = await Take.begin({ sink, mime: "video/webm", makeRecorder: () => rec, chunkMs: 5000, watchPageHide });
    expect(watchPageHide).toHaveBeenCalledTimes(1);
    // The screen that started the take may be gone by now; the page going away still keeps what landed.
    handler!();
    expect(opened.abandon).toHaveBeenCalledTimes(1);
    expect(unwatch).not.toHaveBeenCalled();
    take.stop();
    await take.outcome;
    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it("keeps listening after a failed finish (the take still waits), and stops when the retry finishes it", async () => {
    let fail = true;
    const { sink } = fakeSink(async () => {
      if (fail) throw new TypeError("Failed to fetch");
      return { status: "READY", ref: "t1" };
    });
    const unwatch = vi.fn();
    const rec = new FakeRecorder();
    const take = await Take.begin({ sink, mime: "video/webm", makeRecorder: () => rec, chunkMs: 5000, watchPageHide: () => unwatch });
    take.stop();
    await take.outcome;
    expect(unwatch).not.toHaveBeenCalled();
    fail = false;
    await take.retry();
    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it("a dropped warm-up take stops listening at once", async () => {
    const { sink } = fakeSink();
    const unwatch = vi.fn();
    const take = await Take.begin({ sink, mime: "video/webm", makeRecorder: () => new FakeRecorder(), chunkMs: 5000, watchPageHide: () => unwatch });
    take.discard();
    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it("stops listening for the page going away once the server gave the take back (NO_PARTS): nothing is left to keep (Task 14 carry)", async () => {
    const { sink, opened } = fakeSink(async () => Promise.reject(Object.assign(new Error("no parts"), { code: "NO_PARTS", status: 409 })));
    let handler: (() => void) | null = null;
    const unwatch = vi.fn(() => {
      handler = null;
    });
    const rec = new FakeRecorder();
    const take = await Take.begin({
      sink,
      mime: "video/webm",
      makeRecorder: () => rec,
      chunkMs: 5000,
      watchPageHide: (h) => {
        handler = h;
        return unwatch;
      },
    });
    take.stop();
    await expect(take.outcome).resolves.toMatchObject({ ok: false });
    expect(unwatch).toHaveBeenCalledTimes(1);
    expect(handler).toBeNull();
    expect(opened.abandon).not.toHaveBeenCalled();
  });

  it("the warm-up's take is dropped when its page is left: nothing finished, later chunks not kept", async () => {
    const { sink, opened, pushed } = fakeSink();
    const rec = new FakeRecorder();
    const take = await Take.begin({ sink, mime: "video/webm", makeRecorder: () => rec, chunkMs: 5000 });
    rec.emit("a");
    take.discard();
    expect(rec.state).toBe("inactive");
    expect(opened.finish).not.toHaveBeenCalled();
    expect(opened.abandon).toHaveBeenCalledTimes(1);
    await expect(take.outcome).resolves.toMatchObject({ ok: false });
    await Promise.resolve();
    expect(pushed).toEqual(["a"]);
  });

  it("a sink that cannot open starts no recorder", async () => {
    const make = vi.fn(() => new FakeRecorder());
    const sink: RecordingSink = { open: () => Promise.reject(Object.assign(new Error("x"), { code: "TAKES_EXHAUSTED", status: 409 })) };
    await expect(Take.begin({ sink, mime: "video/webm", makeRecorder: make, chunkMs: 5000 })).rejects.toMatchObject({ code: "TAKES_EXHAUSTED" });
    expect(make).not.toHaveBeenCalled();
  });

  it("a recorder that cannot be made gives the opened take back", async () => {
    const { sink, opened } = fakeSink();
    await expect(
      Take.begin({
        sink,
        mime: "video/webm",
        makeRecorder: () => {
          throw new Error("NotSupportedError");
        },
        chunkMs: 5000,
      }),
    ).rejects.toThrow();
    expect(opened.abandon).toHaveBeenCalledWith(0);
  });
});

describe("takes and failures", () => {
  it("counts the retakes left: the first take is not a retake; unlimited stays unlimited", () => {
    expect(retakesLeft(2, 0)).toBe(1);
    expect(retakesLeft(2, 1)).toBe(1);
    expect(retakesLeft(2, 2)).toBe(0);
    expect(retakesLeft(1, 0)).toBe(0);
    expect(retakesLeft(3, 5)).toBe(0);
    expect(retakesLeft(Number.POSITIVE_INFINITY, 9)).toBe(Number.POSITIVE_INFINITY);
  });

  it("names why a take could not start", () => {
    expect(startFailure(Object.assign(new Error("x"), { code: "TAKES_EXHAUSTED", status: 409 }))).toBe("noTakes");
    expect(startFailure(Object.assign(new Error("Süre doldu."), { code: "STAGE_EXPIRED", status: 409 }))).toBe("server");
    expect(startFailure(new TypeError("Failed to fetch"))).toBe("failed");
  });

  it("no takes left on the server: the screen counts every take as used, so it offers no new one (fix round 1, Minor 6)", () => {
    const exhausted = Object.assign(new Error("x"), { code: "TAKES_EXHAUSTED", status: 409 });
    expect(usedAfterStartFailure(exhausted, 1, 2)).toBe(2);
    expect(usedAfterStartFailure(new TypeError("Failed to fetch"), 1, 2)).toBe(1);
    const used = usedAfterStartFailure(exhausted, 1, 2);
    expect(canTryAgain({ canRetryFinish: false, maxTakes: 2, used })).toBe(false);
    expect(canTryAgain({ canRetryFinish: false, maxTakes: 2, used: 1 })).toBe(true);
    expect(canTryAgain({ canRetryFinish: true, maxTakes: 2, used: 2 })).toBe(true);
    expect(canTryAgain({ canRetryFinish: false, maxTakes: Number.POSITIVE_INFINITY, used: 9 })).toBe(true);
  });

  it("after the last take was used up, 'Bu cevabı kullan' shows the take it will use, when this screen knows it (Task 14 carry)", () => {
    expect(afterExhausted({ lastRef: "take-2" })).toEqual({ phase: "review", ref: "take-2" });
    expect(afterExhausted({ lastRef: null })).toEqual({ phase: "failed" });
  });

  it("tells a finish worth trying again from a take the server gave back", () => {
    expect(finishFailure(new TypeError("Failed to fetch"))).toBe("retry");
    expect(finishFailure(Object.assign(new Error("x"), { code: "UNAVAILABLE", status: 503 }))).toBe("retry");
    expect(finishFailure(Object.assign(new Error("x"), { code: "NO_PARTS", status: 409 }))).toBe("givenBack");
    expect(finishFailure(Object.assign(new Error("x"), { code: "UPLOAD_NOT_FOUND", status: 400 }))).toBe("givenBack");
  });
});

describe("a take holds the page while it runs (Task 5 fix round 2)", () => {
  it("holds in record and saving, in the answer and in the warm-up, so a language switch cannot cut it", () => {
    for (const phase of ["record", "saving"] as const) expect(takeHoldsCapture(phase, false), phase).toBe(true);
  });

  it("lets go once the take is settled, and never while the candidate writes the text alternative", () => {
    for (const phase of ["review", "saved", "failed"] as const) expect(takeHoldsCapture(phase, false), phase).toBe(false);
    expect(takeHoldsCapture("record", true)).toBe(false);
  });

  it("does not hold in the think time: nothing records yet, so the language link stays live (final wave A-I2)", () => {
    expect(takeHoldsCapture("think", false)).toBe(false);
    expect(takeHoldsCapture("think", false, false)).toBe(false);
  });

  it("holds while a take starts, until the take is open (a retake's counted round trip), from any phase (final wave A-I2)", () => {
    for (const phase of ["think", "review", "failed", "saved"] as const) expect(takeHoldsCapture(phase, false, true), phase).toBe(true);
  });
});
