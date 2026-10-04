import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, SQL, Table } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

/**
 * Library foreign keys are single-column, so a write that follows an id from
 * the request could touch another organisation's row. The fake database below
 * records every statement (table, WHERE clause with its bound parameters,
 * written values); each test proves the write is scoped to the caller's
 * organisation, or to rows already proven to belong to it.
 */
const dialect = new PgDialect();
type Op = {
  kind: "select" | "insert" | "update" | "delete";
  table: string;
  where: string;
  params: unknown[];
  values?: unknown;
  lock?: string;
};
const ops: Op[] = [];
let respond: (op: Op) => unknown[] = () => [];

function whereOf(condition: unknown) {
  if (!(condition instanceof SQL)) return { where: "", params: [] as unknown[] };
  const { sql, params } = dialect.sqlToQuery(condition);
  return { where: sql, params };
}

function statement(kind: Op["kind"], table?: unknown) {
  const op: Op = { kind, table: table instanceof Table ? getTableName(table) : "", where: "", params: [] };
  const chain = {
    from: (t: unknown) => {
      op.table = getTableName(t as Table);
      return chain;
    },
    values: (v: unknown) => {
      op.values = v;
      return chain;
    },
    set: (v: unknown) => {
      op.values = v;
      return chain;
    },
    where: (condition: unknown) => {
      Object.assign(op, whereOf(condition));
      return chain;
    },
    for: (lock: string) => {
      op.lock = lock;
      return chain;
    },
    limit: () => chain,
    orderBy: () => chain,
    returning: () => chain,
    then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => {
      ops.push(op);
      return Promise.resolve(respond(op)).then(resolve, reject);
    },
  };
  return chain;
}

// A function declaration, because vi.mock factories run before module-level consts exist.
function fakeDb() {
  const x = {
    select: () => statement("select"),
    insert: (t: unknown) => statement("insert", t),
    update: (t: unknown) => statement("update", t),
    delete: (t: unknown) => statement("delete", t),
    transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(x),
  };
  return x;
}
vi.mock("@/db", () => ({ db: fakeDb() }));

const ensureDefaultScale = vi.fn<(orgId: string) => Promise<{ id: string; created: boolean }>>();
const seedLibrary = vi.fn<(orgId: string) => Promise<{ scaleCreated: boolean; competenciesCreated: number }>>();
vi.mock("@/db/library-seed", () => ({
  ensureDefaultScale: (orgId: string) => ensureDefaultScale(orgId),
  seedLibrary: (orgId: string) => seedLibrary(orgId),
}));

import {
  createCompetency,
  saveCompetency,
  saveScaleLabels,
  setCompetencyArchived,
  startLibrary,
  type CompetencyInput,
} from "./library-write";

const ORG = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const SCALE = "44444444-4444-4444-8444-444444444444";
const OWN_TAG = "55555555-5555-4555-8555-555555555555";
const FOREIGN_TAG = "66666666-6666-4666-8666-666666666666";
const NEW_TAG = "77777777-7777-4777-8777-777777777777";

const text = (s: string) => ({ tr: s, en: s });
const validInput = (over: Partial<CompetencyInput> = {}): CompetencyInput => ({
  name: text("İletişim"),
  description: text("Ekip için tanım"),
  anchors: { "1": text("soruyu tekrar etmeden cevaba geçer"), "3": text("sorunun ana noktasını özetler"), "5": text("karşı tarafın sorusunu kendi cümleleriyle özetler") },
  tags: [],
  markReviewed: false,
  ...over,
});
const writes = () => ops.filter((o) => o.kind !== "select");
const auditRows = () => ops.filter((o) => o.kind === "insert" && o.table === "audit_logs");

beforeEach(() => {
  ops.length = 0;
  respond = () => [];
  ensureDefaultScale.mockReset();
  ensureDefaultScale.mockResolvedValue({ id: SCALE, created: false });
  seedLibrary.mockReset();
});

