/**
 * The narration clips of the tutorial player, one element per step id.
 *
 * The player re-renders on every animation frame. An inline ref callback is a
 * new function on every render, so React detaches it (calls it with null) and
 * attaches the new one each frame; pausing on that null stopped the narration
 * a frame after it started. This registry hands out one stable callback per id,
 * so React only calls it on a real mount or unmount, and it never pauses on
 * detach: the player pauses every clip once, in its unmount cleanup, through
 * `pauseAll`, which also reaches clips that are already detached.
 */

export interface PausableClip {
  pause(): void;
}

export interface ClipRegistry<T extends PausableClip> {
  /** The ref callback for one step id: the same function on every call. */
  ref(id: string): (el: T | null) => void;
  /** The attached clips by id (a detached clip is null). */
  current(): Readonly<Record<string, T | null>>;
  /** Pauses every clip ever attached, attached or not. */
  pauseAll(): void;
}

export function createClipRegistry<T extends PausableClip>(): ClipRegistry<T> {
  const live: Record<string, T | null> = {};
  const seen = new Set<T>();
  const callbacks = new Map<string, (el: T | null) => void>();
  return {
    ref(id) {
      let callback = callbacks.get(id);
      if (!callback) {
        callback = (el) => {
          live[id] = el;
          if (el) seen.add(el);
        };
        callbacks.set(id, callback);
      }
      return callback;
    },
    current: () => live,
    pauseAll() {
      for (const el of seen) el.pause();
    },
  };
}
