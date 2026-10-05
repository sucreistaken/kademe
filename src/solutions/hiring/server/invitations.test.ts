import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, writesOf, type Op } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));
const consent = vi.hoisted(() => ({ ensure: vi.fn<(orgId: string, x?: unknown) => Promise<string>>(async () => "ct-1") }));
vi.mock("./consent", () => ({ ensureHiringConsentText: consent.ensure }));

import { formatInviteDeadline, surveySeed } from "../rules/invitation";
import { zoneLabel } from "@/lib/org-timezone";
import { HiringNotFound } from "./errors";
import { createHiringInvitation, extendHiringLink, invitableOpenings, listOpeningCandidates, markRequestHandled, median, newHiringLink, openingFunnel } from "./invitations";

const ORG = "11111111-1111-4111-8111-111111111111";
const OPENING = "22222222-2222-4222-8222-222222222222";
const VERSION = "33333333-3333-4333-8333-333333333333";
const USER = "44444444-4444-4444-8444-444444444444";
const EVAL_A = "55555555-5555-4555-8555-555555555555";
const EVAL_B = "66666666-6666-4666-8666-666666666666";
const ASSESSMENT = "77777777-7777-4777-8777-777777777777";
const REQUEST = "88888888-8888-4888-8888-888888888888";
const NOW = new Date("2026-10-05T09:00:00Z");
const user = { id: USER, orgId: ORG };
const input = { openingId: OPENING, fullName: "Elif Kaya", email: "elif@example.com", locale: "tr" as const, deadline: null };

type World = { opening: Record<string, unknown> | null; versions: unknown[]; panel: unknown[]; existing: unknown[]; actor: unknown[] };
let world: World;

function respond(op: Op): unknown[] {
  if (op.kind === "select" && op.table === "users") return world.actor;
  if (op.kind === "select" && op.table === "hiring_openings") return world.opening ? [world.opening] : [];
  if (op.kind === "select" && op.table === "hiring_versions") return world.versions;
  if (op.kind === "select" && op.table === "hiring_opening_members") return world.panel;
  if (op.kind === "select" && op.table === "hiring_assessments") return world.existing;
  if (op.kind === "select" && op.table === "hiring_stages") return [{ total: 1500 }];
  if (op.kind === "select" && op.table === "organizations") return [{ name: "Örnek A.Ş.", contactEmail: "ik@ornek.com" }];
  if (op.kind === "select" && op.table === "positions") return [{ name: "Ürün Tasarımcısı" }];
  if (op.kind === "insert" && op.table === "candidates") return [{ id: "c-1" }];
  if (op.kind === "insert" && op.table === "assessments") return [{ id: ASSESSMENT, createdAt: NOW }];
  return [];
}

const openOpening = { id: OPENING, status: "OPEN", deadlineAt: null, positionId: "p-1", candidateContactEmail: "deniz@ornek.com" };

beforeEach(() => {
  fake.ops = [];
  fake.respond = respond;
  consent.ensure.mockClear();
  world = {
    opening: { ...openOpening },
    versions: [{ id: VERSION, number: 1, status: "PUBLISHED", publishedAt: NOW, previewedAt: null, updatedAt: NOW }],
    panel: [{ userId: EVAL_A }, { userId: EVAL_B }],
    existing: [],
    actor: [{ id: USER }],
  };
});

