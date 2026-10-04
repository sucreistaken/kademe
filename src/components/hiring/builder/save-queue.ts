import type { ActionCode } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/result";

/**
 * The builder's autosave, without React so it can be tested on its own
 * (HIRING-UX 5.5 "Kaydedildi 14:02"; carry 7).
 *
 * - A typed value waits for a pause (debounce) but never longer than maxWait;
 *   the last value of a field wins, and one request carries every changed
 *   field of one stage or question.
 * - Requests go one at a time, and a structural change (add, move, delete)
 *   first sends what was typed, so a reorder never overtakes text.
 * - A value that could not reach the server is kept and sent again once after
 *   retryMs by itself, then on "Tekrar dene"; a newer value of the same field
 *   replaces it. A value the server refused (a code) is not sent again.
 * - Every unsaved value is written to `storage` the moment it is typed and
 *   removed once the server has it, so a reload can replay it.
 */
export type SaveTarget = { kind: "stage" | "activity" | "competencies"; id: string };
export type SaveEntry = { target: SaveTarget; field: string; value: unknown };
export type SaveResult = { ok: true; value: unknown; at: string } | { ok: false; code: ActionCode; fields?: string[] };
export type ClientResult<T> = { ok: true; value: T; at: string } | { ok: false; code: ActionCode | "NETWORK"; fields?: string[] };

export type SaverState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "refused"; code: ActionCode; fields: string[]; targetId: string | null }
  /**
   * Something did not reach the server. `retryable`: typed values are kept and
   * "Tekrar dene" sends them again; a structural change (add, move, delete,
   * undo) is never repeated, so the bar offers no retry for it.
   */
  | { kind: "error"; retrying: boolean; retryable: boolean };

export type SaveStorage = { load(): SaveEntry[]; save(entries: SaveEntry[]): void };

const keyOf = (target: SaveTarget, field: string) => `${target.kind}:${target.id}:${field}`;
const targetKey = (target: SaveTarget) => `${target.kind}:${target.id}`;

export function createSaveQueue(options: {
  send: (target: SaveTarget, patch: Record<string, unknown>) => Promise<SaveResult>;
  onState: (state: SaverState) => void;
  storage?: SaveStorage;
  debounceMs?: number;
  maxWaitMs?: number;
  retryMs?: number;
}) {
  const debounceMs = options.debounceMs ?? 600;
  const maxWaitMs = options.maxWaitMs ?? 3000;
  const retryMs = options.retryMs ?? 3000;
  /** Typed and not sent yet. */
  const pending = new Map<string, SaveEntry>();
  /** Sent, answer not back yet. */
  const inflight = new Map<string, SaveEntry>();
  /** Could not reach the server. */
  const failed = new Map<string, SaveEntry>();
  let chain: Promise<unknown> = Promise.resolve();
  let debounce: ReturnType<typeof setTimeout> | null = null;
  let maxWait: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let autoRetried = false;

  /** Every value the server does not have yet, newest per field: waiting, on its way, or failed. */
  function entries(): SaveEntry[] {
    return [...new Map<string, SaveEntry>([...failed, ...inflight, ...pending]).values()];
  }

  function persist() {
    options.storage?.save(entries());
  }

  function clearTimers() {
    if (debounce) clearTimeout(debounce);
    if (maxWait) clearTimeout(maxWait);
    debounce = null;
    maxWait = null;
  }

  /** Queues a job behind every earlier one; a failed job never blocks the next. */
  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const next = chain.then(job, job);
    chain = next.catch(() => undefined);
    return next;
  }

  async function sendPending(): Promise<void> {
    clearTimers();
    if (pending.size === 0) return;
    const groups = new Map<string, SaveEntry[]>();
    for (const [key, entry] of pending) {
      inflight.set(key, entry);
      const group = groups.get(targetKey(entry.target)) ?? [];
      group.push(entry);
      groups.set(targetKey(entry.target), group);
    }
    pending.clear();
    options.onState({ kind: "saving" });
    let outcome: SaverState | null = null;
    for (const entries of groups.values()) {
      const target = entries[0].target;
      const patch = Object.fromEntries(entries.map((e) => [e.field, e.value]));
      let result: SaveResult | null;
      try {
        result = await options.send(target, patch);
      } catch {
        result = null;
      }
      for (const entry of entries) {
        const key = keyOf(entry.target, entry.field);
        if (inflight.get(key) === entry) inflight.delete(key);
        if (result === null) {
          // A newer value of this field is already waiting; it replaces the failed one.
          if (!pending.has(key)) failed.set(key, entry);
        } else if (failed.get(key) === entry) {
          failed.delete(key);
        }
      }
      if (result === null) outcome = { kind: "error", retrying: false, retryable: true };
      else if (!result.ok) {
        if (outcome?.kind !== "error") outcome = { kind: "refused", code: result.code, fields: result.fields ?? [], targetId: target.id };
      } else if (!outcome || outcome.kind === "saved") outcome = { kind: "saved", at: result.at };
    }
    persist();
    if (outcome?.kind === "error") {
      const retrying = !autoRetried;
      options.onState({ kind: "error", retrying, retryable: true });
      if (retrying) {
        autoRetried = true;
        retryTimer = setTimeout(() => void retry(), retryMs);
      }
    } else if (outcome) {
      if (failed.size === 0) autoRetried = false;
      options.onState(outcome);
    }
  }

  function flush(): Promise<void> {
    clearTimers();
    return enqueue(sendPending);
  }

  function edit(target: SaveTarget, field: string, value: unknown) {
    const key = keyOf(target, field);
    failed.delete(key);
    pending.set(key, { target, field, value });
    persist();
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void flush(), debounceMs);
    if (!maxWait) maxWait = setTimeout(() => void flush(), maxWaitMs);
  }

  /** "Tekrar dene": everything that could not reach the server, sent again now. */
  function retry(): Promise<void> {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    for (const [key, entry] of failed) if (!pending.has(key)) pending.set(key, entry);
    failed.clear();
    return flush();
  }

  /**
   * A structural change (add, move, delete, undo): typed values go first, then
   * the change, alone. It is never repeated by itself: a delete that may have
   * happened must not run twice.
   */
  function run<T>(op: () => Promise<{ ok: true; value: T; at: string } | { ok: false; code: ActionCode; fields?: string[] }>): Promise<ClientResult<T>> {
    clearTimers();
    return enqueue(async () => {
      await sendPending();
      options.onState({ kind: "saving" });
      try {
        const result = await op();
        options.onState(result.ok ? { kind: "saved", at: result.at } : { kind: "refused", code: result.code, fields: result.fields ?? [], targetId: null });
        return result;
      } catch {
        options.onState({ kind: "error", retrying: false, retryable: false });
        return { ok: false as const, code: "NETWORK" as const };
      }
    });
  }

  /**
   * What a reload left unsaved: returned at once (so the screen can show it
   * before the server has it) and sent; `done` settles when the send did.
   */
  function replay(): { entries: SaveEntry[]; done: Promise<void> } {
    const entries = options.storage?.load() ?? [];
    if (entries.length === 0) return { entries, done: Promise.resolve() };
    for (const entry of entries) {
      const key = keyOf(entry.target, entry.field);
      if (!pending.has(key)) pending.set(key, entry);
    }
    return { entries, done: flush() };
  }

  return {
    edit,
    flush,
    retry,
    run,
    replay,
    entries,
    unsaved: () => pending.size + inflight.size + failed.size > 0,
    dispose: () => {
      clearTimers();
      if (retryTimer) clearTimeout(retryTimer);
    },
  };
}

export type SaveQueue = ReturnType<typeof createSaveQueue>;
