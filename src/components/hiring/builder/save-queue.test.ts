import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSaveQueue, type SaveEntry, type SaverState, type SaveTarget } from "./save-queue";

/**
 * The builder's autosave (carry 7): debounced, last write wins per field, one
 * request per stage or question with every changed field, strictly one at a
 * time and before any structural change (so a reorder never overtakes typed
 * text), "Kaydedildi" with the server's time, one automatic retry and a
 * manual one after a failure, refusals not retried, and every unsaved value
 * kept in storage until the server has it, so a reload loses nothing.
 */
type Call = { target: SaveTarget; patch: Record<string, unknown> };
let calls: Call[];
let states: SaverState[];
let answer: (call: Call) => Promise<{ ok: true; value: unknown; at: string } | { ok: false; code: "INVALID"; fields?: string[] }>;
let stored: SaveEntry[];

const stage = (id: string): SaveTarget => ({ kind: "stage", id });
const activity = (id: string): SaveTarget => ({ kind: "activity", id });

function queue() {
  return createSaveQueue({
    send: (target, patch) => {
      const call = { target, patch };
      calls.push(call);
      return answer(call);
    },
    onState: (s) => states.push(s),
    storage: { load: () => stored, save: (entries) => (stored = entries) },
    debounceMs: 500,
    maxWaitMs: 3000,
    retryMs: 3000,
  });
}
const last = () => states[states.length - 1];

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  states = [];
  stored = [];
  answer = async () => ({ ok: true, value: null, at: "2026-10-04T11:02:00.000Z" });
});
afterEach(() => vi.useRealTimers());

