import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, SQL, Table } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

/**
 * Hiring child tables reach their organisation only through their parent
 * chain, and library foreign keys are single-column (schema/hiring.ts). The
 * fake database below records every statement (table, WHERE with its bound
 * parameters, lock, written values); each test proves a read or write is
 * scoped to the caller's organisation, and that an id of another organisation
 * ends the call before anything is written. verify:hiring-setup proves the
 * same on a real database.
 */
const dialect = new PgDialect();
type Op = {
  kind: "select" | "insert" | "update" | "delete";
  table: string;
  where: string;
  params: unknown[];
  joins: string[];
  values?: unknown;
  lock?: string;
};
const ops: Op[] = [];
let respond: (op: Op) => unknown[] = () => [];

function sqlOf(condition: unknown) {
  if (!(condition instanceof SQL)) return { sql: "", params: [] as unknown[] };
  return dialect.sqlToQuery(condition);
}

function statement(kind: Op["kind"], table?: unknown) {
  const op: Op = { kind, table: table instanceof Table ? getTableName(table) : "", where: "", params: [], joins: [] };
  const join = (t: unknown, condition: unknown) => {
    const { sql, params } = sqlOf(condition);
    op.joins.push(`${getTableName(t as Table)} ON ${sql}`);
    op.params.push(...params);
    return chain;
  };
  const chain = {
    from: (t: unknown) => {
      op.table = getTableName(t as Table);
      return chain;
    },
    innerJoin: join,
    leftJoin: join,
    values: (v: unknown) => {
      op.values = v;
      return chain;
    },
    set: (v: unknown) => {
      op.values = v;
      return chain;
    },
    where: (condition: unknown) => {
      const { sql, params } = sqlOf(condition);
      op.where = sql;
      op.params.push(...params);
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
      return Promise.resolve()
        .then(() => respond(op))
        .then(resolve, reject);
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

const access = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock("../rules/access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../rules/access")>();
  return {
    ...actual,
    openingAccess: (...args: Parameters<typeof actual.openingAccess>) => {
      access.calls.push(args[1]);
      return actual.openingAccess(...args);
    },
  };
});

import { loadCompetencyFacts, loadScaleSnapshot, loadScorecard, loadVersionContent, positionProfile } from "./content";
import { liveWeights } from "./weight-sets";
import { createOpening, copySources, listOpenings, loadOpening } from "./openings";
import * as versions from "./versions";
import { emptyActivity, MAX_ACTIVITIES_PER_STAGE, stagePayloadSchema, type StagePayload } from "../rules/patches";

const ORG = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const OPENING = "33333333-3333-4333-8333-333333333333";
const VERSION = "44444444-4444-4444-8444-444444444444";
const STAGE = "55555555-5555-4555-8555-555555555555";
const ACTIVITY = "66666666-6666-4666-8666-666666666666";
const COMP = "77777777-7777-4777-8777-777777777777";
const POSITION = "88888888-8888-4888-8888-888888888888";

const writes = () => ops.filter((o) => o.kind !== "select");
const scopedToOrg = (op: Op | undefined, column: string) => {
  expect(op, column).toBeDefined();
  expect(`${op!.where} ${op!.joins.join(" ")}`).toContain(`${column} = $`);
  expect(op!.params).toContain(ORG);
};

const stagePayload: StagePayload = {
  name: { tr: "Aşama", en: "" },
  description: { tr: "", en: "" },
  internalPurpose: null,
  durationSeconds: 600,
  graceSeconds: 0,
  onTimeout: "AUTO_SUBMIT",
  backNavigation: false,
  activities: [{ ...emptyActivity("VIDEO"), competencyIds: [COMP] }],
};

/** Every function that writes to an opening's draft, called with ids of this test. */
const draftWrites: Array<[string, () => Promise<unknown>]> = [
  ["ensureDraftVersion", () => versions.ensureDraftVersion(ORG, OPENING)],
  ["addStage", () => versions.addStage(ORG, OPENING)],
  ["updateStage", () => versions.updateStage(ORG, OPENING, STAGE, { durationSeconds: 300 })],
  ["moveStage", () => versions.moveStage(ORG, OPENING, STAGE, 1)],
  ["deleteStage", () => versions.deleteStage(ORG, OPENING, STAGE)],
  ["insertStage", () => versions.insertStage(ORG, OPENING, stagePayload, 0)],
  ["addActivity", () => versions.addActivity(ORG, OPENING, STAGE, "VIDEO")],
  ["updateActivity", () => versions.updateActivity(ORG, OPENING, ACTIVITY, { maxTakes: 3 })],
  ["moveActivity", () => versions.moveActivity(ORG, OPENING, ACTIVITY, -1)],
  ["deleteActivity", () => versions.deleteActivity(ORG, OPENING, ACTIVITY)],
  ["insertActivity", () => versions.insertActivity(ORG, OPENING, STAGE, emptyActivity("VIDEO"))],
  ["setActivityCompetencies", () => versions.setActivityCompetencies(ORG, OPENING, ACTIVITY, [COMP])],
  ["saveDraftWeights", () => versions.saveDraftWeights(ORG, OPENING, { enabled: false, weights: {} })],
];

beforeEach(() => {
  ops.length = 0;
  access.calls.length = 0;
  respond = () => [];
});

describe("draft writes", () => {
  it.each(draftWrites)("%s locks the caller's opening by id and organisation first, and writes nothing for another organisation's", async (_name, run) => {
    await expect(run()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(ops[0]).toMatchObject({ kind: "select", table: "hiring_openings", lock: "update" });
    scopedToOrg(ops[0], '"hiring_openings"."org_id"');
    expect(ops[0].params).toContain(OPENING);
    expect(writes()).toEqual([]);
  });

  /** The opening is the caller's; its versions are listed within the organisation too. */
  const draftWorld = (over: (op: Op) => unknown[] | undefined = () => undefined) => (op: Op) => {
    const special = over(op);
    if (special) return special;
    if (op.kind === "insert") return [{ id: STAGE }];
    if (op.kind === "select" && op.table === "hiring_openings") return [{ id: OPENING }];
    if (op.kind === "select" && op.table === "hiring_versions") return [{ id: VERSION, number: 1, status: "DRAFT", publishedAt: null, previewedAt: null }];
    return [];
  };

  it("finds the draft among the caller's organisation's versions", async () => {
    respond = draftWorld();
    await versions.addStage(ORG, OPENING);
    scopedToOrg(
      ops.find((o) => o.kind === "select" && o.table === "hiring_versions"),
      '"hiring_versions"."org_id"',
    );
  });

  it("answers NO_DRAFT when the opening has only published versions", async () => {
    respond = draftWorld((op) => (op.table === "hiring_versions" ? [{ id: VERSION, number: 1, status: "PUBLISHED", publishedAt: new Date(), previewedAt: null }] : undefined));
    await expect(versions.addStage(ORG, OPENING)).rejects.toMatchObject({ code: "NO_DRAFT" });
    expect(writes()).toEqual([]);
  });

  it("a stage of another version is not found, and nothing is written", async () => {
    respond = draftWorld();
    await expect(versions.updateStage(ORG, OPENING, STAGE, { durationSeconds: 300 })).rejects.toMatchObject({ code: "NOT_FOUND", what: "stage" });
    const lookup = ops.find((o) => o.kind === "select" && o.table === "hiring_stages");
    expect(lookup?.params).toEqual(expect.arrayContaining([STAGE, VERSION]));
    expect(writes()).toEqual([]);
  });

  it("a competency is checked against the caller's organisation, and one it does not own writes nothing", async () => {
    respond = draftWorld((op) => (op.table === "hiring_activities" ? [{ stageId: STAGE, type: "VIDEO" }] : undefined));
    await expect(versions.setActivityCompetencies(ORG, OPENING, ACTIVITY, [COMP])).rejects.toMatchObject({ code: "COMPETENCY" });
    const lookup = ops.find((o) => o.kind === "select" && o.table === "competencies");
    scopedToOrg(lookup, '"competencies"."org_id"');
    expect(lookup?.params).toContain(COMP);
    expect(writes()).toEqual([]);
  });

  it("an undo payload's competencies are checked the same way before anything is inserted", async () => {
    respond = draftWorld();
    await expect(versions.insertStage(ORG, OPENING, stagePayload)).rejects.toMatchObject({ code: "COMPETENCY" });
    scopedToOrg(
      ops.find((o) => o.kind === "select" && o.table === "competencies"),
      '"competencies"."org_id"',
    );
    expect(writes()).toEqual([]);
  });

  it.each(draftWrites)("%s refuses a CLOSED opening and writes nothing", async (_name, run) => {
    respond = draftWorld((op) => (op.kind === "select" && op.table === "hiring_openings" ? [{ id: OPENING, status: "CLOSED" }] : undefined));
    await expect(run()).rejects.toMatchObject({ name: "HiringConflict", code: "CLOSED" });
    expect(writes()).toEqual([]);
  });

  /** A competency the organisation owns, archived after a question chose it. */
  const archivedWorld = (owned: Array<{ id: string; archivedAt: Date | null }>) =>
    draftWorld((op) => {
      if (op.kind === "select" && op.table === "competencies") return owned;
      if (op.kind === "select" && op.table === "hiring_stages") return [{ id: STAGE }];
      return undefined;
    });
  const archivedQuestion = { ...emptyActivity("VIDEO"), competencyIds: [COMP] };

  it("undo restores a question and a stage whose competency was archived since, when the organisation owns it", async () => {
    respond = archivedWorld([{ id: COMP, archivedAt: new Date() }]);
    await expect(versions.insertActivity(ORG, OPENING, STAGE, archivedQuestion, 0, { restore: true })).resolves.toBe(STAGE);
    expect(writes().some((o) => o.kind === "insert" && o.table === "hiring_activity_competencies")).toBe(true);
    ops.length = 0;
    await expect(versions.insertStage(ORG, OPENING, { ...stagePayload, activities: [archivedQuestion] }, 0, { restore: true })).resolves.toBe(STAGE);
    expect(writes().some((o) => o.kind === "insert" && o.table === "hiring_activity_competencies")).toBe(true);
  });

  it("a new question (an accepted AI card) may not bring an archived competency, and undo may not bring another organisation's", async () => {
    respond = archivedWorld([{ id: COMP, archivedAt: new Date() }]);
    await expect(versions.insertActivity(ORG, OPENING, STAGE, archivedQuestion)).rejects.toMatchObject({ code: "COMPETENCY" });
    await expect(versions.insertStage(ORG, OPENING, { ...stagePayload, activities: [archivedQuestion] })).rejects.toMatchObject({ code: "COMPETENCY" });
    respond = archivedWorld([]);
    await expect(versions.insertActivity(ORG, OPENING, STAGE, archivedQuestion, 0, { restore: true })).rejects.toMatchObject({ code: "COMPETENCY" });
    await expect(versions.insertStage(ORG, OPENING, stagePayload, 0, { restore: true })).rejects.toMatchObject({ code: "COMPETENCY" });
    expect(writes()).toEqual([]);
  });

  it("a stage holds at most MAX_ACTIVITIES_PER_STAGE questions, so a deleted stage always fits its undo payload", async () => {
    const full = Array.from({ length: MAX_ACTIVITIES_PER_STAGE }, (_, i) => ({ id: `${i}` }));
    respond = draftWorld((op) => {
      if (op.kind === "select" && op.table === "hiring_stages") return [{ id: STAGE }];
      if (op.kind === "select" && op.table === "hiring_activities") return full;
      return undefined;
    });
    await expect(versions.addActivity(ORG, OPENING, STAGE, "VIDEO")).rejects.toMatchObject({ name: "HiringConflict", code: "STAGE_FULL" });
    await expect(versions.insertActivity(ORG, OPENING, STAGE, emptyActivity("VIDEO"), null, { restore: true })).rejects.toMatchObject({ code: "STAGE_FULL" });
    expect(writes()).toEqual([]);
    expect(MAX_ACTIVITIES_PER_STAGE).toBe(20);
    expect(stagePayloadSchema.safeParse({ ...stagePayload, activities: Array.from({ length: MAX_ACTIVITIES_PER_STAGE }, () => emptyActivity("VIDEO")) }).success).toBe(true);
  });

  it("a value outside the database CHECKs is INVALID before any statement", async () => {
    await expect(versions.updateStage(ORG, OPENING, STAGE, { durationSeconds: 30 })).rejects.toMatchObject({ code: "INVALID" });
    await expect(versions.updateActivity(ORG, OPENING, ACTIVITY, { maxTakes: 9 })).rejects.toMatchObject({ code: "INVALID" });
    await expect(versions.insertStage(ORG, OPENING, { ...stagePayload, durationSeconds: 7201 })).rejects.toMatchObject({ code: "INVALID" });
    expect(ops).toEqual([]);
  });

  it("moving a stage only renumbers rows of the draft and never changes a parent id", async () => {
    const other = "99999999-9999-4999-8999-999999999999";
    respond = draftWorld((op) => (op.kind === "select" && op.table === "hiring_stages" ? [{ id: other }, { id: STAGE }] : undefined));
    await versions.moveStage(ORG, OPENING, STAGE, -1);
    const updates = writes();
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) {
      expect(u).toMatchObject({ kind: "update", table: "hiring_stages" });
      expect(Object.keys(u.values as object)).toEqual(["orderIndex"]);
    }
  });
});

describe("saveDraftWeights", () => {
  /** A draft measuring COMP with one video question, in the caller's organisation. */
  const weightsWorld = (op: Op): unknown[] => {
    if (op.kind === "select" && op.table === "hiring_openings") return [{ id: OPENING }];
    if (op.kind === "select" && op.table === "hiring_versions") return [{ id: VERSION, number: 2, versionNumber: 2, status: "DRAFT", publishedAt: null, previewedAt: null }];
    if (op.kind === "select" && op.table === "hiring_stages") return [{ id: STAGE, orderIndex: 0 }];
    if (op.kind === "select" && op.table === "hiring_activities") return [{ id: ACTIVITY, stageId: STAGE, orderIndex: 0, type: "VIDEO" }];
    if (op.kind === "select" && op.table === "hiring_activity_competencies") return [{ activityId: ACTIVITY, competencyId: COMP, orderIndex: 0 }];
    return [];
  };

  it("names a value that is not a whole 0-100 NOT_WHOLE and a wrong total NOT_100, and writes nothing", async () => {
    respond = weightsWorld;
    await expect(versions.saveDraftWeights(ORG, OPENING, { enabled: true, weights: { [COMP]: 99.5 } })).resolves.toEqual({ ok: false, code: "NOT_WHOLE", total: 99.5 });
    await expect(versions.saveDraftWeights(ORG, OPENING, { enabled: true, weights: { [COMP]: 90 } })).resolves.toEqual({ ok: false, code: "NOT_100", total: 90 });
    expect(writes()).toEqual([]);
  });

  it("a form loaded for another version (published meanwhile, a new draft opened) is STALE and writes nothing", async () => {
    respond = weightsWorld;
    await expect(versions.saveDraftWeights(ORG, OPENING, { versionId: STAGE, enabled: true, weights: { [COMP]: 100 } })).resolves.toEqual({ ok: false, code: "STALE" });
    expect(writes()).toEqual([]);
  });

  it("writes the draft it was loaded for, by id and organisation", async () => {
    respond = weightsWorld;
    await expect(versions.saveDraftWeights(ORG, OPENING, { versionId: VERSION, enabled: true, weights: { [COMP]: 100 } })).resolves.toEqual({ ok: true });
    const update = writes().find((o) => o.kind === "update" && o.table === "hiring_versions");
    expect(update?.values).toMatchObject({ weightsEnabled: true, draftWeights: { [COMP]: 100 } });
    scopedToOrg(update, '"hiring_versions"."org_id"');
    expect(update?.params).toContain(VERSION);
  });
});

describe("loaders", () => {
  it("loads a version only within the caller's organisation", async () => {
    expect(await loadVersionContent(ORG, VERSION)).toBeNull();
    scopedToOrg(ops[0], '"hiring_versions"."org_id"');
    expect(ops[0].params).toContain(VERSION);
  });

  it("reads a published scorecard and its newest weight set only within the caller's organisation", async () => {
    expect(await loadScorecard(ORG, VERSION)).toBeNull();
    scopedToOrg(ops[0], '"hiring_versions"."org_id"');
    expect(ops[0].params).toContain(VERSION);
    ops.length = 0;
    expect(await liveWeights(ORG, VERSION)).toBeNull();
    scopedToOrg(ops[0], '"hiring_versions"."org_id"');
    expect(ops[0].params).toContain(VERSION);
  });

  it("a malformed id finds nothing and sends no statement (no 22P02)", async () => {
    expect(await loadScorecard(ORG, "not-an-id")).toBeNull();
    expect(await liveWeights(ORG, "not-an-id")).toBeNull();
    expect(await loadVersionContent(ORG, "not-an-id")).toBeNull();
    expect((await loadCompetencyFacts(ORG, ["not-an-id"])).size).toBe(0);
    expect(await positionProfile(ORG, "not-an-id")).toEqual([]);
    expect(ops).toEqual([]);
  });

  it("reads competency facts, the scale and a position profile within the caller's organisation", async () => {
    await loadCompetencyFacts(ORG, [COMP]);
    scopedToOrg(ops[0], '"competencies"."org_id"');
    ops.length = 0;
    await expect(loadScaleSnapshot(ORG)).rejects.toThrow();
    scopedToOrg(ops[0], '"rating_scales"."org_id"');
    ops.length = 0;
    await positionProfile(ORG, POSITION);
    scopedToOrg(ops[0], '"positions"."org_id"');
  });

  it("loads an opening and the copy sources within the caller's organisation", async () => {
    expect(await loadOpening(ORG, OPENING)).toBeNull();
    scopedToOrg(ops[0], '"hiring_openings"."org_id"');
    ops.length = 0;
    await copySources(ORG);
    scopedToOrg(ops[0], '"hiring_openings"."org_id"');
  });

  it("lists openings with their status, so a closed one is read-only", async () => {
    respond = (op) =>
      op.table === "hiring_openings"
        ? [{ id: OPENING, name: "A", status: "CLOSED", deadlineAt: null, decisionMakerId: null, backupDecisionMakerId: null, positionName: "P", ownerName: null }]
        : [];
    const rows = await listOpenings(ORG, { id: ACTOR, role: "MANAGER" }, "CLOSED");
    scopedToOrg(ops[0], '"hiring_openings"."org_id"');
    expect(ops[0].joins.join(" ")).toContain('"positions"."org_id" = $');
    expect(rows).toHaveLength(1);
    expect(access.calls).toEqual([expect.objectContaining({ status: "CLOSED" })]);
  });
});

describe("createOpening", () => {
  it("locks a copy source by id and organisation FOR SHARE before reading its versions", async () => {
    respond = (op) =>
      op.table === "users" ? [{ id: ACTOR }] : op.table === "positions" ? [{ id: POSITION, name: "P", jobDescription: null }] : op.table === "hiring_openings" ? [{ id: OPENING }] : [];
    await createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "existing", id: POSITION }, start: "COPY", copyFrom: OPENING });
    const source = ops.find((o) => o.table === "hiring_openings");
    expect(source?.lock).toBe("share");
    scopedToOrg(source, '"hiring_openings"."org_id"');
    expect(ops.indexOf(source!)).toBeLessThan(ops.findIndex((o) => o.table === "hiring_versions"));
  });

  const input = { position: { kind: "existing" as const, id: POSITION }, start: "BLANK" as const, copyFrom: null };

  it("checks that the creator is an active user of the organisation, and writes nothing otherwise", async () => {
    await expect(createOpening({ id: ACTOR, orgId: ORG }, input)).rejects.toMatchObject({ code: "NOT_FOUND", what: "user" });
    scopedToOrg(ops[0], '"users"."org_id"');
    expect(ops[0].where).toContain('"users"."disabled_at" is null');
    expect(writes()).toEqual([]);
  });

  it("finds an existing position only within the organisation and not archived", async () => {
    respond = (op) => (op.table === "users" ? [{ id: ACTOR }] : []);
    expect(await createOpening({ id: ACTOR, orgId: ORG }, input)).toEqual({ ok: false, code: "POSITION_NOT_FOUND" });
    const lookup = ops.find((o) => o.table === "positions");
    scopedToOrg(lookup, '"positions"."org_id"');
    expect(lookup?.where).toContain('"positions"."archived_at" is null');
    expect(writes()).toEqual([]);
  });

  it("finds a copy source only within the organisation", async () => {
    respond = (op) => (op.table === "users" ? [{ id: ACTOR }] : op.table === "positions" ? [{ id: POSITION, name: "P", jobDescription: null }] : []);
    expect(await createOpening({ id: ACTOR, orgId: ORG }, { ...input, start: "COPY", copyFrom: OPENING })).toEqual({ ok: false, code: "COPY_SOURCE_NOT_FOUND" });
    scopedToOrg(
      ops.find((o) => o.table === "hiring_openings"),
      '"hiring_openings"."org_id"',
    );
    expect(writes()).toEqual([]);
  });
});