describe("createCompetency", () => {
  it("creates the row in the caller's organisation on that organisation's default scale, and audits it", async () => {
    respond = (op) => (op.kind === "insert" && op.table === "competencies" ? [{ id: ID }] : []);
    const result = await createCompetency(ORG, ACTOR, { name: text(" Yeni "), description: text(""), anchors: { "3": text("x y z w") } });
    expect(result).toEqual({ ok: true, id: ID });
    expect(ensureDefaultScale).toHaveBeenCalledWith(ORG);
    const row = ops.find((o) => o.kind === "insert" && o.table === "competencies")?.values as Record<string, unknown>;
    expect(row).toMatchObject({ orgId: ORG, scaleId: SCALE, name: { tr: "Yeni", en: "Yeni" } });
    expect(auditRows()[0].values).toMatchObject({ orgId: ORG, actorId: ACTOR, subjectId: ID, action: "library.competency.create" });
  });

  it("writes nothing without a name", async () => {
    expect(await createCompetency(ORG, ACTOR, { name: text(" "), description: text("") })).toEqual({ ok: false, code: "NAME_REQUIRED" });
    expect(ops).toEqual([]);
    expect(ensureDefaultScale).not.toHaveBeenCalled();
  });
});

describe("saveCompetency", () => {
  it("locks the competency by id and organisation, and writes nothing when it is not the caller's", async () => {
    const result = await saveCompetency(ORG, ACTOR, ID, validInput());
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: "select", table: "competencies", lock: "update" });
    expect(ops[0].where).toContain('"competencies"."id" = $');
    expect(ops[0].where).toContain('"competencies"."org_id" = $');
    expect(ops[0].params).toEqual(expect.arrayContaining([ID, ORG]));
  });

  it("refuses missing required anchors and too many tags before touching the database", async () => {
    expect(await saveCompetency(ORG, ACTOR, ID, validInput({ anchors: { "1": text("a b c d"), "5": text("a b c d") } }))).toEqual({
      ok: false,
      code: "ANCHORS_REQUIRED",
    });
    const seven = Array.from({ length: 7 }, (_, i) => ({ id: null, polarity: "POSITIVE" as const, label: text(`tag ${i}`) }));
    expect(await saveCompetency(ORG, ACTOR, ID, validInput({ tags: seven }))).toEqual({ ok: false, code: "TOO_MANY_TAGS" });
    expect(ops).toEqual([]);
  });

  it("updates only tags this competency owns; a tag id from elsewhere becomes a new tag", async () => {
    respond = (op) => {
      if (op.kind === "select" && op.table === "competencies") return [{ id: ID, reviewedAt: null }];
      if (op.kind === "select" && op.table === "observation_tags") return [{ id: OWN_TAG, archivedAt: null }];
      if (op.kind === "insert" && op.table === "observation_tags") return [{ id: NEW_TAG }];
      return [];
    };
    const result = await saveCompetency(
      ORG,
      ACTOR,
      ID,
      validInput({
        markReviewed: true,
        tags: [
          { id: OWN_TAG, polarity: "POSITIVE", label: text("kendi") },
          { id: FOREIGN_TAG, polarity: "NEGATIVE", label: text("başkasının") },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: true });

    const tagWrites = writes().filter((o) => o.table === "observation_tags");
    expect(tagWrites.flatMap((o) => o.params)).not.toContain(FOREIGN_TAG);
    const update = tagWrites.find((o) => o.kind === "update");
    expect(update?.where).toContain('"observation_tags"."competency_id" = $');
    expect(update?.params).toEqual(expect.arrayContaining([OWN_TAG, ID]));
    const insert = tagWrites.find((o) => o.kind === "insert");
    expect(insert?.values).toMatchObject({ competencyId: ID, polarity: "NEGATIVE", label: text("başkasının") });
    expect(insert?.values).not.toHaveProperty("id");

    const anchorWrites = writes().filter((o) => o.table === "competency_anchors");
    expect(anchorWrites.every((o) => o.kind === "insert" || o.params.includes(ID))).toBe(true);
    const competencyUpdate = writes().find((o) => o.table === "competencies");
    expect(competencyUpdate?.values).toHaveProperty("reviewedAt");
    expect(auditRows()[0].values).toMatchObject({
      orgId: ORG,
      actorId: ACTOR,
      subjectId: ID,
      action: "library.competency.save",
      meta: { markReviewed: true },
    });
  });

  it("a tag added in one save keeps its id on the next save, and nothing is archived", async () => {
    const newTag = { id: null, polarity: "POSITIVE" as const, label: text("yeni etiket") };
    respond = (op) => {
      if (op.kind === "select" && op.table === "competencies") return [{ id: ID, reviewedAt: new Date(), archivedAt: null }];
      if (op.kind === "insert" && op.table === "observation_tags") return [{ id: NEW_TAG }];
      return [];
    };
    const first = await saveCompetency(ORG, ACTOR, ID, validInput({ tags: [newTag] }));
    expect(first).toEqual({ ok: true, tags: [{ id: NEW_TAG, polarity: "POSITIVE", label: text("yeni etiket") }] });

    // The form sends back the id it was given; the competency now owns that tag.
    ops.length = 0;
    respond = (op) => {
      if (op.kind === "select" && op.table === "competencies") return [{ id: ID, reviewedAt: new Date(), archivedAt: null }];
      if (op.kind === "select" && op.table === "observation_tags") return [{ id: NEW_TAG, archivedAt: null }];
      return [];
    };
    const second = await saveCompetency(ORG, ACTOR, ID, validInput({ tags: [{ ...newTag, id: NEW_TAG }] }));
    expect(second).toEqual({ ok: true, tags: [{ id: NEW_TAG, polarity: "POSITIVE", label: text("yeni etiket") }] });
    const tagWrites = writes().filter((o) => o.table === "observation_tags");
    expect(tagWrites).toHaveLength(1);
    expect(tagWrites[0]).toMatchObject({ kind: "update", values: { archivedAt: null } });
    expect(tagWrites[0].params).toContain(NEW_TAG);
  });

  it("does not write anything to an archived competency", async () => {
    respond = (op) => (op.kind === "select" && op.table === "competencies" ? [{ id: ID, reviewedAt: null, archivedAt: new Date() }] : []);
    expect(await saveCompetency(ORG, ACTOR, ID, validInput())).toEqual({ ok: false, code: "ARCHIVED" });
    expect(writes()).toEqual([]);
  });

  it("audits the reviewed mark only when this save applied it", async () => {
    respond = (op) => (op.kind === "select" && op.table === "competencies" ? [{ id: ID, reviewedAt: new Date(), archivedAt: null }] : []);
    await saveCompetency(ORG, ACTOR, ID, validInput({ markReviewed: true }));
    expect(writes().find((o) => o.table === "competencies")?.values).not.toHaveProperty("reviewedAt");
    expect(auditRows()[0].values).toMatchObject({ action: "library.competency.save", meta: null });
  });

  it("archives a removed tag instead of deleting it", async () => {
    respond = (op) => {
      if (op.kind === "select" && op.table === "competencies") return [{ id: ID, reviewedAt: new Date() }];
      if (op.kind === "select" && op.table === "observation_tags") return [{ id: OWN_TAG, archivedAt: null }];
      return [];
    };
    await saveCompetency(ORG, ACTOR, ID, validInput({ tags: [] }));
    const tagWrites = writes().filter((o) => o.table === "observation_tags");
    expect(tagWrites.some((o) => o.kind === "delete")).toBe(false);
    expect(tagWrites[0]).toMatchObject({ kind: "update" });
    expect(tagWrites[0].values).toHaveProperty("archivedAt");
    expect(tagWrites[0].params).toContain(OWN_TAG);
  });
});

