import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import {
  competencies,
  competencyAnchors,
  hiringActivities,
  hiringActivityCompetencies,
  hiringOpenings,
  hiringStages,
  hiringVersions,
  observationTags,
  positionCompetencies,
  ratingScales,
  scaleLevels,
  users,
} from "@/db/schema";
import { fake, writesOf, type Op } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));

import { publishDraft } from "./publish";
import { addWeightSet } from "./weight-sets";
import { orgDay } from "@/lib/org-timezone";

/**
 * Publishing and weight sets on a recording fake database: the lock order
 * (opening, then version, then gate reads), the organisation in every read and
 * write, and that a refusal writes nothing. verify:hiring-setup proves the same
 * on a real database, with two connections for the lock order.
 */
const ORG = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const OPENING = "33333333-3333-4333-8333-333333333333";
const VERSION = "44444444-4444-4444-8444-444444444444";
const STAGE = "55555555-5555-4555-8555-555555555555";
const ACTIVITY = "66666666-6666-4666-8666-666666666666";
const COMP = "77777777-7777-4777-8777-777777777777";
const COMP2 = "77777777-7777-4777-8777-777777777778";
const POSITION = "88888888-8888-4888-8888-888888888888";
const SET = "99999999-9999-4999-8999-999999999999";
const FOREIGN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const t = {
  openings: getTableName(hiringOpenings),
  versions: getTableName(hiringVersions),
  stages: getTableName(hiringStages),
  activities: getTableName(hiringActivities),
  mappings: getTableName(hiringActivityCompetencies),
  competencies: getTableName(competencies),
  anchors: getTableName(competencyAnchors),
  tags: getTableName(observationTags),
  scales: getTableName(ratingScales),
  levels: getTableName(scaleLevels),
  profile: getTableName(positionCompetencies),
  users: getTableName(users),
};

const text = (tr: string) => ({ tr, en: "" });
const scorecard = {
  schemaVersion: 1,
  scale: { min: 1, max: 5, levels: [] },
  competencies: [
    { id: COMP, name: text("İletişim"), description: text(""), anchors: {}, tags: [], weight: 75 },
    { id: COMP2, name: text("Problem Çözme"), description: text(""), anchors: {}, tags: [], weight: 25 },
  ],
  weightsEnabled: false,
};

type World = {
  opening?: Record<string, unknown> | null;
  user?: boolean;
  status?: "DRAFT" | "PUBLISHED";
  lockedStatus?: "DRAFT" | "PUBLISHED";
  anchors?: number[];
  failUpdate?: unknown;
  /** The live version's newest weight set; none by default (the scorecard's own percentages apply). */
  set?: { isActive: boolean; weights: Record<string, number> };
};