describe("createHiringInvitation", () => {
  it("refuses a missing name, a bad e-mail or a bad day before reading anything", async () => {
    expect(await createHiringInvitation(user, { ...input, fullName: " " }, { now: NOW })).toEqual({ ok: false, code: "NAME" });
    expect(await createHiringInvitation(user, { ...input, fullName: "x".repeat(121) }, { now: NOW })).toEqual({ ok: false, code: "NAME" });
    expect(await createHiringInvitation(user, { ...input, fullName: "Elif <b>" }, { now: NOW })).toEqual({ ok: false, code: "NAME" });
    expect(await createHiringInvitation(user, { ...input, email: "elif@" }, { now: NOW })).toEqual({ ok: false, code: "EMAIL" });
    expect(await createHiringInvitation(user, { ...input, deadline: "2026-02-30" }, { now: NOW })).toEqual({ ok: false, code: "DEADLINE_INVALID" });
    expect(await createHiringInvitation(user, { ...input, deadline: "2026-10-04" }, { now: NOW })).toEqual({ ok: false, code: "DEADLINE_PAST" });
    expect(await createHiringInvitation(user, { ...input, openingId: "nope" }, { now: NOW })).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(fake.ops).toEqual([]);
  });

  it("takes today, in the organisation's zone, as a valid last day", async () => {
    // 22:30 UTC on 4 Oct is already 5 Oct in Istanbul.
    const late = new Date("2026-10-04T22:30:00Z");
    expect(await createHiringInvitation(user, { ...input, deadline: "2026-10-04" }, { now: late })).toEqual({ ok: false, code: "DEADLINE_PAST" });
    const result = await createHiringInvitation(user, { ...input, deadline: "2026-10-05" }, { now: late });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.expiresAt.toISOString()).toBe("2026-10-05T20:59:59.000Z");
  });

  it("reads the opening of the caller's organisation and holds it against a close", async () => {
    await createHiringInvitation(user, input, { now: NOW });
    const read = fake.ops.find((o) => o.table === "hiring_openings")!;
    expect(read.where).toContain('"hiring_openings"."org_id" = $');
    expect(read.params).toEqual(expect.arrayContaining([OPENING, ORG]));
    expect(read.lock).toBe("share");
    const versions = fake.ops.find((o) => o.table === "hiring_versions")!;
    expect(versions.params).toEqual(expect.arrayContaining([OPENING, ORG]));
  });

  it("acts only for an active user of the organisation", async () => {
    world.actor = [];
    await expect(createHiringInvitation(user, input, { now: NOW })).rejects.toBeInstanceOf(HiringNotFound);
    const actor = fake.ops.find((o) => o.table === "users")!;
    expect(actor.where).toContain('"users"."disabled_at" is null');
    expect(actor.params).toEqual(expect.arrayContaining([USER, ORG]));
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it.each([
    ["an unknown opening", { opening: null }, "NOT_FOUND"],
    ["a closed opening", { opening: { ...openOpening, status: "CLOSED" } }, "CLOSED"],
    ["a draft opening", { opening: { ...openOpening, status: "DRAFT" } }, "NOT_PUBLISHED"],
    ["an opening without a published version", { versions: [{ id: VERSION, number: 1, status: "DRAFT", publishedAt: null, previewedAt: null, updatedAt: NOW }] }, "NOT_PUBLISHED"],
    ["an opening whose deadline has passed", { opening: { ...openOpening, deadlineAt: new Date("2026-10-04T20:59:59Z") } }, "OPENING_DEADLINE_PASSED"],
    ["an opening without an active evaluator", { panel: [] }, "NO_EVALUATORS"],
  ] as const)("refuses %s and writes nothing", async (_label, change, code) => {
    world = { ...world, ...change } as World;
    expect(await createHiringInvitation(user, input, { now: NOW })).toEqual({ ok: false, code });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("copies only the active panel members who are the organisation's own users", async () => {
    await createHiringInvitation(user, input, { now: NOW });
    const panel = fake.ops.find((o) => o.table === "hiring_opening_members")!;
    expect(panel.joins[0]).toContain('"users"."org_id" = $');
    expect(panel.joins[0]).toContain('"users"."disabled_at" is null');
    expect(panel.params).toEqual(expect.arrayContaining([ORG, OPENING]));
  });

  it("refuses an e-mail already invited to this opening, naming that invitation, under a lock on that e-mail", async () => {
    world.existing = [{ assessmentId: "old", invitedAt: NOW }];
    expect(await createHiringInvitation(user, { ...input, email: " Elif@Example.com " }, { now: NOW })).toEqual({
      ok: false,
      code: "DUPLICATE",
      existing: { assessmentId: "old", invitedAt: NOW },
    });
    expect(writesOf(fake.ops)).toEqual([]);
    const lockAt = fake.ops.findIndex((o) => o.table === "(execute)");
    const checkAt = fake.ops.findIndex((o) => o.table === "hiring_assessments");
    expect(lockAt).toBeGreaterThan(-1);
    expect(lockAt).toBeLessThan(checkAt);
    expect(fake.ops[lockAt].where).toContain("pg_advisory_xact_lock");
    expect(fake.ops[lockAt].params).toEqual(expect.arrayContaining([OPENING, "Elif@Example.com"]));
    const check = fake.ops[checkAt];
    expect(check.where).toContain('"hiring_assessments"."org_id" = $');
    expect(check.where).toContain('"hiring_assessments"."opening_id" = $');
    expect(check.where).toContain("lower(");
    expect(check.params).toEqual(expect.arrayContaining([ORG, OPENING, "Elif@Example.com"]));
  });

  it("writes the person, the HIRING invitation, its frozen terms, the panel, one link, the ready message and the audit row", async () => {
    const result = await createHiringInvitation(user, input, { now: NOW, baseUrl: "https://kademe.test" });
    expect(result.ok).toBe(true);
    const writes = writesOf(fake.ops);
    expect(writes.map((w) => w.table)).toEqual(["candidates", "assessments", "hiring_assessments", "hiring_assignments", "assessment_links", "message_outbox", "audit_logs"]);
    expect(writes[0].values).toEqual({ orgId: ORG, fullName: "Elif Kaya", email: "elif@example.com" });
    expect(writes[1].values).toMatchObject({ orgId: ORG, candidateId: "c-1", solution: "HIRING", locale: "tr", invitedBy: USER });
    expect(writes[2].values).toEqual({ assessmentId: ASSESSMENT, orgId: ORG, openingId: OPENING, versionId: VERSION, consentTextId: "ct-1", proctorLevel: "OFF", extraTimePct: 0 });
    expect(consent.ensure).toHaveBeenCalledTimes(1);
    expect(consent.ensure.mock.calls[0][0]).toBe(ORG);
    expect(consent.ensure.mock.calls[0][1]).toBeDefined();
    expect(writes[3].values).toEqual([
      { assessmentId: ASSESSMENT, userId: EVAL_A },
      { assessmentId: ASSESSMENT, userId: EVAL_B },
    ]);
    expect(writes[4].values).toMatchObject({ assessmentId: ASSESSMENT, status: "NOT_STARTED", attemptsAllowed: 1 });
    const outbox = writes[5].values as { orgId: string; kind: string; toEmail: string; subject: string; body: string };
    expect(outbox).toMatchObject({ orgId: ORG, kind: "INVITE", toEmail: "elif@example.com", subject: "Örnek A.Ş.: Ürün Tasarımcısı değerlendirmesi" });
    expect(outbox.body).toContain("yaklaşık 25 dakikada");
    expect(outbox.body).toContain("deniz@ornek.com");
    // 14 days from 5 Oct, the end of that day in the organisation's zone, named with the zone.
    expect(outbox.body).toContain(`Son tarih: ${formatInviteDeadline("2026-10-19", "tr", zoneLabel("tr"))}.`);
    expect(outbox.body).not.toContain("\u2014");
    if (result.ok) {
      expect(result.url.startsWith("https://kademe.test/a/")).toBe(true);
      expect(outbox.body).toContain(result.url);
      expect(result.message.body).toBe(outbox.body);
      expect(result.expiresAt.toISOString()).toBe("2026-10-19T20:59:59.000Z");
      expect(result).toMatchObject({ assessmentId: ASSESSMENT, candidateId: "c-1" });
    }
    expect(writes[6].values).toMatchObject({ orgId: ORG, actorId: USER, action: "hiring.candidate.invite", subjectType: "assessment", subjectId: ASSESSMENT });
  });

  it("holds a chosen day at the opening's deadline", async () => {
    world.opening = { ...openOpening, deadlineAt: new Date("2026-10-10T20:59:59Z") };
    const result = await createHiringInvitation(user, { ...input, deadline: "2026-12-01" }, { now: NOW });
    expect(result.ok && result.expiresAt.toISOString()).toBe("2026-10-10T20:59:59.000Z");
  });

  it("writes the message in the candidate's language", async () => {
    const result = await createHiringInvitation(user, { ...input, locale: "en" }, { now: NOW });
    expect(result.ok && result.message.body).toContain(`Deadline: ${formatInviteDeadline("2026-10-19", "en", zoneLabel("en"))}.`);
  });

  it("keeps a duplicate when the manager asked for it on purpose", async () => {
    world.existing = [{ assessmentId: "old", invitedAt: NOW }];
    expect((await createHiringInvitation(user, { ...input, allowDuplicate: true }, { now: NOW })).ok).toBe(true);
  });
});

describe("newHiringLink", () => {
  const invitation = { assessmentId: ASSESSMENT, versionId: VERSION, name: "Elif Kaya", email: "elif@example.com", locale: "en" };
  function linkWorld(link: unknown[]) {
    return (op: Op) => {
      if (op.kind === "select" && op.table === "hiring_assessments") return [invitation];
      if (op.kind === "select" && op.table === "assessment_links") return link;
      return respond(op);
    };
  }

  it("expires the old link and issues one that keeps the progress state", async () => {
    fake.respond = linkWorld([{ id: "l-old", status: "IN_PROGRESS", expiresAt: new Date("2026-10-06T20:59:59Z") }]);
    const result = await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW, baseUrl: "https://kademe.test" });
    expect(result.ok).toBe(true);
    const writes = writesOf(fake.ops);
    expect(writes[0]).toMatchObject({ kind: "update", table: "assessment_links", values: { status: "EXPIRED" } });
    expect(writes[0].params).toContain("l-old");
    expect(writes[1]).toMatchObject({ kind: "insert", table: "assessment_links", values: { assessmentId: ASSESSMENT, status: "IN_PROGRESS" } });
    expect(writes.map((w) => w.table)).toEqual(["assessment_links", "assessment_links", "message_outbox", "audit_logs"]);
    expect(writes[3].values).toMatchObject({ orgId: ORG, actorId: USER, action: "hiring.candidate.link", subjectId: ASSESSMENT });
    if (result.ok) {
      // At least seven more days: 12 Oct, end of day in Istanbul.
      expect(result.expiresAt.toISOString()).toBe("2026-10-12T20:59:59.000Z");
      expect(result.message.body).toContain(`Deadline: ${formatInviteDeadline("2026-10-12", "en", zoneLabel("en"))}.`);
      expect(result.url.startsWith("https://kademe.test/a/")).toBe(true);
    }
  });

  it("locks the opening against a close, then the invitation, then its live link, all scoped to the caller", async () => {
    fake.respond = linkWorld([{ id: "l-old", status: "NOT_STARTED", expiresAt: new Date("2026-12-01T20:59:59Z") }]);
    const result = await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW });
    const order = fake.ops.filter((o) => o.lock).map((o) => [o.table, o.lock]);
    expect(order).toEqual([
      ["hiring_openings", "share"],
      ["hiring_assessments", "update"],
      ["assessment_links", "update"],
      // Task 18: the candidate's open new-link requests, answered by the new link, last.
      ["candidate_requests", "update"],
    ]);
    const opening = fake.ops.find((o) => o.table === "hiring_openings")!;
    expect(opening.params).toEqual(expect.arrayContaining([OPENING, ORG]));
    const row = fake.ops.find((o) => o.table === "hiring_assessments")!;
    expect(row.where).toContain('"hiring_assessments"."org_id" = $');
    expect(row.where).toContain('"hiring_assessments"."opening_id" = $');
    expect(row.params).toEqual(expect.arrayContaining([ASSESSMENT, ORG, OPENING]));
    const link = fake.ops.find((o) => o.table === "assessment_links" && o.kind === "select")!;
    expect(link.where).toContain("<> $");
    // A later expiry on the old link is kept.
    expect(result.ok && result.expiresAt.toISOString()).toBe("2026-12-01T20:59:59.000Z");
  });

  it("closes the replaced link now, so its card never shows a later closing day (Task 18 fix round 1)", async () => {
    fake.respond = linkWorld([{ id: "l-old", status: "NOT_STARTED", expiresAt: new Date("2026-10-19T20:59:59Z") }]);
    const result = await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW });
    const writes = writesOf(fake.ops);
    expect(writes[0]).toMatchObject({ kind: "update", table: "assessment_links", values: { status: "EXPIRED", expiresAt: NOW } });
    // The new link still keeps the later day of the old one.
    expect(result.ok && result.expiresAt.toISOString()).toBe("2026-10-19T20:59:59.000Z");
    // An old day already behind stays as it was.
    fake.ops = [];
    const past = new Date("2026-10-01T20:59:59Z");
    fake.respond = linkWorld([{ id: "l-old", status: "NOT_STARTED", expiresAt: past }]);
    await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW });
    expect(writesOf(fake.ops)[0].values).toMatchObject({ status: "EXPIRED", expiresAt: past });
  });

  it("keeps a retake open on the new link", async () => {
    fake.respond = linkWorld([{ id: "l-old", status: "RETAKE_AVAILABLE", expiresAt: NOW }]);
    await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW });
    expect(writesOf(fake.ops)[1].values).toMatchObject({ status: "RETAKE_AVAILABLE" });
  });

  it("does not replace the link of a finished candidate", async () => {
    fake.respond = linkWorld([{ id: "l", status: "COMPLETED", expiresAt: NOW }]);
    expect(await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).toEqual({ ok: false, code: "COMPLETED" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("refuses a new link on a closed opening for a candidate who has not started", async () => {
    world.opening = { ...openOpening, status: "CLOSED" };
    for (const link of [[{ id: "l", status: "NOT_STARTED", expiresAt: NOW }], []]) {
      fake.ops = [];
      fake.respond = linkWorld(link);
      expect(await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).toEqual({ ok: false, code: "CLOSED" });
      expect(writesOf(fake.ops)).toEqual([]);
      const started = fake.ops.find((o) => o.table === "attempts")!;
      expect(started.params).toContain(ASSESSMENT);
      expect(started.joins.join(" ")).toContain('"hiring_stage_runs"."attempt_id" = "attempts"."id"');
    }
  });

  it.each([
    ["an in-progress link", [{ id: "l", status: "IN_PROGRESS", expiresAt: NOW }], [], "IN_PROGRESS"],
    ["a retake", [{ id: "l", status: "RETAKE_AVAILABLE", expiresAt: NOW }], [], "RETAKE_AVAILABLE"],
    ["a started attempt behind a not-started link", [{ id: "l", status: "NOT_STARTED", expiresAt: NOW }], [{ id: "t1" }], "NOT_STARTED"],
  ] as const)("lets a candidate who already started finish a closed opening: %s", async (_label, link, started, status) => {
    world.opening = { ...openOpening, status: "CLOSED" };
    const base = linkWorld([...link]);
    fake.respond = (op) => (op.table === "attempts" ? [...started] : base(op));
    const result = await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW });
    expect(result.ok).toBe(true);
    const writes = writesOf(fake.ops);
    expect(writes[0]).toMatchObject({ kind: "update", table: "assessment_links", values: { status: "EXPIRED" } });
    expect(writes[1]).toMatchObject({ kind: "insert", table: "assessment_links", values: { status } });
  });

  it("refuses an invitation of another opening or organisation, and a bad id", async () => {
    fake.respond = (op) => (op.table === "hiring_assessments" ? [] : respond(op));
    expect(await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).toEqual({ ok: false, code: "NOT_FOUND" });
    world.opening = null;
    expect(await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).toEqual({ ok: false, code: "NOT_FOUND" });
    fake.ops = [];
    expect(await newHiringLink(user, OPENING, "x", { now: NOW })).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(fake.ops).toEqual([]);
    expect(writesOf(fake.ops)).toEqual([]);
  });
});

