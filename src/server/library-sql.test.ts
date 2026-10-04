import { describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";

/**
 * The tenancy tests in library.test.ts render each SQL fragment on its own, so
 * a column reference always comes out table-qualified there. Inside the whole
 * statement drizzle leaves a single-table select unqualified, and in a
 * correlated subquery an unqualified "id" binds to the inner table. This file
 * renders the complete statement the database receives.
 */
const statements: string[] = [];

function capture<T extends object>(builder: T): T {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "then") {
        return (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => {
          statements.push((target as unknown as { toSQL(): { sql: string } }).toSQL().sql);
          return Promise.resolve([]).then(resolve, reject);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const out = value.apply(target, args);
        return out && typeof out === "object" && "toSQL" in out ? capture(out) : out;
      };
    },
  });
}

vi.mock("@/db", () => {
  const real = drizzle.mock();
  // The real query builder; only its overloads are widened for the pass-through.
  const select = real.select.bind(real) as (fields?: unknown) => object;
  return { db: { select: (fields?: unknown) => capture(select(fields)) } };
});
vi.mock("@/solutions/registry.server", () => ({ solutionModules: () => [] }));

import { listPositions } from "./library";

describe("listPositions SQL", () => {
  it("counts each position's own profile rows: the subquery is correlated to the outer positions row", async () => {
    await listPositions("11111111-1111-4111-8111-111111111111");
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('pc.position_id = "positions"."id"');
    expect(statements[0]).not.toMatch(/pc\.position_id = "id"/);
  });
});
