import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { bankCoverage, section, type BankCount } from "@/lib/exam/blueprint";
import { examTemplateByKey } from "@/lib/exam/templates";

/**
 * ensureTemplateBlueprint over a fake database: `selects` are the rows each
 * successive select returns, `retired` the rows the archiving update returns
 * (empty: another call archived the row first), `conflict` makes the insert
 * hit the partial unique index (another invite won the race).
 */
const state = vi.hoisted(() => ({
  selects: [] as unknown[][],
  retired: [] as unknown[],
  conflict: false,
  inserts: [] as Array<{ table: string; values: unknown }>,
  updates: [] as Array<{ set: unknown; where: unknown }>,
  transactions: 0,
  counts: [] as BankCount[],
}));

vi.mock("@/db", async () => {
  const { auditLogs } = await import("@/db/schema");
  const fake = {
    select: () => ({ from: () => ({ where: async () => state.selects.shift() ?? [] }) }),
    update: () => ({
      set: (set: unknown) => ({
        where: (where: unknown) => {
          state.updates.push({ set, where });
          return { returning: async () => state.retired };
        },
      }),
    }),
    insert: (table: unknown) => {
      const name = table === auditLogs ? "audit" : "blueprint";
      let values: unknown;
      const chain = {
        values: (v: unknown) => {
          values = v;
          state.inserts.push({ table: name, values: v });
          return chain;
        },
        onConflictDoNothing: () => chain,
        returning: async () => (state.conflict ? [] : [{ id: "new-bp", ...(values as object) }]),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
      };
      return chain;
    },
  };
  return {
    db: {
      ...fake,
      transaction: async (fn: (tx: typeof fake) => unknown) => {
        state.transactions += 1;
        return fn(fake);
      },
    },
  };
});
vi.mock("@/server/panel", () => ({ bankCounts: async () => state.counts }));

import { canonicalJson, ensureTemplateBlueprint, isCurrentTemplate } from "./template-blueprint";

/** A bank with plenty at every section and level. */
const fullBank = (): BankCount[] =>
  (["GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"] as const).flatMap((section) =>
    (["A1", "A2", "B1", "B2", "C1", "C2"] as const).map((level) => ({ section, level, items: 200, stimuli: 50, cTests: 5, clozeTexts: 5, wordBanks: 5 })),
  ) as BankCount[];

/** The placement template as production published it before 2026-10-14 (main 02760e3): adaptive sections, 12-minute texts. */
function adaptivePlacement() {
  const t = examTemplateByKey("placement")!;
  return {
    ...t.config,
    sections: [
      section("GRAMMAR", 17, { adaptive: true, minItems: 10, maxItems: 16, targetSe: 0.45, cTest: true }),
      section("READING", 12, { adaptive: true, minItems: 5, maxItems: 8, targetSe: 0.55 }),
      section("LISTENING", 12, { adaptive: true, minItems: 5, maxItems: 8, targetSe: 0.55 }),
      section("WRITING", 10, { tasks: 1 }),
      section("SPEAKING", 6, { tasks: 2 }),
    ],
  };
}

/** The config with every object's keys in reverse order, as jsonb may hand it back. */
function reordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reordered);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reordered(v)]));
}

const sqlOf = (where: unknown) => new PgDialect().sqlToQuery(where as SQL);

beforeEach(() => {
  state.selects = [];
  state.retired = [];
  state.conflict = false;
  state.inserts = [];
  state.updates = [];
  state.transactions = 0;
  state.counts = fullBank();
});

describe("canonicalJson and isCurrentTemplate", () => {
  it("ignores key order and undefined values, not array order or values", () => {
    expect(canonicalJson({ b: 1, a: [1, { d: null, c: "x" }], u: undefined })).toBe(canonicalJson({ a: [1, { c: "x", d: null }], b: 1 }));
    expect(canonicalJson({ a: [1, 2] })).not.toBe(canonicalJson({ a: [2, 1] }));
    expect(canonicalJson({ a: 0.45 })).not.toBe(canonicalJson({ a: 0.5 }));
  });

  it("matches the template read back with its keys reordered, and nothing else", () => {
    const t = examTemplateByKey("placement")!;
    expect(isCurrentTemplate({ mode: t.mode, config: reordered(t.config) as typeof t.config }, t)).toBe(true);
    expect(isCurrentTemplate({ mode: t.mode, config: adaptivePlacement() }, t)).toBe(false);
    expect(isCurrentTemplate({ mode: "LEVEL_VERIFICATION", config: t.config }, t)).toBe(false);
  });
});