/** One organisation with one opening, one draft (or live) version, one stage, one video question. */
const world =
  (w: World = {}) =>
  (op: Op): unknown[] => {
    const status = w.status ?? "DRAFT";
    const version = {
      id: VERSION,
      number: 1,
      versionNumber: 1,
      orgId: ORG,
      openingId: OPENING,
      status,
      defaultLocale: "tr",
      localeSet: ["tr"],
      weightsEnabled: false,
      draftWeights: null,
      previewedAt: null,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      scorecard: status === "PUBLISHED" ? scorecard : null,
    };
    if (op.kind === "select") {
      if (op.table === t.openings) return w.opening === null ? [] : [{ id: OPENING, status: "DRAFT", positionId: POSITION, ...w.opening }];
      if (op.table === t.users) return w.user === false ? [] : [{ id: ACTOR }];
      if (op.table === t.versions) return [op.lock ? { ...version, status: w.lockedStatus ?? status } : version];
      if (op.table === t.stages)
        return [
          {
            id: STAGE,
            orderIndex: 0,
            name: text("Tanışma"),
            description: text(""),
            internalPurpose: null,
            durationSeconds: 600,
            graceSeconds: 0,
            onTimeout: "AUTO_SUBMIT",
            backNavigation: false,
          },
        ];
      if (op.table === t.activities) return [{ id: ACTIVITY, stageId: STAGE, orderIndex: 0, type: "VIDEO", required: true, prompt: text("Anlat"), note: text(""), config: {} }];
      if (op.table === t.mappings) return [{ activityId: ACTIVITY, competencyId: COMP, orderIndex: 0 }];
      if (op.table === t.competencies) return [{ id: COMP, name: text("İletişim"), description: text("Açık anlatır."), archivedAt: null }];
      if (op.table === t.anchors) return (w.anchors ?? [1, 3, 5]).map((value) => ({ competencyId: COMP, value, body: text(`Seviye ${value}`) }));
      if (op.table === t.tags) return [];
      if (op.table === t.scales) return [{ id: SET, minValue: 1, maxValue: 5 }];
      if (op.table === t.levels) return [{ value: 1, label: text("1") }];
      if (op.table === t.profile) return [{ competencyId: COMP, weight: 60 }];
      if (op.table === "hiring_weight_sets" && w.set) return [{ id: SET, isActive: w.set.isActive, label: "v1", reason: null, createdAt: new Date() }];
      if (op.table === "hiring_weights" && w.set) return Object.entries(w.set.weights).map(([competencyId, p]) => ({ weightSetId: SET, competencyId, percentage: p.toFixed(2) }));
      return [];
    }
    if (op.kind === "update" && op.table === t.versions && w.failUpdate) throw w.failUpdate;
    if (op.kind === "update" && op.table === t.versions) return [{ id: VERSION }];
    if (op.kind === "insert") return [{ id: SET }];
    return [];
  };

const scopedToOrg = (op: Op | undefined, column: string) => {
  expect(op, column).toBeDefined();
  expect(`${op!.where} ${op!.joins.join(" ")}`).toContain(`${column} = $`);
  expect(op!.params).toContain(ORG);
};

beforeEach(() => {
  fake.ops.length = 0;
  fake.respond = () => [];
});

