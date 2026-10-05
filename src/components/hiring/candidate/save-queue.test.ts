import { describe, expect, it } from "vitest";
import { isRetryable, retryDelay, SaveQueue, type SaveState } from "./save-queue";

/** A queue with a hand-driven clock, timers and network, so every ordering is spelled out. */
function harness() {
  const sent: unknown[] = [];
  const beacons: unknown[] = [];
  const refused: unknown[] = [];
  const states: SaveState[] = [];
  const replies: Array<{ resolve: () => void; reject: (err: unknown) => void }> = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextTimer = 1;
  let now = 1000;
  const queue = new SaveQueue(
    {
      send: (answer) => {
        sent.push(answer);
        return new Promise<void>((resolve, reject) => replies.push({ resolve, reject }));
      },
      beacon: (answer) => void beacons.push(answer),
      now: () => now,
      setTimer: (fn, ms) => {
        const id = nextTimer++;
        timers.set(id, { fn, ms });
        return id;
      },
      clearTimer: (id) => void timers.delete(id),
      onState: (state) => void states.push(state),
      onRefused: (err) => void refused.push(err),
    },
    800,
  );
  const fireTimers = () => {
    const due = [...timers.entries()];
    timers.clear();
    for (const [, t] of due) t.fn();
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { queue, sent, beacons, refused, states, replies, timers, fireTimers, settle, tick: (ms: number) => (now += ms) };
}

const network = Object.assign(new TypeError("Failed to fetch"), {});
const serverDown = Object.assign(new Error("boom"), { code: "UNKNOWN", status: 503 });
const closed = Object.assign(new Error("Bu soru kapandı."), { code: "ACTIVITY_CLOSED", status: 409 });

describe("the autosave queue (HIRING-UX 6.7, ruling 3: no typed text is lost)", () => {
  it("waits for the typing to pause, then sends only the latest draft", async () => {
    const h = harness();
    h.queue.save({ text: "a" });
    h.queue.save({ text: "ab" });
    h.queue.save({ text: "abc" });
    expect(h.sent).toEqual([]);
    // The pause (800 ms), and the longest a draft waits while typing goes on (4 s, Minor 4).
    expect([...h.timers.values()].map((t) => t.ms).sort((x, y) => x - y)).toEqual([800, 4000]);
    h.fireTimers();
    await h.settle();
    expect(h.sent).toEqual([{ text: "abc" }]);
    h.replies[0].resolve();
    await h.settle();
    expect(h.states.at(-1)).toEqual({ status: "saved", savedAt: 1000 });
  });

  it("sends at once when asked (a choice, a blur, the runner's flush) and chains the saves in order", async () => {
    const h = harness();
    h.queue.save({ choiceIds: ["a"] }, true);
    h.queue.save({ choiceIds: ["b"] }, true);
    await h.settle();
    // The second waits for the first: a slow earlier save never lands after a later one.
    expect(h.sent).toEqual([{ choiceIds: ["a"] }]);
    h.replies[0].resolve();
    await h.settle();
    expect(h.sent).toEqual([{ choiceIds: ["a"] }, { choiceIds: ["b"] }]);
  });

  it("keeps a draft whose save failed, says so, and tries again until it lands", async () => {
    const h = harness();
    h.queue.save({ text: "long answer" }, true);
    await h.settle();
    h.replies[0].reject(network);
    await h.settle();
    expect(h.states.at(-1)?.status).toBe("error");
    expect([...h.timers.values()].map((t) => t.ms)).toEqual([retryDelay(1)]);
    h.fireTimers();
    await h.settle();
    expect(h.sent).toEqual([{ text: "long answer" }, { text: "long answer" }]);
    h.replies[1].reject(serverDown);
    await h.settle();
    expect([...h.timers.values()].map((t) => t.ms)).toEqual([retryDelay(2)]);
    h.fireTimers();
    await h.settle();
    h.replies[2].resolve();
    await h.settle();
    expect(h.states.at(-1)?.status).toBe("saved");
    expect(h.timers.size).toBe(0);
  });

  it("never lets a retry of an older draft replace newer typing", async () => {
    const h = harness();
    h.queue.save({ text: "old" }, true);
    await h.settle();
    h.queue.save({ text: "newer" });
    h.replies[0].reject(network);
    await h.settle();
    void h.queue.flush();
    await h.settle();
    expect(h.sent).toEqual([{ text: "old" }, { text: "newer" }]);
    h.replies[1].resolve();
    await h.settle();
    // Nothing older is left to retry.
    expect(h.timers.size).toBe(0);
    expect(h.states.at(-1)?.status).toBe("saved");
  });

  it("lets the runner's flush resend a failed draft at once, and resolves even when it fails again", async () => {
    const h = harness();
    h.queue.save({ text: "x" }, true);
    await h.settle();
    h.replies[0].reject(network);
    await h.settle();
    const flushed = h.queue.flush();
    await h.settle();
    expect(h.sent).toHaveLength(2);
    h.replies[1].reject(network);
    await expect(flushed).resolves.toBeUndefined();
  });

  it("stops on a refusal (the server moved on) and tells the runner, without retrying", async () => {
    const h = harness();
    h.queue.save({ text: "x" }, true);
    await h.settle();
    h.replies[0].reject(closed);
    await h.settle();
    expect(h.states.at(-1)?.status).toBe("refused");
    expect(h.refused).toEqual([closed]);
    expect(h.timers.size).toBe(0);
  });

  it("hands the unsent draft (or the one in flight) to a beacon when the page is hidden, and keeps it", async () => {
    const h = harness();
    h.queue.save({ text: "typed just now" });
    h.queue.hide();
    expect(h.beacons).toEqual([{ text: "typed just now" }]);
    // The draft is still pending: if the page lives on, the normal save still runs.
    h.fireTimers();
    await h.settle();
    expect(h.sent).toEqual([{ text: "typed just now" }]);
    h.queue.hide();
    expect(h.beacons).toEqual([{ text: "typed just now" }, { text: "typed just now" }]);
    h.replies[0].resolve();
    await h.settle();
    h.queue.hide();
    expect(h.beacons).toHaveLength(2);
  });

  it("sends the draft when the question closes, and a beacon if that last save fails", async () => {
    const h = harness();
    h.queue.save({ text: "last words" });
    const closing = h.queue.close();
    await h.settle();
    expect(h.sent).toEqual([{ text: "last words" }]);
    h.replies[0].reject(network);
    await closing;
    await h.settle();
    expect(h.beacons).toEqual([{ text: "last words" }]);
    expect(h.timers.size).toBe(0);
    // A closed question's refusal is not the runner's business any more (it moved on).
    expect(h.refused).toEqual([]);
  });

  it("reopens after a close (React runs effects twice in development)", async () => {
    const h = harness();
    void h.queue.close();
    h.queue.open();
    h.queue.save({ text: "x" }, true);
    await h.settle();
    h.replies[0].reject(network);
    await h.settle();
    expect(h.timers.size).toBe(1);
  });
});

describe("which failures are worth another try", () => {
  it("retries a dropped connection, a server error and a rate limit, never a refusal", () => {
    expect(isRetryable(network)).toBe(true);
    expect(isRetryable(serverDown)).toBe(true);
    expect(isRetryable(Object.assign(new Error("slow down"), { code: "RATE_LIMITED", status: 429 }))).toBe(true);
    expect(isRetryable(closed)).toBe(false);
    expect(isRetryable(Object.assign(new Error("x"), { code: "STAGE_EXPIRED", status: 409 }))).toBe(false);
  });

  it("backs off from 1 s to at most 15 s", () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 15000, 15000, 15000]);
  });
});

