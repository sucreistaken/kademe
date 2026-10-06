import { beforeEach, describe, expect, it, vi } from "vitest";
import { bankCoverage, type BankCount } from "@/lib/exam/blueprint";
import { examTemplateByKey } from "@/lib/exam/templates";

/**
 * ensureTemplateBlueprint over a fake database: `selects` are the rows each
 * successive select returns, `conflict` makes the insert hit the partial
 * unique index (another invite won the race).
 */
const state = vi.hoisted(() => ({
  selects: [] as unknown[][],
  conflict: false,
  inserts: [] as Array<{ table: string; values: unknown }>,
  counts: [] as BankCount[],
}));

vi.mock("@/db", async () => {
  const { auditLogs } = await import("@/db/schema");
  return {
    db: {
      select: () => ({ from: () => ({ where: async () => state.selects.shift() ?? [] }) }),
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
    },
  };
});
vi.mock("@/server/panel", () => ({ bankCounts: async () => state.counts }));

import { ensureTemplateBlueprint } from "./template-blueprint";

/** A bank with plenty at every section and level. */
const fullBank = (): BankCount[] =>
  (["GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"] as const).flatMap((section) =>
    (["A1", "A2", "B1", "B2", "C1", "C2"] as const).map((level) => ({ section, level, items: 200, stimuli: 50, cTests: 5 })),
  ) as BankCount[];

beforeEach(() => {
  state.selects = [];
  state.conflict = false;
  state.inserts = [];
  state.counts = fullBank();
});

describe("ensureTemplateBlueprint", () => {
  it("reuses the published exam for the template and writes nothing", async () => {
    state.selects = [[{ id: "old-bp", templateKey: "placement", status: "PUBLISHED" }]];
    const r = await ensureTemplateBlueprint("o1", "u1", examTemplateByKey("placement")!, "tr");
    expect(r).toMatchObject({ ok: true, created: false, blueprint: { id: "old-bp" } });
    expect(state.inserts).toEqual([]);
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
});