describe("publishDraft", () => {
  it("locks the caller's opening first, then the draft by id and organisation, before any gate read", async () => {
    fake.respond = world();
    await expect(publishDraft(ORG, OPENING, ACTOR)).resolves.toMatchObject({ ok: true, versionId: VERSION, number: 1 });
    const ops = fake.ops;
    expect(ops[0]).toMatchObject({ kind: "select", table: t.openings, lock: "update" });
    scopedToOrg(ops[0], '"hiring_openings"."org_id"');
    expect(ops[0].params).toContain(OPENING);
    const versionLock = ops.findIndex((o) => o.table === t.versions && o.lock === "update");
    expect(versionLock).toBeGreaterThan(0);
    scopedToOrg(ops[versionLock], '"hiring_versions"."org_id"');
    expect(ops[versionLock].params).toContain(VERSION);
    // No other row lock comes between the two, and every gate read comes after both.
    expect(ops.slice(1, versionLock).filter((o) => o.lock)).toEqual([]);
    const gateReads: string[] = [t.stages, t.activities, t.mappings, t.competencies, t.anchors, t.tags, t.scales, t.levels, t.profile];
    const firstGateRead = ops.findIndex((o) => gateReads.includes(o.table));
    expect(firstGateRead).toBeGreaterThan(versionLock);
  });

  it("reads the measured competencies FOR SHARE in the organisation, so a library save cannot land in the middle of the snapshot", async () => {
    fake.respond = world();
    await publishDraft(ORG, OPENING, ACTOR);
    const shared = fake.ops.find((o) => o.table === t.competencies && o.lock === "share");
    scopedToOrg(shared, '"competencies"."org_id"');
    expect(shared!.params).toContain(COMP);
  });

  it("publishes in one update scoped to the organisation's draft: status, scorecard, published_at and published_by together", async () => {
    fake.respond = world();
    await publishDraft(ORG, OPENING, ACTOR);
    const update = fake.ops.find((o) => o.kind === "update" && o.table === t.versions);
    scopedToOrg(update, '"hiring_versions"."org_id"');
    expect(update!.where).toContain('"hiring_versions"."status" = $');
    const values = update!.values as Record<string, unknown>;
    expect(values).toMatchObject({ status: "PUBLISHED", publishedBy: ACTOR });
    expect(values.publishedAt).toBeInstanceOf(Date);
    expect(values.scorecard).toMatchObject({ schemaVersion: 1, competencies: [{ id: COMP, description: text("Açık anlatır."), weight: 100 }], weightsEnabled: false });
    expect(Object.keys(values)).not.toContain("defaultLocale");
    expect(Object.keys(values)).not.toContain("localeSet");
  });

  it("writes the first weight set from the scorecard and opens the opening of the organisation", async () => {
    fake.respond = world();
    await publishDraft(ORG, OPENING, ACTOR);
    const set = fake.ops.find((o) => o.kind === "insert" && o.table === "hiring_weight_sets");
    expect(set!.values).toMatchObject({ versionId: VERSION, isActive: false, createdBy: ACTOR });
    const weights = fake.ops.find((o) => o.kind === "insert" && o.table === "hiring_weights");
    expect(weights!.values).toEqual([{ weightSetId: SET, competencyId: COMP, percentage: "100.00" }]);
    const opened = fake.ops.find((o) => o.kind === "update" && o.table === t.openings);
    expect(opened!.values).toMatchObject({ status: "OPEN" });
    scopedToOrg(opened, '"hiring_openings"."org_id"');
    const audit = fake.ops.find((o) => o.kind === "insert" && o.table === "audit_logs");
    expect(audit!.values).toMatchObject({ orgId: ORG, actorId: ACTOR, action: "hiring.version.publish", subjectId: VERSION });
  });

  it("another organisation's opening is not found after one statement, and nothing is written", async () => {
    fake.respond = world({ opening: null });
    await expect(publishDraft(ORG, OPENING, ACTOR)).rejects.toMatchObject({ code: "NOT_FOUND", what: "opening" });
    expect(fake.ops).toHaveLength(1);
  });

  it("a closed opening is history: CLOSED, nothing written", async () => {
    fake.respond = world({ opening: { status: "CLOSED" } });
    await expect(publishDraft(ORG, OPENING, ACTOR)).rejects.toMatchObject({ code: "CLOSED" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("the publisher must be an active user of the organisation", async () => {
    fake.respond = world({ user: false });
    await expect(publishDraft(ORG, OPENING, ACTOR)).rejects.toMatchObject({ code: "NOT_FOUND", what: "user" });
    const lookup = fake.ops.find((o) => o.table === t.users);
    scopedToOrg(lookup, '"users"."org_id"');
    expect(lookup!.where).toContain('"users"."disabled_at" is null');
    expect(lookup!.params).toContain(ACTOR);
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("a malformed user id is refused before any statement", async () => {
    await expect(publishDraft(ORG, OPENING, "not-a-uuid")).rejects.toMatchObject({ code: "NOT_FOUND", what: "user" });
    expect(fake.ops).toEqual([]);
  });

  it("a draft with problems returns them and writes nothing", async () => {
    fake.respond = world({ anchors: [1, 5] });
    const outcome = await publishDraft(ORG, OPENING, ACTOR);
    expect(outcome).toEqual({ ok: false, problems: [{ code: "ANCHOR_MISSING", competencyId: COMP, level: 3 }] });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("an opening with only published versions answers NO_DRAFT", async () => {
    fake.respond = world({ status: "PUBLISHED" });
    await expect(publishDraft(ORG, OPENING, ACTOR)).rejects.toMatchObject({ code: "NO_DRAFT" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("a draft that is no longer a draft once locked answers NO_DRAFT", async () => {
    fake.respond = world({ lockedStatus: "PUBLISHED" });
    await expect(publishDraft(ORG, OPENING, ACTOR)).rejects.toMatchObject({ code: "NO_DRAFT" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("a freeze refusal from the database is answered NO_DRAFT, never a raw 23514", async () => {
    fake.respond = world({ failUpdate: Object.assign(new Error("frozen"), { code: "23514", constraint_name: "hiring_version_frozen" }) });
    await expect(publishDraft(ORG, OPENING, ACTOR)).rejects.toMatchObject({ code: "NO_DRAFT" });
  });
});

describe("addWeightSet", () => {
  const live = (w: World = {}) => world({ status: "PUBLISHED", ...w });
  const input = (over: Partial<{ versionId: string; enabled: boolean; weights: Record<string, number>; reason: string }> = {}) => ({
    versionId: VERSION,
    enabled: true,
    weights: { [COMP]: 70, [COMP2]: 30 },
    reason: "Kalibrasyon sonrası",
    ...over,
  });

  it("a blank reason is refused before any statement", async () => {
    await expect(addWeightSet(ORG, OPENING, input({ reason: "  " }), ACTOR)).resolves.toEqual({ ok: false, code: "REASON_REQUIRED" });
    expect(fake.ops).toEqual([]);
  });

  it("locks the caller's opening first and finds the live version and its scorecard in the organisation", async () => {
    fake.respond = live();
    await expect(addWeightSet(ORG, OPENING, input(), ACTOR)).resolves.toEqual({ ok: true });
    expect(fake.ops[0]).toMatchObject({ kind: "select", table: t.openings, lock: "update" });
    scopedToOrg(fake.ops[0], '"hiring_openings"."org_id"');
    for (const read of fake.ops.filter((o) => o.table === t.versions)) scopedToOrg(read, '"hiring_versions"."org_id"');
  });

  it("switches the active set atomically: the old sets of this version are deactivated before the new one is inserted", async () => {
    fake.respond = live();
    await addWeightSet(ORG, OPENING, input(), ACTOR);
    const writes = writesOf(fake.ops);
    const off = writes.findIndex((o) => o.kind === "update" && o.table === "hiring_weight_sets");
    const on = writes.findIndex((o) => o.kind === "insert" && o.table === "hiring_weight_sets");
    expect(off).toBeGreaterThanOrEqual(0);
    expect(on).toBeGreaterThan(off);
    expect(writes[off].values).toEqual({ isActive: false });
    expect(writes[off].params).toContain(VERSION);
    expect(writes[on].values).toMatchObject({ versionId: VERSION, isActive: true, reason: "Kalibrasyon sonrası", createdBy: ACTOR });
  });

  it("labels the set with the organisation's day, not the UTC date", async () => {
    fake.respond = live();
    // 22:30 UTC on 4 Oct is already 5 Oct in Istanbul (UTC+3).
    const now = new Date("2026-10-04T22:30:00Z");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    try {
      await addWeightSet(ORG, OPENING, input(), ACTOR);
    } finally {
      vi.useRealTimers();
    }
    const insert = fake.ops.find((o) => o.kind === "insert" && o.table === "hiring_weight_sets")!;
    expect((insert.values as { label: string }).label).toBe(orgDay(now));
    expect(orgDay(now, "Europe/Istanbul")).toBe("2026-10-05");
  });

  it("writes exactly the published competencies: an extra or foreign id in the input is never written", async () => {
    fake.respond = live();
    await addWeightSet(ORG, OPENING, input({ weights: { [COMP]: 70, [COMP2]: 30, [FOREIGN]: 0 } }), ACTOR);
    const rows = fake.ops.find((o) => o.kind === "insert" && o.table === "hiring_weights")!.values as Array<{ competencyId: string; percentage: string }>;
    expect(rows).toEqual([
      { weightSetId: SET, competencyId: COMP, percentage: "70.00" },
      { weightSetId: SET, competencyId: COMP2, percentage: "30.00" },
    ]);
  });

  it("weighting off keeps the scorecard's percentages and leaves no active set", async () => {
    fake.respond = live({ set: { isActive: true, weights: { [COMP]: 70, [COMP2]: 30 } } });
    await addWeightSet(ORG, OPENING, input({ enabled: false, weights: { [COMP]: -5 } }), ACTOR);
    const set = fake.ops.find((o) => o.kind === "insert" && o.table === "hiring_weight_sets");
    expect(set!.values).toMatchObject({ isActive: false });
    const rows = fake.ops.find((o) => o.kind === "insert" && o.table === "hiring_weights")!.values as Array<{ percentage: string }>;
    expect(rows.map((r) => r.percentage)).toEqual(["75.00", "25.00"]);
  });

  it("a total other than 100 is refused with the total and writes nothing", async () => {
    fake.respond = live();
    await expect(addWeightSet(ORG, OPENING, input({ weights: { [COMP]: 70, [COMP2]: 25 } }), ACTOR)).resolves.toEqual({ ok: false, code: "NOT_100", total: 95 });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("a value that is not a whole 0-100 is NOT_WHOLE, not NOT_100, so the message never contradicts the total shown", async () => {
    fake.respond = live();
    await expect(addWeightSet(ORG, OPENING, input({ weights: { [COMP]: 70.5, [COMP2]: 29.5 } }), ACTOR)).resolves.toEqual({ ok: false, code: "NOT_WHOLE", total: 100 });
    await expect(addWeightSet(ORG, OPENING, input({ weights: { [COMP]: 100 } }), ACTOR)).resolves.toEqual({ ok: false, code: "NOT_WHOLE", total: 100 });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("a change that changes nothing (same as the newest set, or the scorecard before any set) is NO_CHANGE and writes nothing", async () => {
    fake.respond = live({ set: { isActive: true, weights: { [COMP]: 70, [COMP2]: 30 } } });
    await expect(addWeightSet(ORG, OPENING, input(), ACTOR)).resolves.toEqual({ ok: false, code: "NO_CHANGE" });
    fake.respond = live();
    // No set yet: the published scorecard is plain average (weightsEnabled false).
    await expect(addWeightSet(ORG, OPENING, input({ enabled: false, weights: {} }), ACTOR)).resolves.toEqual({ ok: false, code: "NO_CHANGE" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("a form loaded for an older live version is STALE (a newer one went live meanwhile) and writes nothing", async () => {
    fake.respond = live();
    await expect(addWeightSet(ORG, OPENING, input({ versionId: FOREIGN }), ACTOR)).resolves.toEqual({ ok: false, code: "STALE" });
    // The live version is read under the opening's lock, the same lock publishing takes first.
    expect(fake.ops[0]).toMatchObject({ table: t.openings, lock: "update" });
    expect(writesOf(fake.ops)).toEqual([]);
    fake.ops.length = 0;
    await expect(addWeightSet(ORG, OPENING, input({ versionId: "not-an-id" }), ACTOR)).resolves.toEqual({ ok: false, code: "STALE" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("an opening with nothing published answers NO_LIVE and writes nothing", async () => {
    fake.respond = live({ status: "DRAFT" });
    await expect(addWeightSet(ORG, OPENING, input(), ACTOR)).resolves.toEqual({ ok: false, code: "NO_LIVE" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("another organisation's opening is not found and nothing is written", async () => {
    fake.respond = live({ opening: null });
    await expect(addWeightSet(ORG, OPENING, input(), ACTOR)).rejects.toMatchObject({ code: "NOT_FOUND", what: "opening" });
    expect(fake.ops).toHaveLength(1);
  });

  it("the author must be an active user of the organisation", async () => {
    fake.respond = live({ user: false });
    await expect(addWeightSet(ORG, OPENING, input(), ACTOR)).rejects.toMatchObject({ code: "NOT_FOUND", what: "user" });
    scopedToOrg(
      fake.ops.find((o) => o.table === t.users),
      '"users"."org_id"',
    );
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("a closed opening is history: CLOSED, nothing written", async () => {
    fake.respond = live({ opening: { status: "CLOSED" } });
    await expect(addWeightSet(ORG, OPENING, input(), ACTOR)).rejects.toMatchObject({ code: "CLOSED" });
    expect(writesOf(fake.ops)).toEqual([]);
  });
});
