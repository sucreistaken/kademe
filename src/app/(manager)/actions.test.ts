import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";

/**
 * Today's "7 gün uzat" (core extendLink) acts on exam invitations only (Task
 * 17 fix round 1): the read carries the solution, and a link it does not find
 * (a hiring link, another organisation's) writes nothing.
 */
const h = vi.hoisted(() => ({
  reads: [] as Array<{ sql: string; params: unknown[] }>,
  writes: [] as string[],
  rows: [] as unknown[],
}));

vi.mock("@/db", () => {
  const real = drizzle.mock();
  const select = real.select.bind(real) as (fields?: unknown) => object;
  const capture = <T extends object>(builder: T): T =>
    new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === "then") {
          return (resolve: (rows: unknown[]) => unknown) => {
            h.reads.push((target as unknown as { toSQL(): { sql: string; params: unknown[] } }).toSQL());
            return Promise.resolve(h.rows).then(resolve);
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
  const write = (name: string) => {
    const chain: Record<string, unknown> = {};
    for (const step of ["set", "where", "values"]) chain[step] = () => chain;
    chain.then = (resolve: (v: unknown) => unknown) => {
      h.writes.push(name);
      return Promise.resolve([]).then(resolve);
    };
    return chain;
  };
  return {
    db: {
      select: (fields?: unknown) => capture(select(fields)),
      update: () => write("update assessment_links"),
      insert: () => write("insert audit_logs"),
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("@/server/session", () => ({ requireUser: async () => ({ id: "u", orgId: "11111111-1111-4111-8111-111111111111", role: "MANAGER" }) }));

import { extendLink } from "./actions";

const ORG = "11111111-1111-4111-8111-111111111111";
const LINK = "22222222-2222-4222-8222-222222222222";
const form = () => {
  const f = new FormData();
  f.set("linkId", LINK);
  f.set("back", "/dashboard");
  return f;
};

beforeEach(() => {
  h.reads = [];
  h.writes = [];
  h.rows = [{ link: { id: LINK, status: "NOT_STARTED", expiresAt: new Date(Date.now() + 3_600_000) } }];
});

describe("extendLink (Today's '7 gün uzat')", () => {
  it("reads only an exam invitation of the session's organisation, then extends and audits it", async () => {
    await expect(extendLink(form())).rejects.toThrow("REDIRECT /dashboard?extended=1");
    expect(h.reads).toHaveLength(1);
    const { sql, params } = h.reads[0];
    const at = /"assessments"\."solution" = \$(\d+)/.exec(sql);
    expect(at).not.toBeNull();
    expect(params[Number(at![1]) - 1]).toBe("LANGUAGE_EXAM");
    expect(params).toEqual(expect.arrayContaining([ORG, LINK]));
    expect(h.writes).toEqual(["update assessment_links", "insert audit_logs"]);
  });

  it("writes nothing for a link it does not find (a hiring link, another organisation's)", async () => {
    h.rows = [];
    await expect(extendLink(form())).rejects.toThrow("REDIRECT /dashboard");
    expect(h.writes).toEqual([]);
  });
});
