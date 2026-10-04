import { describe, expect, it, vi } from "vitest";
import type { CandidateContext } from "./candidate-context";

const seen = vi.hoisted(() => ({ where: null as null | { sql: string; params: unknown[] } }));

vi.mock("@/db", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const { SQL } = await import("drizzle-orm");
  const dialect = new PgDialect();
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: () => chain,
    from: () => chain,
    where: (condition: unknown) => {
      if (condition instanceof SQL) seen.where = dialect.sqlToQuery(condition);
      return chain;
    },
    orderBy: () => chain,
    limit: async () => [{ id: "ct-1", orgId: "o1", solution: "HIRING", version: 3, body: { tr: "Metin", en: "Text" } }],
  });
  return { db: chain };
});

import { getConsentText } from "./candidate-context";

describe("getConsentText", () => {
  it("reads the newest consent text of the invitation's own solution, so exam and hiring copy never cross", async () => {
    const ctx = { assessment: { id: "a1", orgId: "o1", solution: "HIRING" } } as CandidateContext;
    const text = await getConsentText(ctx);
    expect(text.id).toBe("ct-1");
    expect(seen.where?.sql).toContain('"consent_texts"."org_id" = $1');
    expect(seen.where?.sql).toContain('"consent_texts"."solution" = $2');
    expect(seen.where?.params).toEqual(["o1", "HIRING"]);
  });
});
