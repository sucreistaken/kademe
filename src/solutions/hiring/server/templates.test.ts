import { beforeEach, describe, expect, it, vi } from "vitest";
import { templateCompetency } from "../templates/competencies";
import { TEMPLATES } from "../templates/index";
import { templateMinutes, templateQuestionCount } from "../templates/materialise";
import { fake, writesOf, type Op } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));

import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { ensureTemplateCompetencies, templateCards } from "./templates";

/**
 * The competencies a template needs (spec 2026-10-06-hiring-ready-templates-design,
 * section 4.1) on the recording fake database: reuse by seed key (restoring an
 * archived one), then by name, else a new unreviewed row with its anchors and tags.
 */
const ORG = "11111111-1111-4111-8111-111111111111";
const ACTOR = "55555555-5555-4555-8555-555555555555";
const SCALE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SEEDED = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const NAMED = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const NEW = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const x = db as unknown as Executor;
const insertsInto = (table: string) => fake.ops.filter((o) => o.kind === "insert" && o.table === table);
const rowsOf = (op: Op | undefined) => (Array.isArray(op?.values) ? (op.values as Array<Record<string, unknown>>) : op ? [op.values as Record<string, unknown>] : []);
const isSeedKeyRead = (op: Op) => op.kind === "select" && op.table === "competencies" && op.where.includes('"seed_key"');
const isNameRead = (op: Op) => op.kind === "select" && op.table === "competencies" && !op.where.includes('"seed_key"');

beforeEach(() => {
  fake.ops = [];
  fake.respond = () => [];
});

