import { describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";

/** The statement `markAiRunError` sends, rendered by the real query builder. */
const statements: Array<{ sql: string; params: unknown[] }> = [];

vi.mock("@/db", () => {
  const real = drizzle.mock();
  const update = real.update.bind(real) as (table: never) => { set: (v: object) => { where: (w: unknown) => object } };
  const insert = () => {
    throw new Error("markAiRunError must not insert");
  };
  return {
    db: {
      insert,
      update: (table: never) => ({
        set: (values: object) => ({
          where: (condition: unknown) => {
            const built = update(table).set(values).where(condition) as unknown as { toSQL(): { sql: string; params: unknown[] } };
            return {
              then: (resolve: (v: unknown) => unknown) => {
                statements.push(built.toSQL());
                return Promise.resolve([]).then(resolve);
              },
            };
          },
        }),
      }),
    },
  };
});

import { markAiRunError } from "./ai-runs";

describe("markAiRunError", () => {
  it("updates the error of exactly that run and inserts nothing", async () => {
    await markAiRunError("run-1", "invalid answer: levels 3 are empty");
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toMatch(/^update "ai_runs" set "error" = \$1 where "ai_runs"\."id" = \$2$/);
    expect(statements[0].params).toEqual(["invalid answer: levels 3 are empty", "run-1"]);
  });

  it("keeps the stored error within 2000 characters", async () => {
    statements.length = 0;
    await markAiRunError("run-2", "x".repeat(3000));
    expect((statements[0].params[0] as string).length).toBe(2000);
  });
});
