/**
 * A drizzle stand-in for unit tests: every chained call is recorded as
 * [method, args], and every awaited chain resolves the next queued result
 * ([] when the queue is empty). It never runs SQL, so a test pins which writes
 * happen and with which values, not what Postgres would answer.
 */
export type FakeDbState = { results: unknown[]; calls: Array<[string, unknown[]]> };

export function proxyDb(state: FakeDbState): unknown {
  const make = (): unknown =>
    new Proxy(
      function chain() {
        return undefined;
      },
      {
        get(_target, prop) {
          if (prop === "then") {
            const value = state.results.length ? state.results.shift() : [];
            return (resolve: (v: unknown) => void) => resolve(value);
          }
          return (...args: unknown[]) => {
            state.calls.push([String(prop), args]);
            return make();
          };
        },
      },
    );
  return make();
}
