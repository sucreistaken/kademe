import { describe, expect, it } from "vitest";
import { FlushRegistry } from "./flush-registry";

function deferred() {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("flush registry", () => {
  it("waits for every registered flush before resolving", async () => {
    const registry = new FlushRegistry();
    const a = deferred();
    const b = deferred();
    registry.register("0", () => a.promise);
    registry.register("1", () => b.promise);

    let done = false;
    const all = registry.flushAll().then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);

    a.resolve();
    await Promise.resolve();
    expect(done).toBe(false);

    b.resolve();
    await all;
    expect(done).toBe(true);
  });

  it("flushes an activity one last time when it unregisters, and keeps waiting on it", async () => {
    // "Next question" unmounts the text field; the submit that follows must
    // still wait for the draft that unmount fired.
    const registry = new FlushRegistry();
    const pending = deferred();
    let calls = 0;
    const unregister = registry.register("0", () => {
      calls += 1;
      return pending.promise;
    });
    unregister();
    expect(calls).toBe(1);
    expect(registry.size).toBe(0);

    let done = false;
    const all = registry.flushAll().then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    pending.resolve();
    await all;
    expect(done).toBe(true);
  });

  it("never rejects, so a failed draft save cannot block the submit", async () => {
    const registry = new FlushRegistry();
    registry.register("0", () => Promise.reject(new Error("offline")));
    await expect(registry.flushAll()).resolves.toBeUndefined();
  });

  it("only removes the flusher that was registered under the key", async () => {
    const registry = new FlushRegistry();
    const first = registry.register("0", () => Promise.resolve());
    registry.register("0", () => Promise.resolve());
    first();
    expect(registry.size).toBe(1);
  });
});
