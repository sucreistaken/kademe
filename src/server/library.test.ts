import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";

/**
 * Library tables link to each other with single-column foreign keys, so a row
 * of one organisation can point at a row of another. The fake database below
 * records every SELECT's SQL; each assertion proves the organisation id is a
 * bound parameter of the query that must scope by it.
 */
const dialect = new PgDialect();
type Recorded = { sql: string; params: unknown[] };
const queries: Recorded[] = [];
let queued: unknown[][] = [];

function render(part: unknown): Recorded | null {
  if (part instanceof SQL) {
    const { sql, params } = dialect.sqlToQuery(part);
    return { sql, params };
  }
  return null;
}

function selectChain(fields?: Record<string, unknown>) {
  const parts: Recorded[] = [];
  const add = (part: unknown) => {
    const r = render(part);
    if (r) parts.push(r);
  };
  for (const value of Object.values(fields ?? {})) add(value);
  const chain = {
    from: () => chain,
    innerJoin: (_table: unknown, on: unknown) => {
      add(on);
      return chain;
    },
    where: (condition: unknown) => {
      add(condition);
      return chain;
    },
    orderBy: () => chain,
    limit: () => chain,
    then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => {
      queries.push({ sql: parts.map((p) => p.sql).join(" | "), params: parts.flatMap((p) => p.params) });
      return Promise.resolve(queued.shift() ?? []).then(resolve, reject);
    },
  };
  return chain;
}

vi.mock("@/db", () => ({ db: { select: (fields?: Record<string, unknown>) => selectChain(fields) } }));

type Hook = (orgId: string, refs: { positionIds: string[]; competencyIds: string[] }, viewer: { id: string; role: "OWNER" | "MANAGER" | "REVIEWER" } | null, x?: unknown) => Promise<{
  positions: Record<string, { total: number; live: number; items: Array<{ label: string; href: string }> }>;
  competencies: Record<string, { total: number; live: number; items: Array<{ label: string; href: string }> }>;
}>;
const usageHook = vi.fn<Hook>();
vi.mock("@/solutions/registry.server", () => ({
  solutionModules: () => [
    { key: "hiring", label: { tr: "İşe alım", en: "Hiring" }, library: { usage: usageHook } },
    { key: "language-exam", label: { tr: "Dil sınavı", en: "Language exam" } },
  ],
}));

import {
  activeCompetencyOptions,
  libraryUsage,
  listCompetencies,
  listPositions,
  loadCompetency,
  loadDefaultScale,
  loadPosition,
} from "./library";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  queries.length = 0;
  queued = [];
  usageHook.mockReset();
});

describe("library read model tenancy", () => {
  it("scopes the default scale by organisation", async () => {
    await loadDefaultScale(ORG);
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('"rating_scales"."org_id" = $');
    expect(queries[0].params).toContain(ORG);
  });

  it("scopes the competency list and the active options by organisation", async () => {
    queued = [[{ id: ID, name: { tr: "a", en: "a" }, seedKey: null, reviewedAt: null, archivedAt: null }], [], []];
    await listCompetencies(ORG);
    expect(queries[0].sql).toContain('"competencies"."org_id" = $');
    expect(queries[0].params).toContain(ORG);

    queries.length = 0;
    await activeCompetencyOptions(ORG);
    expect(queries[0].sql).toContain('"competencies"."org_id" = $');
    expect(queries[0].params).toContain(ORG);
  });

  it("looks a competency up by id and organisation, and reads nothing else when it is not the caller's", async () => {
    const found = await loadCompetency(OTHER_ORG, ID);
    expect(found).toBeNull();
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('"competencies"."id" = $');
    expect(queries[0].sql).toContain('"competencies"."org_id" = $');
    expect(queries[0].params).toEqual(expect.arrayContaining([ID, OTHER_ORG]));
  });

  it("scopes the position list, and counts only competencies of the same organisation", async () => {
    await listPositions(ORG);
    expect(queries[0].sql).toContain('"positions"."org_id" = $');
    expect(queries[0].sql).toMatch(/c\.org_id = \$/);
    expect(queries[0].params.filter((p) => p === ORG).length).toBeGreaterThanOrEqual(2);
  });

  it("looks a position up by id and organisation, and reads no profile when it is not the caller's", async () => {
    const found = await loadPosition(OTHER_ORG, ID);
    expect(found).toBeNull();
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('"positions"."id" = $');
    expect(queries[0].sql).toContain('"positions"."org_id" = $');
  });

  it("joins a position's profile to competencies of the same organisation only", async () => {
    queued = [
      [{ id: ID, name: "Role", team: null, shortDescription: null, jobDescription: null, skills: [], languages: [], archivedAt: null }],
      [],
    ];
    const found = await loadPosition(ORG, ID);
    expect(found?.profile).toEqual([]);
    expect(queries).toHaveLength(2);
    expect(queries[1].sql).toContain('"competencies"."org_id" = $');
    expect(queries[1].params).toContain(ORG);
  });
});

describe("libraryUsage", () => {
  it("asks only solutions that offer the hook, passes the organisation, and labels groups in the locale", async () => {
    const refs = { positionIds: ["p1"], competencyIds: ["c1"] };
    usageHook.mockResolvedValue({
      positions: {},
      competencies: { c1: { total: 2, live: 1, items: [{ label: "Opening", href: "/hiring/openings/o1" }] } },
    });
    const viewer = { id: ID, role: "REVIEWER" as const };
    const grouped = await libraryUsage(ORG, refs, "en", viewer);
    expect(usageHook).toHaveBeenCalledTimes(1);
    // Without an executor the hook reads on the global db (fix round 2: the executor is passed through).
    expect(usageHook).toHaveBeenCalledWith(ORG, refs, viewer, expect.anything());
    expect(grouped.competencies.c1.map((g) => g.label)).toEqual(["Hiring"]);
    expect(grouped.positions.p1).toEqual([]);
  });
});

describe("libraryUsage inside a transaction (fix round 2)", () => {
  it("hands the caller's executor to every solution's hook", async () => {
    usageHook.mockReset();
    usageHook.mockResolvedValue({ positions: {}, competencies: {} });
    const tx = { marker: "tx" };
    await libraryUsage(ORG, { positionIds: [], competencyIds: ["c1"] }, "tr", null, tx as never);
    expect(usageHook.mock.calls[0][3]).toBe(tx);
  });
});
