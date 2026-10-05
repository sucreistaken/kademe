import { describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";

/**
 * Today's "expiring links" (ruling C5): the exam's list, so a hiring
 * invitation (a candidate's name, shown to every user of the organisation,
 * with the exam's "Uzat") never lands there. Hiring rows on Today come with
 * plan 3. The rendered statement is checked here; verify:hiring-flow checks
 * both kinds of link on a real database.
 */
const statements: Array<{ sql: string; params: unknown[] }> = [];

vi.mock("@/db", () => {
  const real = drizzle.mock();
  const select = real.select.bind(real) as (fields?: unknown) => object;
  const capture = <T extends object>(builder: T): T =>
    new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === "then") {
          return (resolve: (rows: unknown[]) => unknown) => {
            statements.push((target as unknown as { toSQL(): { sql: string; params: unknown[] } }).toSQL());
            return Promise.resolve([]).then(resolve);
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
  return { db: { select: (fields?: unknown) => capture(select(fields)) } };
});

import { expiringLinks } from "./links";

describe("expiringLinks", () => {
  it("lists only the organisation's exam invitations, not hiring ones", async () => {
    statements.length = 0;
    await expiringLinks("11111111-1111-4111-8111-111111111111");
    expect(statements).toHaveLength(1);
    const { sql, params } = statements[0];
    expect(sql).toContain('"assessments"."org_id" = $');
    expect(sql).toMatch(/"assessments"\."solution" = \$\d+/);
    const index = Number(/"assessments"\."solution" = \$(\d+)/.exec(sql)![1]);
    expect(params[index - 1]).toBe("LANGUAGE_EXAM");
    expect(params).toContain("11111111-1111-4111-8111-111111111111");
  });
});
