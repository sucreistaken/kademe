import { describe, expect, it, vi } from "vitest";
import { SegmentQueue, type QueuedSegment, type SendOutcome } from "./recording-queue";

const segment = (sequence: number, bytes = 10, kind: "CAMERA" | "SCREEN" = "CAMERA"): QueuedSegment => ({
  kind,
  runId: "run-0001",
  sequence,
  startedAt: 1000 + sequence * 15_000,
  durationMs: 15_000,
  mime: "video/webm",
  blob: new Blob([new Uint8Array(bytes)]),
});

/** A sender whose answers the test scripts, recording what reached it and in what order. */
function scripted(answer: (s: QueuedSegment, attempt: number) => SendOutcome | Promise<SendOutcome>) {
  const sent: string[] = [];
  const tries = new Map<string, number>();
  let inFlight = 0;
  let maxInFlight = 0;
  const send = async (s: QueuedSegment) => {
    const id = `${s.kind}:${s.sequence}`;
    const n = (tries.get(id) ?? 0) + 1;
    tries.set(id, n);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await Promise.resolve();
    const out = await answer(s, n);
    inFlight--;
    if (out === "ok") sent.push(id);
    return out;
  };
  return { send, sent, tries, maxInFlight: () => maxInFlight };
}

const noWait = () => Promise.resolve();

describe("SegmentQueue", () => {
  it("uploads in recording order, one at a time", async () => {
    const s = scripted(() => "ok");
    const q = new SegmentQueue({ send: s.send, wait: noWait });
    q.push(segment(0));
    q.push(segment(0, 10, "SCREEN"));
    q.push(segment(1));
    q.push(segment(2));
    expect(await q.drain(1000)).toBe(true);
    expect(s.sent).toEqual(["CAMERA:0", "SCREEN:0", "CAMERA:1", "CAMERA:2"]);
    expect(s.maxInFlight()).toBe(1);
    expect(q.status).toMatchObject({ pending: 0, pendingBytes: 0, uploaded: 4, dropped: 0, stalled: false });
  });

  it("holds the line through an outage and keeps the order when the connection comes back", async () => {
    let online = false;
    const s = scripted(() => (online ? "ok" : "retry"));
    const waits: number[] = [];
    const q = new SegmentQueue({
      send: s.send,
      wait: async (ms) => {
        waits.push(ms);
        // The connection returns after the fifth pause.
        if (waits.length === 5) online = true;
      },
    });
    q.push(segment(0));
    q.push(segment(1));
    expect(await q.drain(1000)).toBe(true);
    expect(s.sent).toEqual(["CAMERA:0", "CAMERA:1"]);
    expect(s.tries.get("CAMERA:0")).toBe(6);
    expect(s.tries.get("CAMERA:1")).toBe(1);
    // Growing pauses, capped.
    expect(waits).toEqual([1000, 2000, 4000, 8000, 15_000]);
  });

  it("drops a segment the server refuses for good and goes on with the next", async () => {
    const s = scripted((seg) => (seg.sequence === 0 ? "drop" : "ok"));
    const q = new SegmentQueue({ send: s.send, wait: noWait });
    q.push(segment(0));
    q.push(segment(1));
    await q.drain(1000);
    expect(s.tries.get("CAMERA:0")).toBe(1);
    expect(s.sent).toEqual(["CAMERA:1"]);
    expect(q.status).toMatchObject({ uploaded: 1, dropped: 1, stalled: false });
  });

  it("gives a segment up after maxAttempts, reports the line as stalled, and moves on", async () => {
    const s = scripted((seg) => (seg.sequence === 0 ? "retry" : "ok"));
    const q = new SegmentQueue({ send: s.send, wait: noWait, maxAttempts: 4 });
    q.push(segment(0));
    q.push(segment(1));
    await q.drain(1000);
    expect(s.tries.get("CAMERA:0")).toBe(4);
    expect(s.sent).toEqual(["CAMERA:1"]);
    expect(q.status.dropped).toBe(1);
  });

  it("treats a sender that throws like a failed try", async () => {
    let first = true;
    const q = new SegmentQueue({
      send: async () => {
        if (first) {
          first = false;
          throw new TypeError("Failed to fetch");
        }
        return "ok";
      },
      wait: noWait,
    });
    q.push(segment(0));
    await q.drain(1000);
    expect(q.status).toMatchObject({ uploaded: 1, dropped: 0 });
  });

  it("when full, drops the oldest waiting segment but never the one being sent", async () => {
    let release: (o: SendOutcome) => void = () => undefined;
    const sent: number[] = [];
    const q = new SegmentQueue({
      maxBytes: 30,
      wait: noWait,
      send: (seg) =>
        new Promise<SendOutcome>((resolve) => {
          release = (o) => {
            if (o === "ok") sent.push(seg.sequence);
            resolve(o);
          };
        }),
    });
    q.push(segment(0)); // in flight
    q.push(segment(1));
    q.push(segment(2));
    q.push(segment(3)); // 40 bytes: segment 1 goes
    expect(q.status).toMatchObject({ pending: 3, pendingBytes: 30, dropped: 1 });
    const drained = q.drain(1000);
    for (let i = 0; i < 3; i++) {
      // Let the line reach its next send, then answer it.
      await new Promise((r) => setTimeout(r, 0));
      release("ok");
    }
    expect(await drained).toBe(true);
    expect(sent).toEqual([0, 2, 3]);
  });

  it("drain answers false when the line cannot empty in time", async () => {
    const q = new SegmentQueue({ send: () => new Promise<SendOutcome>(() => undefined), wait: noWait });
    q.push(segment(0));
    expect(await q.drain(20)).toBe(false);
    expect(q.status.pending).toBe(1);
  });

  it("ignores an empty segment", () => {
    const send = vi.fn(async () => "ok" as const);
    const q = new SegmentQueue({ send, wait: noWait });
    q.push({ ...segment(0), blob: new Blob([]) });
    expect(send).not.toHaveBeenCalled();
    expect(q.status.pending).toBe(0);
  });
});
