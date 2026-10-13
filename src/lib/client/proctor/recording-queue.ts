import type { SegmentMeta } from "@/lib/proctor/recording-rules";

/**
 * The upload line for recording segments. No DOM, so it is tested on its own.
 *
 * One segment is in flight at a time and they leave in the order they were
 * recorded. A segment that fails for a reason that can pass (no connection, a
 * timeout, a busy or broken server) is tried again with a growing pause, so a
 * dropped connection just makes the line longer until it comes back. A
 * segment the server refuses for good (the attempt is closed, the body is
 * invalid) is dropped and the line moves on.
 *
 * The line is bounded in bytes. When it is full the oldest waiting segment is
 * dropped: what matters most when the candidate comes back is what happened
 * most recently. The gap shows up in the panel as a stretch with no recording.
 */

export type QueuedSegment = SegmentMeta & { mime: string; blob: Blob };

/** What one try of a segment came to. */
export type SendOutcome = "ok" | "retry" | "drop";

export type QueueStatus = {
  pending: number;
  pendingBytes: number;
  uploaded: number;
  dropped: number;
  /** The last try failed and the segment at the head is waiting for another. */
  stalled: boolean;
};

export type QueueOptions = {
  send: (segment: QueuedSegment) => Promise<SendOutcome>;
  /** Default 48 MiB: about ten minutes of camera plus screen at the target bitrates. */
  maxBytes?: number;
  /** Tries of one segment before it is given up. Default 60 (about a quarter of an hour). */
  maxAttempts?: number;
  /** Pause before try `attempt + 1`. Default 1, 2, 4, 8, then every 15 seconds. */
  delayMs?: (attempt: number) => number;
  wait?: (ms: number) => Promise<void>;
  onStatus?: (status: QueueStatus) => void;
};

export const DEFAULT_QUEUE_BYTES = 48 * 1024 * 1024;

const defaultDelay = (attempt: number) => Math.min(15_000, 1000 * 2 ** (attempt - 1));
const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class SegmentQueue {
  private items: QueuedSegment[] = [];
  private bytes = 0;
  private running = false;
  private inFlight: QueuedSegment | null = null;
  private stalled = false;
  private uploaded = 0;
  private dropped = 0;
  private idle: Array<() => void> = [];
  private readonly opts: Required<Omit<QueueOptions, "onStatus">> & Pick<QueueOptions, "onStatus">;

  constructor(options: QueueOptions) {
    this.opts = {
      send: options.send,
      maxBytes: options.maxBytes ?? DEFAULT_QUEUE_BYTES,
      maxAttempts: options.maxAttempts ?? 60,
      delayMs: options.delayMs ?? defaultDelay,
      wait: options.wait ?? defaultWait,
      onStatus: options.onStatus,
    };
  }

  get status(): QueueStatus {
    return {
      pending: this.items.length,
      pendingBytes: this.bytes,
      uploaded: this.uploaded,
      dropped: this.dropped,
      stalled: this.stalled,
    };
  }

  push(segment: QueuedSegment) {
    if (segment.blob.size === 0) return;
    this.items.push(segment);
    this.bytes += segment.blob.size;
    // Over the limit: drop the oldest segment that is not being sent right now.
    while (this.bytes > this.opts.maxBytes) {
      const victim = this.items.findIndex((s) => s !== this.inFlight);
      if (victim < 0 || this.items[victim] === segment) break;
      this.remove(victim);
      this.dropped++;
    }
    this.report();
    void this.run();
  }

  /** Resolves true once nothing is waiting, or false when `timeoutMs` passes first. */
  drain(timeoutMs: number): Promise<boolean> {
    if (this.items.length === 0) return Promise.resolve(true);
    return new Promise((resolve) => {
      let settled = false;
      const done = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      this.idle.push(() => done(true));
      setTimeout(() => done(false), timeoutMs);
    });
  }

  private remove(index: number) {
    const [gone] = this.items.splice(index, 1);
    if (gone) this.bytes -= gone.blob.size;
  }

  private report() {
    this.opts.onStatus?.(this.status);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.items.length > 0) {
        const segment = this.items[0];
        this.inFlight = segment;
        let outcome: SendOutcome = "retry";
        for (let attempt = 1; attempt <= this.opts.maxAttempts; attempt++) {
          try {
            outcome = await this.opts.send(segment);
          } catch {
            outcome = "retry";
          }
          if (outcome !== "retry") break;
          this.stalled = true;
          this.report();
          if (attempt < this.opts.maxAttempts) await this.opts.wait(this.opts.delayMs(attempt));
        }
        this.inFlight = null;
        // The segment may have been evicted while it was retried; it was still at the head.
        const index = this.items.indexOf(segment);
        if (index >= 0) this.remove(index);
        if (outcome === "ok") {
          this.uploaded++;
          this.stalled = false;
        } else {
          this.dropped++;
          // A refusal is an answer: the line is moving. Tries running out is not.
          if (outcome === "drop") this.stalled = false;
        }
        this.report();
      }
    } finally {
      this.running = false;
      this.inFlight = null;
      const waiting = this.idle;
      this.idle = [];
      for (const fn of waiting) fn();
    }
  }
}