describe("the runner's ear for refusals", () => {
  it("tells the listener that is set now, and nobody once it is taken back", async () => {
    const h = harness();
    const heard: string[] = [];
    const off = h.queue.listen(() => void heard.push("first"));
    h.queue.listen(() => void heard.push("second"));
    off();
    h.queue.save({ text: "x" }, true);
    await h.settle();
    h.replies[0].reject(closed);
    await h.settle();
    expect(heard).toEqual(["second"]);
  });
});

describe("typing that never pauses (review Minor 4)", () => {
  it("saves at most 4 s after the first unsaved letter, even while the pauses keep being cut short", async () => {
    const h = harness();
    h.queue.save({ text: "a" });
    const firstMax = [...h.timers.entries()].find(([, t]) => t.ms === 4000)?.[0];
    for (const text of ["ab", "abc", "abcd", "abcde"]) h.queue.save({ text });
    // One 4 s timer from the first letter, never pushed back; one 800 ms pause, the latest.
    expect([...h.timers.entries()].filter(([, t]) => t.ms === 4000).map(([id]) => id)).toEqual([firstMax]);
    expect([...h.timers.values()].filter((t) => t.ms === 800)).toHaveLength(1);
    // The 4 s timer fires (the harness drops a timer when it fires, like the browser).
    const due = h.timers.get(firstMax!)!;
    h.timers.delete(firstMax!);
    due.fn();
    await h.settle();
    expect(h.sent).toEqual([{ text: "abcde" }]);
    h.replies[0].resolve();
    await h.settle();
    // The next letter starts a new 4 s window.
    h.queue.save({ text: "abcdef" });
    expect([...h.timers.values()].filter((t) => t.ms === 4000)).toHaveLength(1);
  });
});

describe("what the server holds now (review: the draft's base)", () => {
  it("tells the saved listener each answer the server accepted, in order, and nothing that failed", async () => {
    const h = harness();
    const saved: unknown[] = [];
    h.queue.listenSaved((answer) => void saved.push(answer));
    h.queue.save({ text: "one" }, true);
    await h.settle();
    h.replies[0].resolve();
    await h.settle();
    h.queue.save({ text: "two" }, true);
    await h.settle();
    h.replies[1].reject(network);
    await h.settle();
    expect(saved).toEqual([{ text: "one" }]);
  });
});

describe("what is on its way (fix round 2: the draft records the sent text)", () => {
  it("tells the sending listener each answer as its save leaves, before the server answers", async () => {
    const h = harness();
    const sending: unknown[] = [];
    h.queue.listenSending((answer) => void sending.push(answer));
    h.queue.save({ text: "AB" }, true);
    await h.settle();
    expect(sending).toEqual([{ text: "AB" }]);
    expect(h.replies).toHaveLength(1);
  });
});