describe("a new link or an extension answers the candidate's open new-link request (Task 7 carry)", () => {
  const invitation = { assessmentId: ASSESSMENT, versionId: VERSION, name: "Elif Kaya", email: "elif@example.com", locale: "tr" };
  function world(link: unknown[], open: unknown[]) {
    return (op: Op) => {
      if (op.kind === "select" && op.table === "hiring_assessments") return [invitation];
      if (op.kind === "select" && op.table === "assessment_links") return link;
      if (op.kind === "select" && op.table === "candidate_requests") return open;
      return respond(op);
    };
  }

  it("closes the open NEW_LINK requests of this invitation with the acting user, audited", async () => {
    fake.respond = world([{ id: "l-old", status: "NOT_STARTED", expiresAt: NOW }], [{ id: REQUEST }]);
    expect((await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).ok).toBe(true);
    const open = fake.ops.find((o) => o.table === "candidate_requests" && o.kind === "select")!;
    expect(open.where).toContain('"candidate_requests"."org_id" = $');
    expect(open.where).toContain('"candidate_requests"."handled_at" is null');
    expect(open.params).toEqual(expect.arrayContaining([ORG, ASSESSMENT, "NEW_LINK"]));
    expect(open.lock).toBe("update");
    const writes = writesOf(fake.ops);
    const closed = writes.find((w) => w.table === "candidate_requests")!;
    expect(closed).toMatchObject({ kind: "update", values: { handledBy: USER } });
    expect(closed.where).toContain('"candidate_requests"."handled_at" is null');
    expect(closed.params).toEqual(expect.arrayContaining([REQUEST, ORG]));
    const audit = writes.filter((w) => w.table === "audit_logs").map((w) => w.values as Record<string, unknown>);
    expect(audit.find((a) => a.action === "hiring.candidate.request")).toMatchObject({
      orgId: ORG,
      actorId: USER,
      subjectId: ASSESSMENT,
      meta: { openingId: OPENING, requestId: REQUEST, kind: "NEW_LINK", answeredBy: "new-link" },
    });
  });

  it("writes nothing for requests when none is open", async () => {
    fake.respond = world([{ id: "l-old", status: "NOT_STARTED", expiresAt: NOW }], []);
    await newHiringLink(user, OPENING, ASSESSMENT, { now: NOW });
    expect(writesOf(fake.ops).some((w) => w.table === "candidate_requests")).toBe(false);
  });

  it("does the same on an extension", async () => {
    fake.respond = world([{ id: "l-old", status: "EXPIRED", expiresAt: NOW }], [{ id: REQUEST }]);
    expect((await extendHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).ok).toBe(true);
    const audit = writesOf(fake.ops).filter((w) => w.table === "audit_logs").map((w) => w.values as Record<string, unknown>);
    expect(audit.find((a) => a.action === "hiring.candidate.request")).toMatchObject({ meta: { requestId: REQUEST, answeredBy: "extend" } });
  });
});

