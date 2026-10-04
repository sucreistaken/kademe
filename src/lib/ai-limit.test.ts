import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";

/**
 * The limiter counts ai_runs rows. The real query builder renders each count;
 * the database answer is queued per test.
 */
const statements: Array<{ sql: string; params: unknown[] }> = [];
const answers: number[] = [];

vi.mock("@/db", () => {
  const real = drizzle.mock();
  const select = real.select.bind(real) as (fields?: unknown) => { from: (t: never) => { where: (w: unknown) => object } };
  return {
    db: {
      select: (fields?: unknown) => ({
        from: (table: never) => ({
          where: (condition: unknown) => {
            const built = select(fields).from(table).where(condition) as unknown as { toSQL(): { sql: string; params: unknown[] } };
            return {
              then: (resolve: (v: unknown) => unknown) => {
                statements.push(built.toSQL());
                return Promise.resolve([{ n: answers.shift() ?? 0 }]).then(resolve);
              },
            };
          },
        }),
      }),
    },
  };
});

import { AI_ORG_LIMIT, AI_USER_LIMIT, aiLimitReached, overAiLimit } from "./ai-limit";

const NOW = new Date("2026-10-04T12:00:00Z");

beforeEach(() => {
  statements.length = 0;
  answers.length = 0;
});

describe("AI call limits", () => {
  it("allows 10 calls per user and purpose in 10 minutes and 200 per org a day", () => {
    expect(AI_USER_LIMIT).toEqual({ max: 10, windowMs: 10 * 60_000 });
    expect(AI_ORG_LIMIT).toEqual({ max: 200, windowMs: 24 * 60 * 60_000 });
    expect(overAiLimit({ user: 9, org: 199 })).toBe(false);
    expect(overAiLimit({ user: 10, org: 0 })).toBe(true);
    expect(overAiLimit({ user: 0, org: 200 })).toBe(true);
  });

  it("is under the limit with 9 recent user calls and 199 org calls", async () => {
    answers.push(9, 199);
    expect(await aiLimitReached("org-1", "user-1", "ANCHOR_DRAFT", NOW)).toBe(false);
  });

  it("is over the limit at the 10th user call in the window", async () => {
    answers.push(10, 10);
    expect(await aiLimitReached("org-1", "user-1", "ANCHOR_DRAFT", NOW)).toBe(true);
  });

  it("is over the limit at the 200th org call of the day", async () => {
    answers.push(0, 200);
    expect(await aiLimitReached("org-1", "user-1", "ANCHOR_DRAFT", NOW)).toBe(true);
  });

  it("counts this user's runs of this purpose in 10 minutes, and the org's in 24 hours, from ai_runs", async () => {
    await aiLimitReached("org-1", "user-1", "ANCHOR_DRAFT", NOW);
    expect(statements).toHaveLength(2);
    const [user, org] = statements;
    expect(user.sql).toMatch(/from "ai_runs" where \("ai_runs"\."org_id" = \$1 and "ai_runs"\."at" > \$2 and "ai_runs"\."purpose" = \$3 and "ai_runs"\."requested_by" = \$4\)/);
    expect(user.params).toEqual(["org-1", new Date(NOW.getTime() - 10 * 60_000).toISOString(), "ANCHOR_DRAFT", "user-1"]);
    expect(org.sql).toMatch(/from "ai_runs" where \("ai_runs"\."org_id" = \$1 and "ai_runs"\."at" > \$2 and "ai_runs"\."purpose" = \$3\)/);
    expect(org.params).toEqual(["org-1", new Date(NOW.getTime() - 24 * 60 * 60_000).toISOString(), "ANCHOR_DRAFT"]);
  });
});