describe("ensureTemplateBlueprint", () => {
  it("reuses the published exam when it is the current template, and writes nothing", async () => {
    const t = examTemplateByKey("placement")!;
    state.selects = [[{ id: "old-bp", templateKey: "placement", status: "PUBLISHED", mode: t.mode, config: reordered(t.config) }]];
    const r = await ensureTemplateBlueprint("o1", "u1", t, "tr");
    expect(r).toMatchObject({ ok: true, created: false, blueprint: { id: "old-bp" } });
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([]);
    expect(state.transactions).toBe(0);
  });

  it("publishes the template unchanged, linked by key, named in the manager's language, and audits it", async () => {
    const t = examTemplateByKey("level-check")!;
    const r = await ensureTemplateBlueprint("o1", "u1", t, "en");
    expect(r).toMatchObject({ ok: true, created: true, blueprint: { id: "new-bp" } });
    const bp = state.inserts.find((i) => i.table === "blueprint")!.values;
    expect(bp).toMatchObject({ orgId: "o1", name: t.name.en, mode: "LEVEL_VERIFICATION", status: "PUBLISHED", config: t.config, templateKey: "level-check", createdBy: "u1" });
    expect((bp as { publishedAt: unknown }).publishedAt).toBeInstanceOf(Date);
    const audit = state.inserts.find((i) => i.table === "audit")!.values as Array<{ action: string; subjectId: string }>;
    expect(audit.map((a) => [a.action, a.subjectId])).toEqual([
      ["blueprint.create", "new-bp"],
      ["blueprint.publish", "new-bp"],
    ]);
    expect(state.updates).toEqual([]);
  });

  it("retires an exam published from an older template (adaptive) and publishes the current fixed form", async () => {
    const t = examTemplateByKey("placement")!;
    state.selects = [[{ id: "stale-bp", templateKey: "placement", status: "PUBLISHED", mode: t.mode, config: adaptivePlacement() }]];
    state.retired = [{ id: "stale-bp" }];
    const r = await ensureTemplateBlueprint("o1", "u1", t, "tr");
    expect(r).toMatchObject({ ok: true, created: true, blueprint: { id: "new-bp", config: t.config } });
    expect(state.transactions).toBe(1);

    // Only that row, and only while it is still published.
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].set).toMatchObject({ status: "ARCHIVED" });
    expect((state.updates[0].set as { archivedAt: unknown }).archivedAt).toBeInstanceOf(Date);
    const where = sqlOf(state.updates[0].where);
    expect(where.sql).toMatch(/"id" = \$1 and "exam_blueprints"\."status" = \$2/);
    expect(where.params).toEqual(["stale-bp", "PUBLISHED"]);

    const bp = state.inserts.find((i) => i.table === "blueprint")!.values as { config: { sections: Array<{ adaptive: boolean }> } };
    expect(bp.config.sections.every((s) => !s.adaptive)).toBe(true);
    const audit = state.inserts.find((i) => i.table === "audit")!.values as Array<{ action: string; subjectId: string; meta: Record<string, unknown> }>;
    expect(audit.map((a) => [a.action, a.subjectId])).toEqual([
      ["blueprint.archive", "stale-bp"],
      ["blueprint.create", "new-bp"],
      ["blueprint.publish", "new-bp"],
    ]);
    expect(audit[0].meta).toMatchObject({ template: "placement", reason: "template-changed", replacedBy: "new-bp" });
  });

  it("keeps the old exam published when the bank does not cover the current template", async () => {
    const t = examTemplateByKey("placement")!;
    state.selects = [[{ id: "stale-bp", templateKey: "placement", status: "PUBLISHED", mode: t.mode, config: adaptivePlacement() }]];
    state.counts = [];
    expect(await ensureTemplateBlueprint("o1", "u1", t, "tr")).toEqual({ ok: false, code: "TEMPLATE_COVERAGE" });
    expect(state.updates).toEqual([]);
    expect(state.inserts).toEqual([]);
  });

  it("creates nothing when the bank fails the publish coverage check", async () => {
    state.counts = [];
    const r = await ensureTemplateBlueprint("o1", "u1", examTemplateByKey("quick-screen")!, "tr");
    expect(r).toEqual({ ok: false, code: "TEMPLATE_COVERAGE" });
    expect(state.inserts).toEqual([]);
  });

  it("checks every claim for a verification template, not just one", async () => {
    // Everything but C2 grammar: one claim a manager could pick is not covered.
    state.counts = fullBank().filter((c) => !(c.section === "GRAMMAR" && c.level === "C2"));
    const t = examTemplateByKey("level-check")!;
    expect(bankCoverage(state.counts, t.config, t.mode, "A2").ok).toBe(true);
    const r = await ensureTemplateBlueprint("o1", "u1", t, "tr");
    expect(r).toEqual({ ok: false, code: "TEMPLATE_COVERAGE" });
  });

  it("reads the winner's row when a parallel invite published first", async () => {
    state.conflict = true;
    state.selects = [[], [{ id: "winner-bp", templateKey: "placement", status: "PUBLISHED" }]];
    const r = await ensureTemplateBlueprint("o1", "u1", examTemplateByKey("placement")!, "tr");
    expect(r).toMatchObject({ ok: true, created: false, blueprint: { id: "winner-bp" } });
    expect(state.inserts.filter((i) => i.table === "audit")).toEqual([]);
  });

  it("two invites racing on an old exam: the loser retires nothing, publishes nothing and gets the winner's row", async () => {
    const t = examTemplateByKey("placement")!;
    // Both read the old exam; the winner archived it and published first, so
    // the loser's guarded update matches no row and its insert hits the index.
    state.selects = [[{ id: "stale-bp", templateKey: "placement", status: "PUBLISHED", mode: t.mode, config: adaptivePlacement() }], [{ id: "winner-bp", templateKey: "placement", status: "PUBLISHED", mode: t.mode, config: t.config }]];
    state.retired = [];
    state.conflict = true;
    const r = await ensureTemplateBlueprint("o1", "u1", t, "tr");
    expect(r).toMatchObject({ ok: true, created: false, blueprint: { id: "winner-bp" } });
    expect(state.updates).toHaveLength(1);
    expect(state.inserts.filter((i) => i.table === "audit")).toEqual([]);
  });
});