describe("extendHiringLink (ruling C8)", () => {
  const invitation = { assessmentId: ASSESSMENT };
  function linkWorld(link: unknown[]) {
    return (op: Op) => {
      if (op.kind === "select" && op.table === "hiring_assessments") return [invitation];
      if (op.kind === "select" && op.table === "assessment_links") return link;
      return respond(op);
    };
  }

  it("gives the invitation's newest link seven more days to the end of the organisation's day and lets an expired one work again, audited", async () => {
    fake.respond = linkWorld([{ id: "l1", status: "EXPIRED", expiresAt: new Date("2026-10-04T20:59:59Z") }]);
    const result = await extendHiringLink(user, OPENING, ASSESSMENT, { now: NOW });
    // From today (the old day is behind): 12 Oct, end of day in Istanbul.
    expect(result).toEqual({ ok: true, expiresAt: new Date("2026-10-12T20:59:59.000Z") });
    const writes = writesOf(fake.ops);
    expect(writes.map((w) => w.table)).toEqual(["assessment_links", "audit_logs"]);
    expect(writes[0]).toMatchObject({ kind: "update", values: { status: "NOT_STARTED", expiresAt: new Date("2026-10-12T20:59:59.000Z") } });
    expect(writes[0].params).toEqual(expect.arrayContaining(["l1", ASSESSMENT]));
    expect(writes[1].values).toMatchObject({
      orgId: ORG,
      actorId: USER,
      action: "hiring.candidate.extend",
      subjectType: "assessment",
      subjectId: ASSESSMENT,
      meta: { openingId: OPENING, linkId: "l1", from: "2026-10-04T20:59:59.000Z", to: "2026-10-12T20:59:59.000Z" },
    });
  });

  it("counts the seven days from a later last day", async () => {
    fake.respond = linkWorld([{ id: "l1", status: "NOT_STARTED", expiresAt: new Date("2026-12-01T20:59:59Z") }]);
    expect(await extendHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).toEqual({ ok: true, expiresAt: new Date("2026-12-08T20:59:59.000Z") });
  });

  it("locks the opening, the invitation of this opening and organisation, then its newest link", async () => {
    fake.respond = linkWorld([{ id: "l1", status: "NOT_STARTED", expiresAt: NOW }]);
    await extendHiringLink(user, OPENING, ASSESSMENT, { now: NOW });
    const order = fake.ops.filter((o) => o.lock).map((o) => [o.table, o.lock]);
    expect(order.slice(0, 3)).toEqual([
      ["hiring_openings", "share"],
      ["hiring_assessments", "update"],
      ["assessment_links", "update"],
    ]);
    const opening = fake.ops.find((o) => o.table === "hiring_openings")!;
    expect(opening.params).toEqual(expect.arrayContaining([OPENING, ORG]));
    const row = fake.ops.find((o) => o.table === "hiring_assessments")!;
    expect(row.where).toContain('"hiring_assessments"."org_id" = $');
    expect(row.where).toContain('"hiring_assessments"."opening_id" = $');
    expect(row.params).toEqual(expect.arrayContaining([ASSESSMENT, ORG, OPENING]));
    const actor = fake.ops.find((o) => o.table === "users")!;
    expect(actor.params).toEqual(expect.arrayContaining([USER, ORG]));
  });

  it.each([
    ["a finished candidate", [{ id: "l", status: "COMPLETED", expiresAt: NOW }], "COMPLETED"],
    ["a candidate inside the assessment", [{ id: "l", status: "IN_PROGRESS", expiresAt: NOW }], "STARTED"],
    ["a retake", [{ id: "l", status: "RETAKE_AVAILABLE", expiresAt: NOW }], "STARTED"],
    ["an invitation without a link", [], "NOT_FOUND"],
  ] as const)("refuses %s and writes nothing", async (_label, link, code) => {
    fake.respond = linkWorld([...link]);
    expect(await extendHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).toEqual({ ok: false, code });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("refuses a closed opening, another opening's or organisation's invitation, and bad ids", async () => {
    world.opening = { ...openOpening, status: "CLOSED" };
    fake.respond = linkWorld([{ id: "l", status: "NOT_STARTED", expiresAt: NOW }]);
    expect(await extendHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).toEqual({ ok: false, code: "CLOSED" });
    world.opening = { ...openOpening };
    fake.respond = (op) => (op.table === "hiring_assessments" ? [] : respond(op));
    expect(await extendHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).toEqual({ ok: false, code: "NOT_FOUND" });
    world.opening = null;
    expect(await extendHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(writesOf(fake.ops)).toEqual([]);
    fake.ops = [];
    expect(await extendHiringLink(user, "x", ASSESSMENT, { now: NOW })).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(await extendHiringLink(user, OPENING, "x", { now: NOW })).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(fake.ops).toEqual([]);
  });

  it("acts only for an active user of the organisation", async () => {
    world.actor = [];
    fake.respond = linkWorld([{ id: "l", status: "NOT_STARTED", expiresAt: NOW }]);
    await expect(extendHiringLink(user, OPENING, ASSESSMENT, { now: NOW })).rejects.toBeInstanceOf(HiringNotFound);
    expect(writesOf(fake.ops)).toEqual([]);
  });
});

describe("listOpeningCandidates", () => {
  const rows = [
    { assessmentId: "a1", candidateId: "c1", name: "Elif Kaya", email: "elif@example.com", locale: "tr", invitedAt: NOW, versionId: VERSION, extraTimePct: 25 },
    { assessmentId: "a2", candidateId: "c2", name: "Can Demir", email: "can@example.com", locale: "en", invitedAt: NOW, versionId: VERSION, extraTimePct: 0 },
  ];
  const LATER = new Date("2026-10-05T10:00:00Z");
  function world2(op: Op): unknown[] {
    if (op.table === "hiring_assessments") return rows;
    if (op.table === "assessment_links") return [{ id: "l1", assessmentId: "a1", status: "IN_PROGRESS", expiresAt: NOW, firstSeenIp: "1.2.3.4", createdAt: NOW }];
    if (op.table === "attempts") return [{ id: "t1", assessmentId: "a1", startedAt: NOW, completedAt: null }];
    if (op.table === "hiring_stage_runs") return [{ attemptId: "t1", startedAt: NOW, submittedAt: NOW, lastHeartbeatAt: LATER }];
    if (op.table === "hiring_stages") return [{ versionId: VERSION, count: 3 }];
    if (op.table === "candidate_requests") return [{ id: "r1", assessmentId: "a2", kind: "NEW_LINK", message: null, createdAt: LATER }];
    if (op.table === "deletion_requests") return [{ id: "d1", candidateId: "c2", kind: "ACCESS", message: "Verilerim", createdAt: NOW }];
    return [];
  }

  it("reads only the caller's organisation and opening", async () => {
    fake.respond = world2;
    await listOpeningCandidates(ORG, OPENING, { id: USER, runs: true, blindMode: false }, NOW);
    const read = fake.ops.find((o) => o.table === "hiring_assessments")!;
    expect(read.where).toContain('"hiring_assessments"."org_id" = $');
    expect(read.where).toContain('"hiring_assessments"."opening_id" = $');
    expect(read.params).toEqual(expect.arrayContaining([ORG, OPENING]));
    const requests = fake.ops.find((o) => o.table === "candidate_requests")!;
    expect(requests.where).toContain('"candidate_requests"."org_id" = $');
    expect(requests.where).toContain('"candidate_requests"."handled_at" is null');
    expect(requests.params).toEqual(expect.arrayContaining([ORG, "a1", "a2"]));
    const rights = fake.ops.find((o) => o.table === "deletion_requests")!;
    expect(rights.joins.join(" ")).toContain('"candidates"."org_id" = $');
    expect(rights.where).toContain('"deletion_requests"."handled_at" is null');
    expect(rights.params).toEqual(expect.arrayContaining([ORG, "c1", "c2"]));
  });

  it("shows progress, both kinds of request and the adaptation flag to someone who runs the opening", async () => {
    fake.respond = world2;
    const list = await listOpeningCandidates(ORG, OPENING, { id: USER, runs: true, blindMode: true }, NOW);
    expect(list[0]).toMatchObject({ seq: 1, name: "Elif Kaya", progress: "IN_PROGRESS", stagesDone: 1, stageCount: 3, adapted: true, requests: [], lastActivityAt: LATER });
    expect(list[1]).toMatchObject({
      seq: 2,
      name: "Can Demir",
      email: "can@example.com",
      link: null,
      adapted: false,
      requests: [
        { id: "d1", source: "DATA_RIGHTS", kind: "ACCESS", message: "Verilerim", createdAt: NOW },
        { id: "r1", source: "REQUEST", kind: "NEW_LINK", message: null, createdAt: LATER },
      ],
    });
  });

  it("hides the adaptation from a runner who is on that invitation's panel (A6), reading only the viewer's own assignments", async () => {
    fake.respond = (op) => (op.table === "hiring_assignments" ? [{ assessmentId: "a1" }] : world2(op));
    const list = await listOpeningCandidates(ORG, OPENING, { id: USER, runs: true, blindMode: false }, NOW);
    expect(list[0]).toMatchObject({ assessmentId: "a1", adapted: false });
    const read = fake.ops.find((o) => o.table === "hiring_assignments")!;
    expect(read.where).toContain('"hiring_assignments"."user_id" = $');
    expect(read.params).toEqual(expect.arrayContaining([USER, "a1", "a2"]));
    // Off the panel, the same runner sees it.
    fake.ops = [];
    fake.respond = (op) => (op.table === "hiring_assignments" ? [] : world2(op));
    expect((await listOpeningCandidates(ORG, OPENING, { id: USER, runs: true, blindMode: false }, NOW))[0]).toMatchObject({ assessmentId: "a1", adapted: true });
  });

  it("counts a candidate who opened an earlier link as opened, and shows the live link", async () => {
    const EARLIER = new Date("2026-10-01T09:00:00Z");
    const LIVE_UNTIL = new Date("2026-10-12T20:59:59Z");
    fake.respond = (op) => {
      if (op.table === "assessment_links")
        return [
          // Newest first, as the query orders them: a superseded link newer than the live one never wins.
          { id: "l-stale", assessmentId: "a1", status: "EXPIRED", expiresAt: NOW, firstSeenIp: null, createdAt: LATER },
          { id: "l-new", assessmentId: "a1", status: "NOT_STARTED", expiresAt: LIVE_UNTIL, firstSeenIp: null, createdAt: NOW },
          { id: "l-old", assessmentId: "a1", status: "EXPIRED", expiresAt: NOW, firstSeenIp: "1.2.3.4", createdAt: EARLIER },
          { id: "l-gone", assessmentId: "a2", status: "EXPIRED", expiresAt: NOW, firstSeenIp: null, createdAt: LATER },
          { id: "l-gone-old", assessmentId: "a2", status: "EXPIRED", expiresAt: EARLIER, firstSeenIp: null, createdAt: EARLIER },
        ];
      if (op.table === "attempts" || op.table === "hiring_stage_runs") return [];
      return world2(op);
    };
    const list = await listOpeningCandidates(ORG, OPENING, { id: USER, runs: true, blindMode: false }, NOW);
    expect(list[0]).toMatchObject({ progress: "OPENED", link: { id: "l-new", status: "NOT_STARTED", expiresAt: LIVE_UNTIL } });
    // Every link expired: the newest one is shown.
    expect(list[1]).toMatchObject({ progress: "EXPIRED", link: { id: "l-gone", status: "EXPIRED" } });
  });

  it("never tells a reviewer about extra time or requests, and leaves identity out of the query when blind mode is on", async () => {
    fake.respond = world2;
    const list = await listOpeningCandidates(ORG, OPENING, { id: USER, runs: false, blindMode: true }, NOW);
    expect(list.map((r) => [r.name, r.email, r.adapted, r.requests.length])).toEqual([
      [null, null, false, 0],
      [null, null, false, 0],
    ]);
    expect(JSON.stringify(list)).not.toContain("Elif");
    const read = fake.ops.find((o) => o.table === "hiring_assessments")!;
    expect(read.fields).not.toContain("name");
    expect(read.fields).not.toContain("email");
    expect(read.fields).not.toContain("extraTimePct");
    expect(fake.ops.some((o) => o.table === "candidate_requests" || o.table === "deletion_requests" || o.table === "hiring_assignments")).toBe(false);
  });

  it("shows names to a reviewer when blind mode is off, still without extra time", async () => {
    fake.respond = world2;
    const list = await listOpeningCandidates(ORG, OPENING, { id: USER, runs: false, blindMode: false }, NOW);
    expect(list.map((r) => [r.name, r.adapted])).toEqual([
      ["Elif Kaya", false],
      ["Can Demir", false],
    ]);
    expect(fake.ops.find((o) => o.table === "hiring_assessments")!.fields).not.toContain("extraTimePct");
  });

  it("answers an empty list for a bad id or an opening without candidates", async () => {
    expect(await listOpeningCandidates(ORG, "x", { id: USER, runs: true, blindMode: false }, NOW)).toEqual([]);
    expect(fake.ops).toEqual([]);
    fake.respond = () => [];
    expect(await listOpeningCandidates(ORG, OPENING, { id: USER, runs: true, blindMode: false }, NOW)).toEqual([]);
  });
});

describe("markRequestHandled", () => {
  it("closes only a request of a candidate invited to this opening of this organisation", async () => {
    fake.respond = (op) => (op.table === "users" ? [{ id: USER }] : []);
    expect(await markRequestHandled(user, OPENING, REQUEST)).toBe(false);
    expect(writesOf(fake.ops)).toEqual([]);
    const select = fake.ops.find((o) => o.table === "candidate_requests")!;
    expect(select.where).toContain('"candidate_requests"."org_id" = $');
    expect(select.where).toContain('"hiring_assessments"."opening_id" = $');
    expect(select.joins.join(" ")).toContain('"hiring_assessments"."org_id" = "candidate_requests"."org_id"');
    expect(select.params).toEqual(expect.arrayContaining([REQUEST, ORG, OPENING]));
    expect(select.lock).toBe("update");
  });

  it("records who handled it, once", async () => {
    fake.respond = (op) =>
      op.table === "users" ? [{ id: USER }] : op.kind === "select" ? [{ id: REQUEST, assessmentId: ASSESSMENT, kind: "NEW_LINK", handledAt: null }] : [{ id: REQUEST }];
    expect(await markRequestHandled(user, OPENING, REQUEST)).toBe(true);
    const writes = writesOf(fake.ops);
    expect(writes.map((w) => w.table)).toEqual(["candidate_requests", "audit_logs"]);
    expect(writes[0]).toMatchObject({ kind: "update", values: { handledBy: USER } });
    expect(writes[0].where).toContain('"candidate_requests"."handled_at" is null');
    expect(writes[0].params).toEqual(expect.arrayContaining([REQUEST, ORG]));
    expect(writes[1].values).toMatchObject({ orgId: ORG, actorId: USER, action: "hiring.candidate.request", subjectType: "assessment", subjectId: ASSESSMENT });
  });

  it("answers true without writing for a request already handled (a second click)", async () => {
    fake.respond = (op) => (op.table === "users" ? [{ id: USER }] : op.kind === "select" ? [{ id: REQUEST, assessmentId: ASSESSMENT, kind: "NEW_LINK", handledAt: NOW }] : []);
    expect(await markRequestHandled(user, OPENING, REQUEST)).toBe(true);
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("refuses an inactive or foreign user and bad ids", async () => {
    fake.respond = () => [];
    await expect(markRequestHandled(user, OPENING, REQUEST)).rejects.toBeInstanceOf(HiringNotFound);
    fake.ops = [];
    expect(await markRequestHandled(user, OPENING, "x")).toBe(false);
    expect(await markRequestHandled(user, "x", REQUEST)).toBe(false);
    expect(fake.ops).toEqual([]);
  });
});

describe("openingFunnel", () => {
  const minutes = (m: number) => new Date(NOW.getTime() + m * 60_000);
  const SENTINEL_AT = new Date("2001-02-03T04:05:06.789Z");
  type Answer = { rating: number; comment: string | null };
  /**
   * The database as the funnel reads it. `answers` are oldest first. The survey count is one
   * aggregate read; the released answers are one raw statement whose LIMIT is the released
   * count, answered here the way Postgres would (the real statement runs in verify:hiring-flow).
   */
  function funnelWorld(answers: Answer[], stages: unknown[] = [{ id: "s1", durationSeconds: 1500, graceSeconds: 0, onTimeout: "AUTO_SUBMIT" }]) {
    return (op: Op): unknown[] => {
      if (op.table === "hiring_assessments") return [{ assessmentId: "a1" }, { assessmentId: "a2" }, { assessmentId: "a3" }];
      if (op.table === "attempts")
        return [
          { assessmentId: "a1", startedAt: NOW, completedAt: minutes(20) },
          { assessmentId: "a2", startedAt: NOW, completedAt: minutes(40) },
          { assessmentId: "a3", startedAt: NOW, completedAt: null },
        ];
      if (op.table === "hiring_survey_responses") return [{ n: answers.length }];
      if (op.table === "(execute)") {
        const limit = op.params.find((p) => typeof p === "number") as number;
        const released = answers.slice(0, limit);
        const comments = released
          .filter((a) => a.comment && a.comment.trim())
          .reverse()
          .slice(0, 20)
          .map((a) => a.comment);
        // A database answering more than was asked for: the date must still not come through.
        return [{ count: released.length, average: String(released.reduce((s, a) => s + a.rating, 0) / released.length), comments, createdAt: SENTINEL_AT }];
      }
      if (op.table === "hiring_versions") return [{ id: VERSION, number: 1, status: "PUBLISHED", publishedAt: NOW, previewedAt: null, updatedAt: NOW }];
      if (op.table === "hiring_stages") return stages;
      return [];
    };
  }
  const released = () => fake.ops.find((o) => o.table === "(execute)");
  const say = (rating: number, comment: string | null = null): Answer => ({ rating, comment });

  it("counts only this organisation's opening, each invitation once", async () => {
    fake.respond = funnelWorld([]);
    const funnel = await openingFunnel(ORG, OPENING);
    expect(funnel).toMatchObject({ invited: 3, started: 3, completed: 2, medianMinutes: 30, estimateMinutes: 25, survey: { count: 0, average: null, comments: [] } });
    const read = fake.ops.find((o) => o.table === "hiring_assessments")!;
    expect(read.where).toContain('"hiring_assessments"."org_id" = $');
    expect(read.params).toEqual(expect.arrayContaining([ORG, OPENING]));
    const attemptsRead = fake.ops.find((o) => o.table === "attempts")!;
    expect(attemptsRead.params).toEqual(expect.arrayContaining(["a1", "a2", "a3"]));
    expect(attemptsRead.where).toContain('"attempts"."is_primary" = $');
    expect(fake.ops.find((o) => o.table === "hiring_versions")!.params).toEqual(expect.arrayContaining([OPENING, ORG]));
  });

  // Task 19 fix round 1, I2: the estimate the candidate was promised (C25), grace included.
  it("compares with the estimate the candidate was given: the live version's stages plus their grace", async () => {
    fake.respond = funnelWorld(
      [],
      [
        { id: "s1", durationSeconds: 600, graceSeconds: 120, onTimeout: "ALLOW_GRACE" },
        { id: "s2", durationSeconds: 900, graceSeconds: 300, onTimeout: "AUTO_SUBMIT" },
      ],
    );
    expect((await openingFunnel(ORG, OPENING)).estimateMinutes).toBe(27);
    expect(fake.ops.find((o) => o.table === "hiring_stages")!.params).toContain(VERSION);
  });

  // Task 19 fix round 1, I1 and M2: the survey is read for the opening through hiring_assessments,
  // counted and averaged in SQL, and only the oldest whole batches of five are released.
  it("reads the survey through the opening's invitations, in SQL, never by a list of ids", async () => {
    fake.respond = funnelWorld([say(5, "İyi"), say(4), say(3), say(4), say(5)]);
    await openingFunnel(ORG, OPENING);
    const count = fake.ops.find((o) => o.table === "hiring_survey_responses")!;
    expect(count.fields).toEqual(["n"]);
    expect(count.joins.join(" ")).toContain('"hiring_assessments"."assessment_id" = "hiring_survey_responses"."assessment_id"');
    expect(count.where).toContain('"hiring_assessments"."org_id" = $');
    expect(count.where).toContain('"hiring_assessments"."opening_id" = $');
    expect(count.params).toEqual(expect.arrayContaining([ORG, OPENING]));
    expect(count.params).not.toContain("a1");
    const batch = released()!;
    expect(batch.params).toEqual(expect.arrayContaining([ORG, OPENING, 5]));
    expect(batch.params).not.toContain("a1");
    expect(batch.where).toMatch(/order by r\.created_at asc, r\.assessment_id asc\s+limit \$\d+/i);
    expect(batch.where).toMatch(/avg\(rating\)/i);
    expect(batch.where).toMatch(/order by created_at desc, assessment_id desc\s+limit 20/i);
    // Fix round 2 (4): the array keeps that order explicitly.
    expect(batch.where).toMatch(/array_agg\(comment order by created_at desc, assessment_id desc\)/i);
  });

  // Fix round 2 (1): the release moment is never tied to one completion.
  it("counts only answers older than a day, in the total and in the released batch", async () => {
    fake.respond = funnelWorld([say(5, "İyi"), say(4), say(3), say(4), say(5)]);
    await openingFunnel(ORG, OPENING);
    const count = fake.ops.find((o) => o.table === "hiring_survey_responses")!;
    expect(count.where).toContain(`"hiring_survey_responses"."created_at" < now() - interval '24 hours'`);
    expect(released()!.where).toMatch(/r\.created_at < now\(\) - interval '24 hours'/);
  });

  // Fix round 2 (3): a deletion between the two reads must not show a smaller, revealing batch.
  it("waits when the batch read finds fewer answers than were released", async () => {
    const five = [say(5, "a"), say(4, "b"), say(3, "c"), say(4, "d"), say(5, "e")];
    fake.respond = (op) => {
      if (op.table === "(execute)") return [{ count: 4, average: "4", comments: ["a", "b", "c", "d"] }];
      return funnelWorld(five)(op);
    };
    expect((await openingFunnel(ORG, OPENING)).survey).toEqual({ count: 0, average: null, comments: [] });
  });

  // Fix round 2 (2): the shown order carries no time, only the seed and the words themselves.
  it("samples from the pool sorted by content, so the order the database gave changes nothing", async () => {
    const pool = ["kiraz", "Elma", "armut", "Çilek", "  incir "];
    const answers = pool.map((c) => say(4, c));
    fake.respond = funnelWorld(answers);
    const first = (await openingFunnel(ORG, OPENING)).survey.comments;
    fake.respond = funnelWorld([...answers].reverse());
    expect((await openingFunnel(ORG, OPENING)).survey.comments).toEqual(first);
    const seen: string[][] = [];
    const prng = () => () => 0.999999;
    // With a shuffle that keeps every item in place, the trio is the first three by content (code units).
    fake.respond = funnelWorld(answers);
    seen.push((await openingFunnel(ORG, OPENING, prng)).survey.comments);
    expect(seen[0]).toEqual(["Elma", "armut", "incir"]);
  });

  it("shows nothing before five answers, and asks nothing more than the count", async () => {
    fake.respond = funnelWorld([say(5, "İyi"), say(1, "Kötü"), say(2, "Uzun"), say(4, "Net")]);
    expect((await openingFunnel(ORG, OPENING)).survey).toEqual({ count: 0, average: null, comments: [] });
    expect(released()).toBeUndefined();
  });

  it("with nine answers shows the oldest five: their count, their average and their comments, trimmed", async () => {
    const oldest = [say(5, "  Akıcıydı  "), say(4), say(3, " "), say(4, "Net"), say(5, "Kısa\n")];
    fake.respond = funnelWorld([...oldest, say(1, "YENİ_1"), say(1, "YENİ_2"), say(1), say(1, "YENİ_4")]);
    const { survey } = await openingFunnel(ORG, OPENING);
    expect(survey.count).toBe(5);
    expect(survey.average).toBe(4.2);
    expect([...survey.comments].sort()).toEqual(["Akıcıydı", "Kısa", "Net"].sort());
    expect(JSON.stringify(survey)).not.toContain("YENİ");
    expect(released()!.params).toContain(5);
  });

  it("changes nothing while answers six to nine arrive, and the same answers always give the same trio", async () => {
    const first = [say(5, "a"), say(4, "b"), say(3, "c"), say(4, "d"), say(5, "e")];
    const views: string[] = [];
    for (let n = 5; n <= 9; n++) {
      fake.ops = [];
      fake.respond = funnelWorld([...first, ...Array.from({ length: n - 5 }, (_, i) => say(1, `late${i}`))]);
      views.push(JSON.stringify((await openingFunnel(ORG, OPENING)).survey));
      // A reload with the same answers.
      views.push(JSON.stringify((await openingFunnel(ORG, OPENING)).survey));
    }
    expect(new Set(views).size).toBe(1);
    expect(JSON.parse(views[0])).toMatchObject({ count: 5, average: 4.2 });
    expect(JSON.parse(views[0]).comments).toHaveLength(3);
  });

  it("releases the next batch with the tenth answer", async () => {
    const answers = Array.from({ length: 10 }, (_, i) => say(i < 5 ? 5 : 1, `c${i}`));
    fake.respond = funnelWorld(answers.slice(0, 9));
    const before = (await openingFunnel(ORG, OPENING)).survey;
    expect(released()!.params).toContain(5);
    fake.ops = [];
    fake.respond = funnelWorld(answers);
    const after = (await openingFunnel(ORG, OPENING)).survey;
    expect(before).toMatchObject({ count: 5, average: 5 });
    expect(after).toMatchObject({ count: 10, average: 3 });
    expect(released()!.params).toContain(10);
  });

  it("shuffles the comments with a seed from the opening and the released count, never by request", async () => {
    const pool = Array.from({ length: 12 }, (_, i) => say(4, `c${i}`));
    const seeds: number[] = [];
    const prng = (seed: number) => {
      seeds.push(seed);
      return () => 0;
    };
    fake.respond = funnelWorld(pool.slice(0, 10));
    await openingFunnel(ORG, OPENING, prng);
    await openingFunnel(ORG, OPENING, prng);
    expect(seeds[0]).toBe(seeds[1]);
    expect(seeds[0]).toBe(surveySeed(OPENING, 10));
    expect(surveySeed(OPENING, 10)).not.toBe(surveySeed(OPENING, 5));
    expect(surveySeed(OPENING, 10)).not.toBe(surveySeed(VERSION, 10));
  });

  it("never hands on a rating or a date per comment", async () => {
    fake.respond = funnelWorld([say(5, "İyi"), say(4), say(3, " "), say(4, "Net"), say(5, "Kısa")]);
    const { survey } = await openingFunnel(ORG, OPENING);
    expect(Object.keys(survey).sort()).toEqual(["average", "comments", "count"]);
    for (const c of survey.comments) expect(typeof c).toBe("string");
    const json = JSON.stringify(survey);
    expect(json).not.toContain("2001-02-03");
    expect(json).not.toContain(String(SENTINEL_AT.getTime()));
    expect(json).not.toContain("rating");
  });

  it("is empty for a bad id or no invitations", async () => {
    const empty = { invited: 0, started: 0, completed: 0, medianMinutes: null, estimateMinutes: null, survey: { count: 0, average: null, comments: [] } };
    expect(await openingFunnel(ORG, "x")).toEqual(empty);
    fake.respond = () => [];
    expect(await openingFunnel(ORG, OPENING)).toEqual(empty);
  });
});

describe("median", () => {
  it("is the middle value, the mean of the two middle ones, or null", () => {
    expect(median([])).toBeNull();
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 40, 20, 30])).toBe(25);
  });
});

describe("invitableOpenings", () => {
  it("lists the organisation's open openings with whether they are live, how many active evaluators they have and the minimum a decision needs", async () => {
    fake.respond = (op) => {
      if (op.table === "hiring_openings")
        return [
          { id: "o1", name: "A", deadlineAt: null, minEvaluations: 2 },
          { id: "o2", name: "B", deadlineAt: new Date("2026-10-20T20:59:59Z"), minEvaluations: 3 },
        ];
      if (op.table === "hiring_versions") return [{ openingId: "o1" }];
      if (op.table === "hiring_opening_members") return [{ openingId: "o1", count: 2 }];
      return [];
    };
    expect(await invitableOpenings(ORG)).toEqual([
      { id: "o1", name: "A", live: true, evaluators: 2, minEvaluations: 2, deadlineDay: null },
      { id: "o2", name: "B", live: false, evaluators: 0, minEvaluations: 3, deadlineDay: "2026-10-20" },
    ]);
    const read = fake.ops.find((o) => o.table === "hiring_openings")!;
    expect(read.params).toEqual(expect.arrayContaining([ORG, "OPEN"]));
    // Versions and panel users are the organisation's own too.
    const versions = fake.ops.find((o) => o.table === "hiring_versions")!;
    expect(versions.params).toEqual(expect.arrayContaining([ORG, "PUBLISHED"]));
    const members = fake.ops.find((o) => o.table === "hiring_opening_members")!;
    expect(members.joins.join(" ")).toContain('"users"."disabled_at" is null');
    expect(members.params).toEqual(expect.arrayContaining([ORG]));
  });

  it("reads nothing more when the organisation has no open opening", async () => {
    fake.respond = () => [];
    expect(await invitableOpenings(ORG)).toEqual([]);
    expect(fake.ops.map((o) => o.table)).toEqual(["hiring_openings"]);
  });
});
