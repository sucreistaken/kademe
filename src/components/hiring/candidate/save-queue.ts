/**
 * The autosave of one question, without React (so every ordering is unit
 * tested). HIRING-UX 6.7 and ruling 3: no typed text is lost.
 *
 * - Typing is debounced; a choice, a blur and the runner's flush send at once.
 *   Typing that never pauses is still saved at most 4 s after its first
 *   unsaved letter (MAX_WAIT_MS, Task 13 review).
 * - Saves are chained, so a slow earlier draft never lands after a later one.
 * - A save that fails on the way (no connection, a server error, a rate
 *   limit) keeps its draft, says so ("error") and is tried again with a
 *   growing pause; newer typing always wins over the retried draft.
 * - A refusal (the server moved on: a closed question, a closed stage) is not
 *   retried; the runner hears of it and says what happened.
 * - A hidden page hands the unsent draft, or the one still in flight, to a
 *   beacon and keeps it, so a page that lives on still saves it normally.
 * - Closing (the question goes away) sends the last draft; if that fails on
 *   the way, a beacon carries it.
 */

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "refused";
export type SaveState = { status: SaveStatus; savedAt: number | null };

export type SaveDeps = {
  send(answer: unknown): Promise<unknown>;
  beacon(answer: unknown): void;
  now(): number;
  setTimer(fn: () => void, ms: number): number;
  clearTimer(id: number): void;
  onState(state: SaveState): void;
  onRefused(err: unknown): void;
};

/** A dropped connection (no status), a server error, a timeout or a rate limit: worth another try. */
export function isRetryable(err: unknown): boolean {
  const status = err && typeof err === "object" ? (err as { status?: unknown }).status : undefined;
  if (typeof status !== "number") return true;
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** The longest a typed draft waits for a pause before it is sent anyway. */
export const MAX_WAIT_MS = 4000;

/** 1 s, 2 s, 4 s, 8 s, then every 15 s. */
export const retryDelay = (failures: number) => Math.min(15_000, 1000 * 2 ** Math.max(0, failures - 1));

export class SaveQueue {
  private pending: unknown = undefined;
  private inFlight: unknown = undefined;
  private queued = 0;
  private debounce: number | null = null;
  private maxWait: number | null = null;
  private retry: number | null = null;
  private failures = 0;
  private chain: Promise<void> = Promise.resolve();
  private closed = false;
  private savedAt: number | null = null;
  private refusedListener: ((err: unknown) => void) | undefined = undefined;
  private savedListener: ((answer: unknown) => void) | undefined = undefined;

  constructor(
    private readonly deps: SaveDeps,
    private readonly delayMs = 800,
  ) {}

  /** A new draft. `immediate` skips the typing pause. */
  save = (answer: unknown, immediate = false): void => {
    this.pending = answer;
    this.clearPause();
    if (immediate) {
      void this.flush();
      return;
    }
    this.debounce = this.deps.setTimer(() => {
      this.debounce = null;
      void this.flush();
    }, this.delayMs);
    // Set by the first unsaved letter and never pushed back by the next ones.
    if (this.maxWait === null)
      this.maxWait = this.deps.setTimer(() => {
        this.maxWait = null;
        void this.flush();
      }, MAX_WAIT_MS);
  };

  /** Sends the pending draft now. Resolves when every save so far has settled; never rejects. */
  flush = (): Promise<void> => {
    this.clearDebounce();
    this.clearRetry();
    const answer = this.pending;
    if (answer === undefined) return this.chain;
    this.pending = undefined;
    this.queued += 1;
    this.state("saving");
    this.chain = this.chain.then(async () => {
      this.inFlight = answer;
      try {
        await this.deps.send(answer);
        this.queued -= 1;
        this.inFlight = undefined;
        this.failures = 0;
        this.savedAt = this.deps.now();
        this.savedListener?.(answer);
        this.state(this.queued === 0 && this.pending === undefined ? "saved" : "saving");
      } catch (err) {
        this.queued -= 1;
        this.inFlight = undefined;
        if (!isRetryable(err)) {
          if (!this.closed) {
            this.state("refused");
            this.deps.onRefused(err);
            this.refusedListener?.(err);
          }
          return;
        }
        // Newer typing wins; otherwise this draft waits for the next try.
        if (this.pending === undefined) this.pending = answer;
        this.failures += 1;
        if (this.closed) {
          this.deps.beacon(this.pending);
          return;
        }
        this.state("error");
        this.retry = this.deps.setTimer(() => {
          this.retry = null;
          void this.flush();
        }, retryDelay(this.failures));
      }
    });
    return this.chain;
  };

  /** The page is being hidden (pagehide, visibilitychange): a beacon carries what is not saved yet. */
  hide = (): void => {
    const unsaved = this.pending !== undefined ? this.pending : this.inFlight;
    if (unsaved !== undefined) this.deps.beacon(unsaved);
  };

  /** The question goes away: no more retries, the last draft is sent (a beacon if that fails). */
  close = (): Promise<void> => {
    this.closed = true;
    return this.flush();
  };

  /** Who else hears of a refusal (the runner, whose handler changes with its state). Returns the undo. */
  listen = (listener: ((err: unknown) => void) | undefined): (() => void) => {
    this.refusedListener = listener;
    return () => {
      if (this.refusedListener === listener) this.refusedListener = undefined;
    };
  };

  /** Who hears of each answer the server accepted (the text field keeps its draft's base with it). Returns the undo. */
  listenSaved = (listener: ((answer: unknown) => void) | undefined): (() => void) => {
    this.savedListener = listener;
    return () => {
      if (this.savedListener === listener) this.savedListener = undefined;
    };
  };

  /** Undoes close (React runs an effect's cleanup and setup again in development). */
  open = (): void => {
    this.closed = false;
  };

  private state(status: SaveStatus) {
    if (!this.closed) this.deps.onState({ status, savedAt: this.savedAt });
  }

  private clearPause() {
    if (this.debounce !== null) this.deps.clearTimer(this.debounce);
    this.debounce = null;
  }

  private clearDebounce() {
    this.clearPause();
    if (this.maxWait !== null) this.deps.clearTimer(this.maxWait);
    this.maxWait = null;
  }

  private clearRetry() {
    if (this.retry !== null) this.deps.clearTimer(this.retry);
    this.retry = null;
  }
}
