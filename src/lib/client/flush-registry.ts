/**
 * Who still has a save in flight when the stage is submitted.
 *
 * Text answers save on an 800 ms debounce. A candidate who types the last
 * word and clicks "submit" inside that window used to race their own draft:
 * `/stage/submit` could land before `/response` did, and the stage closed
 * without the sentence they had just written. Every autosave registers a
 * `flush()` here, and the submit awaits them all before it posts.
 *
 * Pure class, no React, so the ordering rules can be unit tested. The React
 * side is a context in `activities/shared.tsx`.
 */

export type Flush = () => Promise<void>;

export class FlushRegistry {
  private readonly flushers = new Map<string, Flush>();
  /**
   * Flushes fired by an activity that unmounted (the candidate moved to the
   * next question) and whose request has not settled yet. They are kept until
   * they settle so a submit right after "next question" still waits for them.
   */
  private readonly trailing = new Set<Promise<void>>();

  /** Registers a flusher under a key. Returns the matching unregister. */
  register(key: string, flush: Flush): () => void {
    this.flushers.set(key, flush);
    return () => {
      if (this.flushers.get(key) !== flush) return;
      this.flushers.delete(key);
      const settled = flush().catch(() => undefined);
      this.trailing.add(settled);
      void settled.finally(() => this.trailing.delete(settled));
    };
  }

  /** Resolves once nothing registered here has a save pending. Never rejects. */
  async flushAll(): Promise<void> {
    const live = [...this.flushers.values()].map((flush) =>
      flush().catch(() => undefined),
    );
    await Promise.all([...live, ...this.trailing]);
  }

  get size() {
    return this.flushers.size;
  }
}