describe("ensureTemplateCompetencies", () => {
  it("reuses the organisation's row with the seed key and writes nothing when its anchors are all there", async () => {
    fake.respond = (op) => {
      if (isSeedKeyRead(op)) return [{ id: SEEDED, seedKey: "communication", archivedAt: null }];
      if (op.table === "competency_anchors") return [{ competencyId: SEEDED, value: 1 }, { competencyId: SEEDED, value: 3 }, { competencyId: SEEDED, value: 5 }];
      return [];
    };
    expect(await ensureTemplateCompetencies(x, ORG, ACTOR, ["communication"])).toEqual({ communication: SEEDED });
    expect(writesOf(fake.ops)).toEqual([]);
    const read = fake.ops.find(isSeedKeyRead);
    expect(read?.where).toContain('"competencies"."org_id" = $');
    expect(read?.params).toContain(ORG);
  });

  it("restores an archived seed-key row and audits the restore", async () => {
    fake.respond = (op) => {
      if (isSeedKeyRead(op)) return [{ id: SEEDED, seedKey: "communication", archivedAt: new Date("2026-01-01T00:00:00Z") }];
      if (op.table === "competency_anchors") return [{ competencyId: SEEDED, value: 1 }, { competencyId: SEEDED, value: 3 }, { competencyId: SEEDED, value: 5 }];
      return [];
    };
    expect(await ensureTemplateCompetencies(x, ORG, ACTOR, ["communication"])).toEqual({ communication: SEEDED });
    const writes = writesOf(fake.ops);
    expect(writes).toHaveLength(2);
    const [update, audit] = writes;
    expect(update.kind).toBe("update");
    expect(update.table).toBe("competencies");
    expect(update.values).toMatchObject({ archivedAt: null });
    expect((update.values as { updatedAt: unknown }).updatedAt).toBeInstanceOf(Date);
    expect(update.where).toContain('"competencies"."org_id" = $');
    expect(update.params).toEqual(expect.arrayContaining([SEEDED, ORG]));
    expect(audit.table).toBe("audit_logs");
    expect(audit.values).toMatchObject({
      orgId: ORG,
      actorId: ACTOR,
      action: "library.competency.restore",
      subjectType: "competency",
      subjectId: SEEDED,
      meta: { via: "hiring.template" },
    });
  });

  it("reuses an active row with the same name (Turkish case rules, trimmed) and adds only its missing anchors", async () => {
    fake.respond = (op) => {
      if (isNameRead(op)) return [{ id: NAMED, name: { tr: "  İLETİŞİM ", en: "Talking" } }];
      if (op.table === "competency_anchors") return [{ competencyId: NAMED, value: 3 }];
      return [];
    };
    expect(await ensureTemplateCompetencies(x, ORG, ACTOR, ["communication"])).toEqual({ communication: NAMED });
    const nameRead = fake.ops.find(isNameRead);
    expect(nameRead?.where).toContain('"competencies"."archived_at" is null');
    expect(insertsInto("competencies")).toEqual([]);
    expect(insertsInto("audit_logs")).toEqual([]);
    const anchors = rowsOf(insertsInto("competency_anchors")[0]);
    const seed = templateCompetency("communication")!;
    expect(anchors).toEqual([
      { competencyId: NAMED, value: 1, body: seed.anchors[1] },
      { competencyId: NAMED, value: 5, body: seed.anchors[5] },
    ]);
    expect(writesOf(fake.ops)).toHaveLength(1);
  });

  it("matches on the English name too", async () => {
    fake.respond = (op) => (isNameRead(op) ? [{ id: NAMED, name: { tr: "Konuşma", en: " communication" } }] : []);
    expect(await ensureTemplateCompetencies(x, ORG, ACTOR, ["communication"])).toEqual({ communication: NAMED });
    expect(insertsInto("competencies")).toEqual([]);
  });

  it("creates a missing competency: unreviewed, with its seed key, anchors 1/3/5, tags and an audit row", async () => {
    fake.respond = (op) => {
      if (op.table === "rating_scales") return [{ id: SCALE }];
      if (op.kind === "insert" && op.table === "competencies") return [{ id: NEW }];
      return [];
    };
    const seed = templateCompetency("customer")!;
    expect(await ensureTemplateCompetencies(x, ORG, ACTOR, ["customer"])).toEqual({ customer: NEW });
    const [competency] = rowsOf(insertsInto("competencies")[0]);
    expect(competency).toEqual({ orgId: ORG, name: seed.name, description: seed.description, scaleId: SCALE, seedKey: "customer", reviewedAt: null });
    expect(rowsOf(insertsInto("competency_anchors")[0])).toEqual(([1, 3, 5] as const).map((value) => ({ competencyId: NEW, value, body: seed.anchors[value] })));
    const tags = rowsOf(insertsInto("observation_tags")[0]);
    expect(tags).toHaveLength(seed.positive.length + seed.negative.length);
    expect(tags.map((t) => t.orderIndex)).toEqual(tags.map((_, i) => i));
    expect(tags.slice(0, seed.positive.length).every((t) => t.polarity === "POSITIVE" && t.competencyId === NEW)).toBe(true);
    expect(tags.slice(seed.positive.length).every((t) => t.polarity === "NEGATIVE")).toBe(true);
    expect(insertsInto("audit_logs").map((o) => o.values)).toEqual([
      { orgId: ORG, actorId: ACTOR, action: "library.competency.create", subjectType: "competency", subjectId: NEW, meta: { via: "hiring.template" } },
    ]);
    // The default scale is read once, on the caller's executor.
    expect(fake.ops.filter((o) => o.table === "rating_scales")).toHaveLength(1);
  });

  it("inserts a new competency with ON CONFLICT DO NOTHING on the per-organisation seed key", async () => {
    fake.respond = (op) => {
      if (op.table === "rating_scales") return [{ id: SCALE }];
      if (op.kind === "insert" && op.table === "competencies") return [{ id: NEW }];
      return [];
    };
    await ensureTemplateCompetencies(x, ORG, ACTOR, ["customer"]);
    expect(insertsInto("competencies")[0].onConflict).toEqual({ action: "nothing", target: ["org_id", "seed_key"] });
  });

  it("uses the row a concurrent transaction created with the seed key, and writes no anchors, tags or audit for it", async () => {
    let seedReads = 0;
    fake.respond = (op) => {
      // The first seed-key read finds nothing; the re-read after the conflict finds the other transaction's row.
      if (isSeedKeyRead(op)) return (seedReads += 1) === 1 ? [] : [{ id: SEEDED }];
      if (op.table === "rating_scales") return [{ id: SCALE }];
      return [];
    };
    expect(await ensureTemplateCompetencies(x, ORG, ACTOR, ["customer"])).toEqual({ customer: SEEDED });
    const reread = fake.ops.filter(isSeedKeyRead)[1];
    expect(reread.where).toContain('"competencies"."org_id" = $');
    expect(reread.params).toEqual(expect.arrayContaining([ORG, "customer"]));
    expect(writesOf(fake.ops).map((o) => o.table)).toEqual(["competencies"]);
  });

  it("answers every key, in order, mixing reuse and creation", async () => {
    let n = 0;
    fake.respond = (op) => {
      if (isSeedKeyRead(op)) return [{ id: SEEDED, seedKey: "communication", archivedAt: null }];
      if (op.table === "competency_anchors") return [1, 3, 5].map((value) => ({ competencyId: SEEDED, value }));
      if (op.table === "rating_scales") return [{ id: SCALE }];
      if (op.kind === "insert" && op.table === "competencies") return [{ id: `00000000-0000-4000-8000-00000000000${(n += 1)}` }];
      return [];
    };
    const ids = await ensureTemplateCompetencies(x, ORG, ACTOR, ["customer", "communication", "problem_solving"]);
    expect(ids).toEqual({ customer: "00000000-0000-4000-8000-000000000001", communication: SEEDED, problem_solving: "00000000-0000-4000-8000-000000000002" });
    expect(rowsOf(insertsInto("competencies")[0])[0].seedKey).toBe("customer");
    expect(rowsOf(insertsInto("competencies")[1])[0].seedKey).toBe("problem_solving");
  });

  it("throws on a key no template competency has", async () => {
    await expect(ensureTemplateCompetencies(x, ORG, ACTOR, ["no-such-key"])).rejects.toThrow("unknown template competency no-such-key");
  });
});

describe("templateCards", () => {
  it("gives one card per template with its counts, competencies by weight and candidate prompts", () => {
    const cards = templateCards("tr");
    expect(cards.map((c) => c.key)).toEqual(TEMPLATES.map((t) => t.key));
    for (const [i, card] of cards.entries()) {
      const template = TEMPLATES[i];
      expect(card.group).toBe(template.group);
      expect(card.name).toBe(template.name.tr);
      expect(card.summary).toBe(template.summary.tr);
      expect(card.minutes).toBe(templateMinutes(template));
      expect(card.questionCount).toBe(templateQuestionCount(template));
      expect(card.stageCount).toBe(template.stages.length);
      const byWeight = Object.entries(template.weights).sort((a, b) => b[1] - a[1]);
      expect(card.competencies).toEqual(byWeight.map(([key]) => templateCompetency(key)!.name.tr));
      expect(card.stages).toEqual(template.stages.map((s) => ({ name: s.name.tr, prompts: s.activities.map((a) => a.prompt.tr) })));
    }
  });

  it("speaks the asked language", () => {
    const [card] = templateCards("en");
    expect(card.name).toBe("Customer Support Specialist");
    expect(card.competencies[0]).toBe(templateCompetency("customer")!.name.en);
  });
});