describe("setCompetencyArchived", () => {
  it("archives by id and organisation, and audits only a row it changed", async () => {
    expect(await setCompetencyArchived(ORG, ACTOR, ID, true)).toBe(false);
    expect(ops).toHaveLength(1);
    expect(ops[0].where).toContain('"competencies"."org_id" = $');
    expect(ops[0].params).toEqual(expect.arrayContaining([ID, ORG]));

    ops.length = 0;
    respond = (op) => (op.kind === "update" ? [{ id: ID }] : []);
    expect(await setCompetencyArchived(ORG, ACTOR, ID, false)).toBe(true);
    expect((ops[0].values as { archivedAt: unknown }).archivedAt).toBeNull();
    expect(auditRows()[0].values).toMatchObject({ orgId: ORG, action: "library.competency.restore" });
  });
});

describe("saveScaleLabels", () => {
  const levels = [{ value: 1, label: text("Belirgin eksik") }];
  const stored = [1, 2, 3, 4, 5].map((value) => ({ value, label: text(`Seviye ${value}`) }));
  const withScale = (op: Op) => (op.kind === "select" ? (op.table === "rating_scales" ? [{ id: SCALE }] : stored) : []);

  it("finds the default scale of the caller's organisation and writes nothing when there is none", async () => {
    expect(await saveScaleLabels(ORG, ACTOR, levels)).toEqual({ ok: false });
    expect(ops).toHaveLength(1);
    expect(ops[0].where).toContain('"rating_scales"."org_id" = $');
    expect(ops[0].params).toContain(ORG);
  });

  it("renames levels of that scale only", async () => {
    respond = withScale;
    const next = stored.map((l) => (l.value === 1 ? { value: 1, label: text("Belirgin eksik") } : l));
    expect(await saveScaleLabels(ORG, ACTOR, next)).toEqual({ ok: true });
    const levelReads = ops.filter((o) => o.kind === "select" && o.table === "scale_levels");
    expect(levelReads[0].params).toContain(SCALE);
    const updates = writes().filter((o) => o.table === "scale_levels");
    expect(updates).toHaveLength(1);
    const update = updates[0];
    expect(update?.where).toContain('"scale_levels"."scale_id" = $');
    expect(update?.params).toEqual(expect.arrayContaining([SCALE, 1]));
    expect(auditRows()[0].values).toMatchObject({ orgId: ORG, subjectId: SCALE, action: "library.scale.save" });
  });

  it("refuses an empty level name", async () => {
    expect(await saveScaleLabels(ORG, ACTOR, [{ value: 1, label: text(" ") }])).toEqual({ ok: false });
    expect(ops).toEqual([]);
  });

  it("refuses a level set that is not exactly the scale's levels", async () => {
    respond = withScale;
    const cases = [
      stored.slice(0, 4),
      [...stored.slice(0, 4), { value: 4, label: text("iki kez") }],
      [...stored, { value: 6, label: text("fazla") }],
      [],
    ];
    for (const set of cases) expect(await saveScaleLabels(ORG, ACTOR, set)).toEqual({ ok: false });
    expect(writes()).toEqual([]);
  });

  it("writes no audit row when nothing changed", async () => {
    respond = withScale;
    expect(await saveScaleLabels(ORG, ACTOR, stored.map((l) => ({ ...l, label: { tr: ` ${l.label.tr}`, en: l.label.en } })))).toEqual({ ok: true });
    expect(writes()).toEqual([]);
  });
});

describe("startLibrary", () => {
  it("seeds the caller's organisation and audits what it added", async () => {
    seedLibrary.mockResolvedValue({ scaleCreated: true, competenciesCreated: 8 });
    expect(await startLibrary(ORG, ACTOR)).toEqual({ scaleCreated: true, competenciesCreated: 8 });
    expect(seedLibrary).toHaveBeenCalledWith(ORG);
    expect(auditRows()).toHaveLength(1);
    expect(auditRows()[0].values).toMatchObject({
      orgId: ORG,
      actorId: ACTOR,
      action: "library.seed",
      subjectType: "organization",
      subjectId: ORG,
      meta: { scaleCreated: true, competenciesCreated: 8 },
    });
  });

  it("writes no audit row when the library was already there", async () => {
    seedLibrary.mockResolvedValue({ scaleCreated: false, competenciesCreated: 0 });
    await startLibrary(ORG, ACTOR);
    expect(auditRows()).toEqual([]);
  });
});