describe("save queue", () => {
  it("waits for a pause in typing and sends only the last value of a field", async () => {
    const q = queue();
    q.edit(stage("s1"), "name", { tr: "A", en: "" });
    await vi.advanceTimersByTimeAsync(300);
    q.edit(stage("s1"), "name", { tr: "Ab", en: "" });
    await vi.advanceTimersByTimeAsync(300);
    q.edit(stage("s1"), "name", { tr: "Abc", en: "" });
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toEqual([{ target: stage("s1"), patch: { name: { tr: "Abc", en: "" } } }]);
    expect(last()).toEqual({ kind: "saved", at: "2026-10-04T11:02:00.000Z" });
  });

  it("saves at least every maxWait while typing never pauses", async () => {
    const q = queue();
    for (let i = 0; i < 16; i += 1) {
      q.edit(stage("s1"), "description", { tr: "x".repeat(i + 1), en: "" });
      await vi.advanceTimersByTimeAsync(200);
    }
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it("sends one request per stage or question with every changed field", async () => {
    const q = queue();
    q.edit(activity("a1"), "prompt", { tr: "Soru", en: "" });
    q.edit(activity("a1"), "required", false);
    q.edit(stage("s1"), "durationSeconds", 600);
    await q.flush();
    expect(calls).toEqual([
      { target: activity("a1"), patch: { prompt: { tr: "Soru", en: "" }, required: false } },
      { target: stage("s1"), patch: { durationSeconds: 600 } },
    ]);
  });

  it("sends typed text before a structural change, one request at a time", async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    answer = (call) =>
      new Promise((resolve) => {
        order.push(`start ${call.target.id}`);
        release = () => {
          order.push(`end ${call.target.id}`);
          resolve({ ok: true, value: null, at: "2026-10-04T11:02:00.000Z" });
        };
      });
    const q = queue();
    q.edit(activity("a1"), "prompt", { tr: "Yazılan", en: "" });
    const move = q.run(async () => {
      order.push("move");
      return { ok: true as const, value: null, at: "2026-10-04T11:03:00.000Z" };
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(["start a1"]);
    release();
    await move;
    expect(order).toEqual(["start a1", "end a1", "move"]);
    expect(last()).toEqual({ kind: "saved", at: "2026-10-04T11:03:00.000Z" });
  });

  it("keeps a newer value typed while the older one was on its way", async () => {
    let release: () => void = () => undefined;
    answer = () => new Promise((resolve) => (release = () => resolve({ ok: true, value: null, at: "2026-10-04T11:02:00.000Z" })));
    const q = queue();
    q.edit(stage("s1"), "name", { tr: "Bir", en: "" });
    const first = q.flush();
    await vi.advanceTimersByTimeAsync(0);
    q.edit(stage("s1"), "name", { tr: "Birinci", en: "" });
    release();
    await first;
    expect(stored.map((e) => e.value)).toEqual([{ tr: "Birinci", en: "" }]);
    answer = async () => ({ ok: true, value: null, at: "2026-10-04T11:02:30.000Z" });
    await q.flush();
    expect(calls.map((c) => c.patch)).toEqual([{ name: { tr: "Bir", en: "" } }, { name: { tr: "Birinci", en: "" } }]);
    expect(stored).toEqual([]);
  });

  it("keeps a failed value, retries once by itself after 3 s, then waits for 'Tekrar dene'", async () => {
    answer = async () => {
      throw new Error("offline");
    };
    const q = queue();
    q.edit(activity("a1"), "prompt", { tr: "Uzun bir cevap", en: "" });
    await q.flush();
    expect(last()).toEqual({ kind: "error", retrying: true });
    expect(stored.map((e) => e.value)).toEqual([{ tr: "Uzun bir cevap", en: "" }]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(calls).toHaveLength(2);
    expect(last()).toEqual({ kind: "error", retrying: false });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(2);
    answer = async () => ({ ok: true, value: null, at: "2026-10-04T11:05:00.000Z" });
    await q.retry();
    expect(calls).toHaveLength(3);
    expect(calls[2].patch).toEqual({ prompt: { tr: "Uzun bir cevap", en: "" } });
    expect(last()).toEqual({ kind: "saved", at: "2026-10-04T11:05:00.000Z" });
    expect(stored).toEqual([]);
  });

  it("lets a newer value replace a failed one", async () => {
    answer = async () => {
      throw new Error("offline");
    };
    const q = queue();
    q.edit(stage("s1"), "name", { tr: "Eski", en: "" });
    await q.flush();
    q.edit(stage("s1"), "name", { tr: "Yeni", en: "" });
    answer = async () => ({ ok: true, value: null, at: "2026-10-04T11:06:00.000Z" });
    await q.flush();
    expect(calls[calls.length - 1].patch).toEqual({ name: { tr: "Yeni", en: "" } });
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls.filter((c) => (c.patch.name as { tr: string }).tr === "Eski")).toHaveLength(1);
    expect(stored).toEqual([]);
  });

  it("never sends an older failed value after a newer one typed while it was on its way", async () => {
    let fail: () => void = () => undefined;
    answer = () => new Promise((_resolve, reject) => (fail = () => reject(new Error("offline"))));
    const q = queue();
    q.edit(stage("s1"), "name", { tr: "Eski", en: "" });
    const first = q.flush();
    await vi.advanceTimersByTimeAsync(0);
    q.edit(stage("s1"), "name", { tr: "Yeni", en: "" });
    fail();
    await first;
    answer = async () => ({ ok: true, value: null, at: "2026-10-04T11:07:00.000Z" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls.map((c) => (c.patch.name as { tr: string }).tr)).toEqual(["Eski", "Yeni"]);
    expect(stored).toEqual([]);
  });

  it("does not retry a value the server refused, and names the field", async () => {
    answer = async () => ({ ok: false, code: "INVALID", fields: ["answerSeconds"] });
    const q = queue();
    q.edit(activity("a1"), "answerSeconds", 5);
    await q.flush();
    expect(last()).toEqual({ kind: "refused", code: "INVALID", fields: ["answerSeconds"], targetId: "a1" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(1);
    expect(stored).toEqual([]);
  });

  it("answers a structural change that could not reach the server as a failure, without repeating it", async () => {
    const q = queue();
    const op = vi.fn(async () => {
      throw new Error("offline");
    });
    const result = await q.run(op);
    expect(result).toEqual({ ok: false, code: "NETWORK" });
    expect(last()).toEqual({ kind: "error", retrying: false });
    await vi.advanceTimersByTimeAsync(5000);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("replays values a reload left unsaved", async () => {
    stored = [{ target: activity("a1"), field: "prompt", value: { tr: "Yarım kalan", en: "" } }];
    const q = queue();
    const first = q.replay();
    // Returned before the server answers, so the screen can show the value at once.
    expect(first.entries).toEqual([{ target: activity("a1"), field: "prompt", value: { tr: "Yarım kalan", en: "" } }]);
    await first.done;
    expect(calls).toEqual([{ target: activity("a1"), patch: { prompt: { tr: "Yarım kalan", en: "" } } }]);
    expect(stored).toEqual([]);
    expect(q.replay().entries).toEqual([]);
  });

  it("stores every value the moment it is typed", () => {
    const q = queue();
    q.edit(stage("s1"), "name", { tr: "A", en: "" });
    expect(stored).toEqual([{ target: stage("s1"), field: "name", value: { tr: "A", en: "" } }]);
    expect(q.unsaved()).toBe(true);
  });
});
