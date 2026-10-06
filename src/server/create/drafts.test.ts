import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).proxyDb(fake) }));

import { auditDraft, insertDraft, loadOwnDraft, purgeStaleDrafts, STALE_DRAFT_DAYS, staleDraftCutoff, updateDraft } from "./drafts";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-06T12:00:00Z");
const ops = () => fake.calls.map(([op]) => op);
const valuesOf = () => fake.calls.filter(([op]) => op === "values").map(([, args]) => args[0] as Record<string, unknown>);

beforeEach(() => {
  fake.results = [];
  fake.calls = [];
});

describe("creation draft store", () => {
  it("puts the stale cutoff 30 days back", () => {
    expect(STALE_DRAFT_DAYS).toBe(30);
    expect(staleDraftCutoff(NOW).toISOString()).toBe("2026-09-06T12:00:00.000Z");
  });

  it("only counts stale drafts in report mode", async () => {
    fake.results = [[{ n: 3 }]];
    expect(await purgeStaleDrafts({ now: NOW, apply: false })).toEqual({ total: 3, deleted: 0 });
    expect(ops()).not.toContain("delete");
  });

  it("deletes stale drafts when applying", async () => {
    fake.results = [[{ n: 2 }], [{ id: "a" }, { id: "b" }]];
    expect(await purgeStaleDrafts({ now: NOW, apply: true })).toEqual({ total: 2, deleted: 2 });
    expect(ops()).toContain("delete");
  });

  it("skips the delete when nothing is stale", async () => {
    fake.results = [[{ n: 0 }]];
    expect(await purgeStaleDrafts({ now: NOW, apply: true })).toEqual({ total: 0, deleted: 0 });
    expect(ops()).not.toContain("delete");
  });

  it("answers null for an id that is not a uuid, without a query", async () => {
    expect(await loadOwnDraft(ORG, USER, "not-a-uuid")).toBeNull();
    expect(fake.calls).toEqual([]);
  });

  it("reads a draft only through the owner's organisation and user", async () => {
    fake.results = [[{ id: ID }]];
    expect(await loadOwnDraft(ORG, USER, ID)).toEqual({ id: ID });
    expect(ops()).toEqual(["select", "from", "where", "limit"]);
  });

  it("cuts a request to 4000 characters", async () => {
    fake.results = [[{ id: ID }]];
    await insertDraft({ orgId: ORG, userId: USER, request: "a".repeat(5000) });
    expect(valuesOf()[0]).toMatchObject({ orgId: ORG, userId: USER });
    expect((valuesOf()[0].request as string).length).toBe(4000);
  });

  it("stamps updatedAt on every update", async () => {
    await updateDraft(ORG, ID, { status: "DRAFTED" });
    const set = fake.calls.find(([op]) => op === "set")![1][0] as Record<string, unknown>;
    expect(set.status).toBe("DRAFTED");
    expect(set.updatedAt).toBeInstanceOf(Date);
  });

  it("audits with the draft as the subject", async () => {
    await auditDraft(ORG, USER, "create.apply", ID, { kind: "EXAM" });
    expect(valuesOf()[0]).toEqual({ orgId: ORG, actorId: USER, action: "create.apply", subjectType: "creation_draft", subjectId: ID, meta: { kind: "EXAM" } });
  });
});
