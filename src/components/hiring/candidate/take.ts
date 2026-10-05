import type { OpenTake, RecordingResult, RecordingSink, TakeProgress } from "./recording-sink";
import { isRetryable } from "./save-queue";

/**
 * One take without React, so the ways a recording can end are unit tested
 * (ruling 3: a lost recording is the worst failure). The sink is opened
 * before the recorder starts (the server counts the take first), every chunk
 * goes to the sink as it comes, and the take ends in exactly one of these:
 *
 * - stopped (the candidate, the answer clock, the stage clock, a recorder
 *   error or leaving the question): the sink finishes it with its length;
 * - the page going away: the sink keeps what landed (abandon), once; the
 *   take listens for that from its start until it is finished, also after
 *   the screen that started it is gone (`watchPageHide`);
 * - the warm-up left: dropped, nothing finished.
 *
 * A finish that fails is never thrown: `outcome` says it, and `retry()`
 * finishes again (the parts already sent stay where they are).
 */

/** The part of MediaRecorder a take uses. */
export interface RecorderLike {
  readonly state: "inactive" | "recording" | "paused";
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}

export type TakeOutcome = { ok: true; result: RecordingResult } | { ok: false; error: unknown };

export class Take {
  private durationMs: number | null = null;
  private settled = false;
  private dropped = false;
  private hidden = false;
  private current: Promise<TakeOutcome>;
  private readonly startedAt: number;
  private unwatch: (() => void) | null = null;

  private constructor(
    private readonly opened: OpenTake,
    private readonly recorder: RecorderLike,
    private readonly now: () => number,
    chunkMs: number,
    watchPageHide?: (onHide: () => void) => () => void,
  ) {
    this.unwatch = watchPageHide?.(() => this.hide()) ?? null;
    recorder.ondataavailable = (e) => {
      if (!this.dropped && e.data.size > 0) opened.push(e.data);
    };
    // A recorder error (a device gone, an encoder failure) ends the take with what it has.
    recorder.onerror = () => this.stop();
    this.current = new Promise<TakeOutcome>((resolve) => {
      recorder.onstop = () => {
        if (this.dropped) return resolve({ ok: false, error: new Error("dropped") });
        this.durationMs = this.now() - this.startedAt;
        resolve(this.finish());
      };
    });
    recorder.start(chunkMs);
    this.startedAt = now();
  }

  /** Opens the take on the sink, then starts recording. Nothing records when the sink refuses. */
  static async begin(input: {
    sink: RecordingSink;
    mime: string;
    makeRecorder(): RecorderLike;
    chunkMs: number;
    now?: () => number;
    onProgress?: (p: TakeProgress) => void;
    /** Registers `onHide` for the page going away (pagehide); returns its removal. */
    watchPageHide?: (onHide: () => void) => () => void;
  }): Promise<Take> {
    const opened = await input.sink.open(input.mime, input.onProgress);
    let recorder: RecorderLike;
    try {
      recorder = input.makeRecorder();
    } catch (err) {
      // The server counted a take that will never have a byte: given back (no parts).
      opened.abandon(0);
      throw err;
    }
    return new Take(opened, recorder, input.now ?? Date.now, input.chunkMs, input.watchPageHide);
  }

  get recording(): boolean {
    return this.recorder.state !== "inactive";
  }

  /** Settles when the take is finished (or could not be): never rejects. */
  get outcome(): Promise<TakeOutcome> {
    return this.current;
  }

  /** Ends the recording; the finish follows the recorder's last chunk. */
  stop(): void {
    if (this.recorder.state !== "inactive") this.recorder.stop();
  }

  /** After a failed finish: finish again with the same length. */
  retry(): Promise<TakeOutcome> {
    if (this.settled || this.dropped || this.durationMs === null) return this.current;
    this.current = this.finish();
    return this.current;
  }

  /** The page is going away (pagehide): keep what landed, unless the take is already finished. */
  hide(): void {
    if (this.settled || this.dropped || this.hidden) return;
    this.hidden = true;
    // Still recording (or stopped before the recorder's last chunk came): the take is cut.
    const cut = this.recording || this.durationMs === null;
    this.opened.abandon(this.durationMs ?? this.now() - this.startedAt, cut);
  }

  /** The warm-up's page is left: nothing is kept or finished. */
  discard(): void {
    if (this.dropped) return;
    this.dropped = true;
    this.stopWatching();
    this.recorder.ondataavailable = null;
    this.stop();
    this.opened.abandon(0);
  }

  private stopWatching() {
    this.unwatch?.();
    this.unwatch = null;
  }

  private finish(): Promise<TakeOutcome> {
    return this.opened.finish(this.durationMs ?? 0).then(
      (result): TakeOutcome => {
        this.settled = true;
        this.stopWatching();
        return { ok: true, result };
      },
      (error: unknown): TakeOutcome => ({ ok: false, error }),
    );
  }
}

/** Takes the screen counts after a start failed: TAKES_EXHAUSTED means the server holds them all (fix round 1, Minor 6). */
export function usedAfterStartFailure(err: unknown, used: number, maxTakes: number): number {
  return startFailure(err) === "noTakes" && Number.isFinite(maxTakes) ? Math.max(used, maxTakes) : used;
}

/** Whether the failure screen offers "Tekrar dene": the same take's finish again, or a new take while one is left. */
export function canTryAgain(input: { canRetryFinish: boolean; maxTakes: number; used: number }): boolean {
  return input.canRetryFinish || !Number.isFinite(input.maxTakes) || input.used < input.maxTakes;
}

/** Retakes left after `used` takes; the first take is not a retake (HIRING-UX 6.6 "1 hakkın kaldı"). */
export function retakesLeft(maxTakes: number, used: number): number {
  if (!Number.isFinite(maxTakes)) return Number.POSITIVE_INFINITY;
  return Math.max(0, maxTakes - Math.max(used, 1));
}

const codeOf = (err: unknown) => (err && typeof err === "object" && typeof (err as { code?: unknown }).code === "string" ? (err as { code: string }).code : "");
const statusOf = (err: unknown) => (err && typeof err === "object" && typeof (err as { status?: unknown }).status === "number" ? (err as { status: number }).status : null);

/** Why a take could not start: no takes left, a refusal in the server's words, or (a dropped connection) our own words. */
export function startFailure(err: unknown): "noTakes" | "server" | "failed" {
  if (codeOf(err) === "TAKES_EXHAUSTED") return "noTakes";
  return statusOf(err) !== null && codeOf(err) !== "" && codeOf(err) !== "UNKNOWN" ? "server" : "failed";
}

/**
 * A finish that failed: "retry" when the connection is to blame (the take
 * waits in this tab and on the server; finishing again is safe), "givenBack"
 * when the server refused it (NO_PARTS: nothing landed, the take does not count).
 */
export function finishFailure(err: unknown): "retry" | "givenBack" {
  return isRetryable(err) ? "retry" : "givenBack";
}
