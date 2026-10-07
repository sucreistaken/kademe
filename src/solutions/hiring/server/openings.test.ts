import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { ORG_TIMEZONE, orgDay } from "@/lib/org-timezone";
import { deadlineToDate, type OpeningRulesInput } from "../rules/opening-rules";
import { customerSupport } from "../templates/roles/customer-support";
import { HiringConflict, HiringNotFound } from "./errors";
import { fake, writesOf, type Op } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));

import { createOpening, positionOptions, saveOpeningRules, setOpeningClosed, uniqueOpeningName } from "./openings";

/**
 * The new-opening position picker (HIRING-UX 5.3) on a recording fake
 * database: only the caller's organisation, never an archived position
 * (archived positions are read-only and start nothing new, HIRING-UX 4.2).
 */
const ORG = "11111111-1111-4111-8111-111111111111";
const POS_A = "22222222-2222-4222-8222-222222222222";
const POS_B = "33333333-3333-4333-8333-333333333333";
const POS_C = "44444444-4444-4444-8444-444444444444";
const ACTOR = "55555555-5555-4555-8555-555555555555";
const OPENING = "66666666-6666-4666-8666-666666666666";
const VERSION = "77777777-7777-4777-8777-777777777777";

beforeEach(() => {
  fake.ops = [];
  fake.respond = () => [];
});

describe("positionOptions", () => {
  it("reads only active positions of the caller's organisation", async () => {
    await positionOptions(ORG);
    expect(fake.ops).toHaveLength(1);
    const [op] = fake.ops;
    expect(op.kind).toBe("select");
    expect(op.table).toBe("positions");
    expect(op.where).toContain('"positions"."org_id" = $');
    expect(op.where).toContain('"positions"."archived_at" is null');
    expect(op.params).toContain(ORG);
  });

  it("summarises the profile: equal weights when the profile has at most one distinct weight", async () => {
    fake.respond = () => [
      { id: POS_A, name: "Destek", hasJobAd: true, competencyCount: 3, distinctWeights: 1 },
      { id: POS_B, name: "Satış", hasJobAd: false, competencyCount: 2, distinctWeights: 2 },
      { id: POS_C, name: "Yeni", hasJobAd: false, competencyCount: 0, distinctWeights: 0 },
    ];
    expect(await positionOptions(ORG)).toEqual([
      { id: POS_A, name: "Destek", hasJobAd: true, competencyCount: 3, weightsEqual: true },
      { id: POS_B, name: "Satış", hasJobAd: false, competencyCount: 2, weightsEqual: false },
      { id: POS_C, name: "Yeni", hasJobAd: false, competencyCount: 0, weightsEqual: true },
    ]);
  });
});

describe("createOpening", () => {
  // HIRING-UX 5.20: every start continues in the wizard's step 2 (questions).
  const respond = (op: { table: string }) =>
    op.table === "users"
      ? [{ id: ACTOR }]
      : op.table === "positions"
        ? [{ id: POS_A, name: "Destek Uzmanı", jobDescription: "Müşteri sorularını yanıtlayacak bir uzman arıyoruz." }]
        : op.table === "hiring_openings"
          ? [{ id: OPENING }]
          : op.table === "hiring_versions"
            ? [{ id: VERSION }]
            : [];

  const STEP_2 = `/hiring/openings/${OPENING}/setup#questions`;

  it("a BLANK start continues in the wizard's questions step", async () => {
    fake.respond = respond;
    const result = await createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "existing", id: POS_A }, start: "BLANK", copyFrom: null });
    expect(result).toEqual({ ok: true, openingId: OPENING, next: STEP_2 });
  });

  it("an AI start continues in the wizard's questions step too", async () => {
    fake.respond = respond;
    const result = await createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "existing", id: POS_A }, start: "AI", copyFrom: null });
    expect(result).toEqual({ ok: true, openingId: OPENING, next: STEP_2 });
  });

  it("makes the creator the decision maker and the one evaluator ('Sadece sen')", async () => {
    fake.respond = respond;
    await createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "existing", id: POS_A }, start: "BLANK", copyFrom: null });
    const opening = fake.ops.find((o) => o.kind === "insert" && o.table === "hiring_openings");
    expect(opening?.values).toMatchObject({ ownerId: ACTOR, decisionMakerId: ACTOR });
    const members = fake.ops.filter((o) => o.kind === "insert" && o.table === "hiring_opening_members");
    expect(members).toHaveLength(1);
    expect(members[0].values).toEqual({ openingId: OPENING, userId: ACTOR });
    expect(members[0].onConflict).toEqual({ action: "nothing" });
  });

  describe("the ad step 1's AI wrote", () => {
    const AI_AD = "Sürücü kursumuza B sınıfı direksiyon eğitimi verecek bir eğitmen arıyoruz.";
    let jobDescription: string | null = null;
    const withAd = (op: Op) => (op.table === "positions" && op.kind === "select" ? [{ id: POS_A, name: "Sürüş Eğitmeni", jobDescription }] : respond(op));
    const updates = () => fake.ops.filter((o) => o.kind === "update" && o.table === "positions");

    beforeEach(() => {
      jobDescription = null;
      fake.respond = withAd;
    });

    it("refuses an AI start with no ad anywhere, before anything is written", async () => {
      expect(await createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "existing", id: POS_A }, start: "AI", copyFrom: null, jobAd: "  " })).toEqual({
        ok: false,
        code: "JOB_AD_REQUIRED",
      });
      expect(writesOf(fake.ops)).toEqual([]);
    });

    it("fills a library position that has no ad, only while it is still empty", async () => {
      const result = await createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "existing", id: POS_A }, start: "AI", copyFrom: null, jobAd: ` ${AI_AD} ` });
      expect(result).toMatchObject({ ok: true });
      expect(updates()).toHaveLength(1);
      expect((updates()[0].values as { jobDescription: string }).jobDescription).toBe(AI_AD);
      expect(updates()[0].where).toContain("btrim");
      expect(updates()[0].params).toEqual(expect.arrayContaining([POS_A, ORG]));
    });

    it("never overwrites a library position's own ad", async () => {
      jobDescription = "Kendi ilanımız, uzun ve dolu.";
      await createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "existing", id: POS_A }, start: "AI", copyFrom: null, jobAd: AI_AD });
      expect(updates()).toEqual([]);
    });

    it("gives a new position the AI ad when it brings none of its own", async () => {
      fake.respond = (op) => (op.kind === "insert" && op.table === "positions" ? [{ id: POS_B }] : respond(op));
      await createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "new", name: "Sürüş Eğitmeni", jobDescription: "" }, start: "AI", copyFrom: null, jobAd: AI_AD });
      const created = fake.ops.find((o) => o.kind === "insert" && o.table === "positions");
      expect((created?.values as { jobDescription: string }).jobDescription).toBe(AI_AD);
    });

    it("ignores the AI ad on any other start", async () => {
      await createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "existing", id: POS_A }, start: "BLANK", copyFrom: null, jobAd: AI_AD });
      expect(updates()).toEqual([]);
    });
  });
});

/**
 * A ready template (spec 2026-10-06-hiring-ready-templates-design, section 4):
 * stages, questions, links and weights in v1, an empty position filled, a
 * filled one never touched, and an unknown key refused before any write.
 */
describe("createOpening from a template", () => {
  const SCALE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const AD = "Mevcut bir iş ilanı.";
  let jobDescription: string | null;
  let profileRows: Array<{ positionId: string }>;
  let next = 0;
  const id = () => `00000000-0000-4000-8000-${(next += 1).toString(16).padStart(12, "0")}`;
  const respond = (op: Op) => {
    if (op.table === "users") return [{ id: ACTOR }];
    if (op.table === "positions" && op.kind === "select") return [{ id: POS_A, name: "Destek Uzmanı", jobDescription }];
    if (op.table === "position_competencies" && op.kind === "select") return profileRows;
    if (op.table === "rating_scales" && op.kind === "select") return [{ id: SCALE }];
    if (op.kind === "insert" && op.table === "positions") return [{ id: POS_B }];
    if (op.kind === "insert" && op.table === "hiring_openings") return [{ id: OPENING }];
    if (op.kind === "insert" && op.table === "hiring_versions") return [{ id: VERSION }];
    if (op.kind === "insert" && ["competencies", "hiring_stages", "hiring_activities"].includes(op.table)) return [{ id: id() }];
    return [];
  };
  const start = (over: Partial<Parameters<typeof createOpening>[1]> = {}) =>
    createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "existing", id: POS_A }, start: "TEMPLATE", copyFrom: null, templateKey: "customer-support", ...over });
  const inserts = (table: string) => fake.ops.filter((o) => o.kind === "insert" && o.table === table);
  const rowsOf = (op: Op | undefined) => (Array.isArray(op?.values) ? (op.values as unknown[]) : op ? [op.values] : []);

  beforeEach(() => {
    jobDescription = AD;
    profileRows = [];
    next = 0;
    fake.respond = respond;
  });

  it("refuses an unknown template before anything is written", async () => {
    expect(await start({ templateKey: "no-such-role" })).toEqual({ ok: false, code: "TEMPLATE_NOT_FOUND" });
    expect(await start({ templateKey: null })).toEqual({ ok: false, code: "TEMPLATE_NOT_FOUND" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("writes the template's stages, questions, links and weights into v1 and continues in the wizard", async () => {
    const result = await start();
    expect(result).toEqual({ ok: true, openingId: OPENING, next: `/hiring/openings/${OPENING}/setup#questions` });
    expect(inserts("hiring_stages")).toHaveLength(2);
    expect(inserts("hiring_stages").every((o) => (o.values as { versionId: string }).versionId === VERSION)).toBe(true);
    expect(inserts("hiring_activities")).toHaveLength(5);
    // Only the four open questions measure competencies; the choice question links none.
    expect(inserts("hiring_activity_competencies")).toHaveLength(4);
    const version = inserts("hiring_versions")[0].values as { weightsEnabled: boolean; draftWeights: Record<string, number> };
    expect(version.weightsEnabled).toBe(true);
    expect(Object.values(version.draftWeights)).toHaveLength(3);
    expect(Object.values(version.draftWeights).reduce((s, w) => s + w, 0)).toBe(100);
    // Every weighted competency is one the organisation now has.
    const created = inserts("competencies").length;
    expect(created).toBe(3);
    const audit = inserts("audit_logs").find((o) => (o.values as { action: string }).action === "hiring.opening.create");
    expect((audit?.values as { meta: Record<string, unknown> }).meta).toEqual({ positionId: POS_A, start: "TEMPLATE", copyFrom: null, templateKey: "customer-support" });
  });

  it("leaves a position with a job ad alone, and fills an empty one exactly once", async () => {
    await start();
    expect(fake.ops.filter((o) => o.kind === "update" && o.table === "positions")).toEqual([]);

    fake.ops = [];
    jobDescription = "   ";
    await start();
    const updates = fake.ops.filter((o) => o.kind === "update" && o.table === "positions");
    expect(updates).toHaveLength(1);
    expect((updates[0].values as { jobDescription: string }).jobDescription).toContain("Müşteri Destek Uzmanı");
    expect(updates[0].where).toContain('"positions"."org_id" = $');
    expect(updates[0].where).toContain("btrim");
    expect(updates[0].params).toEqual(expect.arrayContaining([POS_A, ORG]));
  });

  it("gives a position without a profile the template weights, highest first, and leaves a profile alone", async () => {
    await start();
    const profile = rowsOf(inserts("position_competencies")[0]) as Array<{ positionId: string; weight: number; orderIndex: number }>;
    expect(profile.map((r) => [r.weight, r.orderIndex])).toEqual([
      [40, 0],
      [35, 1],
      [25, 2],
    ]);
    expect(profile.every((r) => r.positionId === POS_A)).toBe(true);
    // Two openings started at once on one position: the second profile write is a no-op, not a primary-key error.
    expect(inserts("position_competencies")[0].onConflict).toEqual({ action: "nothing" });
    const weights = (inserts("hiring_versions")[0].values as { draftWeights: Record<string, number> }).draftWeights;
    expect(Object.fromEntries(profile.map((r) => [(r as unknown as { competencyId: string }).competencyId, r.weight]))).toEqual(weights);

    fake.ops = [];
    profileRows = [{ positionId: POS_A }];
    await start();
    expect(inserts("position_competencies")).toEqual([]);
  });

  it("creates a new position with the template's job ad when none was written", async () => {
    await start({ position: { kind: "new", name: "Destek", jobDescription: "  " } });
    const position = inserts("positions")[0].values as { jobDescription: string | null };
    expect(position.jobDescription).toBe(customerSupport.jobAd[DEFAULT_LOCALE]);
    // A new position has no profile to read: it gets the template weights.
    const profile = rowsOf(inserts("position_competencies")[0]) as Array<{ positionId: string }>;
    expect(profile).toHaveLength(3);
    expect(profile.every((r) => r.positionId === POS_B)).toBe(true);
    expect(fake.ops.filter((o) => o.table === "positions" && o.kind === "update")).toEqual([]);
  });

  it("keeps a new position's own job ad", async () => {
    await start({ position: { kind: "new", name: "Destek", jobDescription: "Kendi ilanımız." } });
    expect((inserts("positions")[0].values as { jobDescription: string }).jobDescription).toBe("Kendi ilanımız.");
  });

  it("writes no template content for the old starts", async () => {
    await createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "existing", id: POS_A }, start: "BLANK", copyFrom: null, templateKey: "customer-support" });
    expect(inserts("hiring_stages")).toEqual([]);
    expect(inserts("competencies")).toEqual([]);
    const audit = inserts("audit_logs")[0].values as { meta: Record<string, unknown> };
    expect(audit.meta).toEqual({ positionId: POS_A, start: "BLANK", copyFrom: null, templateKey: null });
  });
});

describe("uniqueOpeningName", () => {
  it("keeps a free name", () => {
    expect(uniqueOpeningName("Destek Uzmanı · Ekim", ["Satış · Ekim"])).toBe("Destek Uzmanı · Ekim");
  });

  it("numbers a taken name from (2), filling the first gap", () => {
    expect(uniqueOpeningName("Destek · Ekim", ["Destek · Ekim"])).toBe("Destek · Ekim (2)");
    expect(uniqueOpeningName("Destek · Ekim", ["Destek · Ekim", "Destek · Ekim (2)"])).toBe("Destek · Ekim (3)");
    expect(uniqueOpeningName("Destek · Ekim", ["Destek · Ekim", "Destek · Ekim (3)"])).toBe("Destek · Ekim (2)");
  });

  it("ignores names that only start the same way", () => {
    expect(uniqueOpeningName("Destek · Ekim", ["Destek · Ekim kıdemli", "Destek · Ekim (x)"])).toBe("Destek · Ekim");
  });
});

describe("createOpening naming", () => {
  it("reads the organisation's names and appends (2) to a duplicate", async () => {
    fake.respond = (op) =>
      op.table === "users"
        ? [{ id: ACTOR }]
        : op.table === "positions"
          ? [{ id: POS_A, name: "Destek Uzmanı", jobDescription: null }]
          : op.table === "hiring_openings" && op.kind === "select"
            ? [{ name: `Destek Uzmanı · ${new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: ORG_TIMEZONE }).format(new Date())}` }]
            : op.table === "hiring_openings"
              ? [{ id: OPENING }]
              : op.table === "hiring_versions"
                ? [{ id: VERSION }]
                : [];
    await createOpening({ id: ACTOR, orgId: ORG }, { position: { kind: "existing", id: POS_A }, start: "BLANK", copyFrom: null });
    const names = fake.ops.find((o) => o.table === "hiring_openings" && o.kind === "select");
    expect(names?.where).toContain('"hiring_openings"."org_id" = $');
    expect(names?.params).toContain(ORG);
    const insert = fake.ops.find((o) => o.table === "hiring_openings" && o.kind === "insert");
    expect((insert?.values as { name: string }).name).toMatch(/^Destek Uzmanı · \S+ \(2\)$/);
  });
});

describe("createOpening month", () => {
  // Review minor 11: the name is the organisation's label, so its month is in the
  // organisation's language (DEFAULT_LOCALE; there is no per-organisation locale
  // column), not in the language of whoever happened to create it.
  it("names the month in the organisation's language, whatever the creator's language", async () => {
    fake.respond = (op) =>
      op.table === "users"
        ? [{ id: ACTOR }]
        : op.table === "positions"
          ? [{ id: POS_A, name: "Destek Uzmanı", jobDescription: null }]
          : op.table === "hiring_openings" && op.kind === "insert"
            ? [{ id: OPENING }]
            : op.table === "hiring_versions"
              ? [{ id: VERSION }]
              : [];
    const englishCreator = { position: { kind: "existing", id: POS_A }, start: "BLANK", copyFrom: null, locale: "en" } as unknown as Parameters<typeof createOpening>[1];
    await createOpening({ id: ACTOR, orgId: ORG }, englishCreator);
    const insert = fake.ops.find((o) => o.table === "hiring_openings" && o.kind === "insert");
    const month = new Intl.DateTimeFormat(DEFAULT_LOCALE === "tr" ? "tr-TR" : "en-GB", { month: "long", timeZone: ORG_TIMEZONE }).format(new Date());
    expect((insert?.values as { name: string }).name).toBe(`Destek Uzmanı · ${month}`);
  });
});

/**
 * HIRING-UX 5.18 "Kaydet" on the fake database (Task 20, carries 1 and 5):
 * the rules run on the server against the organisation's own users, a
 * refusal writes nothing, a closed opening is history, and every write is
 * scoped to the caller's organisation and audited.
 */
describe("saveOpeningRules", () => {
  const OWNER = ACTOR;
  const MANAGER = "88888888-8888-4888-8888-888888888888";
  const REVIEWER = "99999999-9999-4999-8999-999999999999";
  const DISABLED = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const FOREIGN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const panel = [
    { id: OWNER, name: "Sahip", email: "o@x.test", role: "OWNER", lastLoginAt: null, disabledAt: null },
    { id: MANAGER, name: "Yönetici", email: "m@x.test", role: "MANAGER", lastLoginAt: null, disabledAt: null },
    { id: REVIEWER, name: "Değerlendirici", email: "r@x.test", role: "REVIEWER", lastLoginAt: null, disabledAt: null },
    { id: DISABLED, name: "Ayrıldı", email: "d@x.test", role: "MANAGER", lastLoginAt: null, disabledAt: new Date("2026-01-01T00:00:00Z") },
  ];
  const input = (over: Partial<OpeningRulesInput> = {}): OpeningRulesInput => ({
    name: "  Tasarımcı · Ekim  ",
    memberIds: [REVIEWER, MANAGER, REVIEWER],
    decisionMakerId: OWNER,
    backupDecisionMakerId: MANAGER,
    blindMode: true,
    deadline: null,
    feedbackDays: 7,
    candidateContactEmail: " ik@example.com ",
    ...over,
  });
  let status: "DRAFT" | "OPEN" | "CLOSED" | null;
  let actorActive: boolean;
  let savedDeadlineAt: Date | null;
  let takenNames: Array<{ name: string }>;
  const respond = (op: Op) => {
    // The locked read of the opening itself, then the organisation's other names (a rename stays unique).
    if (op.table === "hiring_openings" && op.kind === "select") return op.lock ? (status ? [{ id: OPENING, status, positionId: POS_A, deadlineAt: savedDeadlineAt }] : []) : takenNames;
    if (op.table === "users") {
      // assertActiveUser asks for one active user; loadPanelUsers for the whole organisation.
      if (op.where.includes('"users"."disabled_at" is null')) return actorActive ? [{ id: OWNER }] : [];
      return panel;
    }
    return [];
  };
  beforeEach(() => {
    status = "DRAFT";
    actorActive = true;
    savedDeadlineAt = null;
    takenNames = [];
    fake.respond = respond;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves the rules, the panel (once per person) and an audit row, all in the caller's organisation", async () => {
    const result = await saveOpeningRules(ORG, OWNER, OPENING, input({ deadline: "2099-10-31" }));
    expect(result).toEqual({ ok: true, name: "Tasarımcı · Ekim" });

    const lock = fake.ops.find((o) => o.table === "hiring_openings" && o.kind === "select");
    expect(lock?.lock).toBe("update");
    expect(lock?.where).toContain('"hiring_openings"."org_id" = $');
    expect(lock?.params).toEqual(expect.arrayContaining([OPENING, ORG]));
    const people = fake.ops.filter((o) => o.table === "users");
    expect(people.length).toBeGreaterThan(0);
    for (const read of people) {
      expect(read.where).toContain('"users"."org_id" = $');
      expect(read.params).toContain(ORG);
    }

    const writes = writesOf(fake.ops);
    expect(writes.map((w) => `${w.kind} ${w.table}`)).toEqual([
      "update hiring_openings",
      "delete hiring_opening_members",
      "insert hiring_opening_members",
      "insert audit_logs",
    ]);
    const [update, remove, insert, audit] = writes;
    expect(update.where).toContain('"hiring_openings"."org_id" = $');
    expect(update.params).toEqual(expect.arrayContaining([OPENING, ORG]));
    expect(update.values).toMatchObject({
      name: "Tasarımcı · Ekim",
      decisionMakerId: OWNER,
      backupDecisionMakerId: MANAGER,
      blindMode: true,
      deadlineAt: deadlineToDate("2099-10-31"),
      feedbackDays: 7,
      candidateContactEmail: "ik@example.com",
    });
    // The "at least N evaluators" rule is gone: a save never touches the stored minimum.
    expect(update.values).not.toHaveProperty("minEvaluations");
    expect(remove.params).toEqual([OPENING]);
    expect(insert.values).toEqual([
      { openingId: OPENING, userId: REVIEWER },
      { openingId: OPENING, userId: MANAGER },
    ]);
    expect(audit.values).toMatchObject({
      orgId: ORG,
      actorId: OWNER,
      action: "hiring.opening.rules",
      subjectType: "hiring_opening",
      subjectId: OPENING,
      meta: {
        name: "Tasarımcı · Ekim",
        members: [REVIEWER, MANAGER],
        decisionMakerId: OWNER,
        backupDecisionMakerId: MANAGER,
        blindMode: true,
        candidateContactEmail: "ik@example.com",
      },
    });
    expect((audit.values as { meta: object }).meta).not.toHaveProperty("minEvaluations");
  });

  it("stores no deadline and no address when they are empty, and clears the panel when nobody is ticked", async () => {
    await saveOpeningRules(ORG, OWNER, OPENING, input({ memberIds: [], deadline: null, candidateContactEmail: "  " }));
    const writes = writesOf(fake.ops);
    expect(writes.map((w) => `${w.kind} ${w.table}`)).toEqual(["update hiring_openings", "delete hiring_opening_members", "insert audit_logs"]);
    expect(writes[0].values).toMatchObject({ deadlineAt: null, candidateContactEmail: null });
  });

  it("refuses with the problems and writes nothing", async () => {
    const result = await saveOpeningRules(ORG, OWNER, OPENING, input({ decisionMakerId: REVIEWER, backupDecisionMakerId: REVIEWER, candidateContactEmail: "ik@" }));
    expect(result).toEqual({ ok: false, problems: ["DECISION_MAKER_ROLE", "BACKUP_SAME", "EMAIL"] });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("never trusts the client about people: another organisation's user or a disabled one is refused", async () => {
    expect(await saveOpeningRules(ORG, OWNER, OPENING, input({ memberIds: [FOREIGN] }))).toEqual({ ok: false, problems: ["MEMBER_UNKNOWN"] });
    expect(await saveOpeningRules(ORG, OWNER, OPENING, input({ decisionMakerId: FOREIGN }))).toEqual({ ok: false, problems: ["DECISION_MAKER_ROLE"] });
    expect(await saveOpeningRules(ORG, OWNER, OPENING, input({ backupDecisionMakerId: DISABLED }))).toEqual({ ok: false, problems: ["BACKUP_ROLE"] });
    expect(await saveOpeningRules(ORG, OWNER, OPENING, input({ memberIds: [DISABLED] }))).toEqual({ ok: false, problems: ["MEMBER_UNKNOWN"] });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("judges a past deadline by the organisation's day, not the server's", async () => {
    // 21:30 UTC: in a zone east of UTC (the Istanbul default) the next day has already begun.
    vi.useFakeTimers({ now: new Date("2026-10-04T21:30:00Z"), toFake: ["Date"] });
    const today = orgDay();
    const yesterday = orgDay(new Date(Date.now() - 24 * 3600 * 1000));
    expect(await saveOpeningRules(ORG, OWNER, OPENING, input({ deadline: yesterday }))).toEqual({ ok: false, problems: ["DEADLINE_PAST"] });
    expect(await saveOpeningRules(ORG, OWNER, OPENING, input({ deadline: today }))).toMatchObject({ ok: true });
  });

  // Fix round 1, Important 1: the stored day is read in the locked select; a passed deadline blocks only a change.
  it("saves a team change while a passed deadline stays as it was, and refuses moving it to another past day", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-04T12:00:00Z"), toFake: ["Date"] });
    savedDeadlineAt = deadlineToDate("2026-10-01");
    expect(await saveOpeningRules(ORG, OWNER, OPENING, input({ deadline: "2026-10-01", memberIds: [REVIEWER] }))).toMatchObject({ ok: true });
    const update = writesOf(fake.ops).find((w) => w.kind === "update");
    expect((update?.values as { deadlineAt: Date }).deadlineAt).toEqual(savedDeadlineAt);
    fake.ops = [];
    expect(await saveOpeningRules(ORG, OWNER, OPENING, input({ deadline: "2026-10-02" }))).toEqual({ ok: false, problems: ["DEADLINE_PAST"] });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  // Minor 5: the people are read through the transaction, after the opening is locked.
  it("reads the organisation's people after the lock", async () => {
    await saveOpeningRules(ORG, OWNER, OPENING, input());
    const lockAt = fake.ops.findIndex((o) => o.table === "hiring_openings" && o.lock === "update");
    const peopleAt = fake.ops.findIndex((o) => o.table === "users" && !o.where.includes("disabled_at"));
    expect(lockAt).toBeGreaterThanOrEqual(0);
    expect(peopleAt).toBeGreaterThan(lockAt);
  });

  // Minor 9: a rename never takes another opening's name in the organisation.
  it("numbers a renamed opening whose name another opening of the organisation already has", async () => {
    takenNames = [{ name: "Tasarımcı · Ekim" }];
    expect(await saveOpeningRules(ORG, OWNER, OPENING, input())).toEqual({ ok: true, name: "Tasarımcı · Ekim (2)" });
    const names = fake.ops.find((o) => o.table === "hiring_openings" && o.kind === "select" && !o.lock);
    expect(names?.where).toContain('"hiring_openings"."org_id" = $');
    expect(names?.where).toContain('"hiring_openings"."id" <> $');
    expect(names?.params).toEqual(expect.arrayContaining([ORG, OPENING]));
    const update = writesOf(fake.ops).find((w) => w.kind === "update");
    expect(update?.values).toMatchObject({ name: "Tasarımcı · Ekim (2)" });
  });

  it("saves the finish survey switch when the form sends it, and leaves it alone when it does not", async () => {
    await saveOpeningRules(ORG, OWNER, OPENING, input({ finishSurveyEnabled: false }));
    expect(writesOf(fake.ops)[0].values).toMatchObject({ finishSurveyEnabled: false });
    expect((writesOf(fake.ops).at(-1)!.values as { meta: Record<string, unknown> }).meta).toMatchObject({ finishSurveyEnabled: false });
    fake.ops = [];
    await saveOpeningRules(ORG, OWNER, OPENING, input({ finishSurveyEnabled: true }));
    expect(writesOf(fake.ops)[0].values).toMatchObject({ finishSurveyEnabled: true });
    fake.ops = [];
    await saveOpeningRules(ORG, OWNER, OPENING, input());
    expect(writesOf(fake.ops)[0].values).not.toHaveProperty("finishSurveyEnabled");
    expect((writesOf(fake.ops).at(-1)!.values as { meta: Record<string, unknown> }).meta).not.toHaveProperty("finishSurveyEnabled");
  });

  it("refuses a closed opening (history is read-only) before looking at the rules", async () => {
    status = "CLOSED";
    await expect(saveOpeningRules(ORG, OWNER, OPENING, input({ decisionMakerId: null }))).rejects.toEqual(new HiringConflict("CLOSED"));
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("answers not found for an opening of another organisation, and for a disabled actor", async () => {
    status = null;
    await expect(saveOpeningRules(ORG, OWNER, OPENING, input())).rejects.toBeInstanceOf(HiringNotFound);
    status = "OPEN";
    actorActive = false;
    await expect(saveOpeningRules(ORG, OWNER, OPENING, input())).rejects.toBeInstanceOf(HiringNotFound);
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("answers not found for a malformed opening id without a statement", async () => {
    await expect(saveOpeningRules(ORG, OWNER, "not-a-uuid", input())).rejects.toBeInstanceOf(HiringNotFound);
    expect(fake.ops.filter((o) => o.table === "hiring_openings")).toEqual([]);
  });
});

describe("setOpeningClosed", () => {
  let status: "DRAFT" | "OPEN" | "CLOSED" | null;
  let versions: Array<{ id: string; number: number; status: "DRAFT" | "PUBLISHED"; publishedAt: Date | null; previewedAt: Date | null }>;
  beforeEach(() => {
    status = "OPEN";
    versions = [];
    fake.respond = (op) =>
      op.table === "hiring_openings" && op.kind === "select"
        ? status
          ? [{ id: OPENING, status }]
          : []
        : op.table === "users"
          ? [{ id: ACTOR }]
          : op.table === "hiring_versions"
            ? versions
            : [];
  });

  it("closes an opening in the caller's organisation and audits it", async () => {
    await setOpeningClosed(ORG, ACTOR, OPENING, true);
    const lock = fake.ops.find((o) => o.table === "hiring_openings" && o.kind === "select");
    expect(lock?.lock).toBe("update");
    expect(lock?.params).toEqual(expect.arrayContaining([OPENING, ORG]));
    const writes = writesOf(fake.ops);
    expect(writes.map((w) => `${w.kind} ${w.table}`)).toEqual(["update hiring_openings", "insert audit_logs"]);
    expect(writes[0].where).toContain('"hiring_openings"."org_id" = $');
    expect(writes[0].values).toMatchObject({ status: "CLOSED", closedAt: expect.any(Date) });
    expect(writes[1].values).toMatchObject({ orgId: ORG, actorId: ACTOR, action: "hiring.opening.close", subjectId: OPENING });
  });

  it("reopens as OPEN when a version is published, else as DRAFT, and audits the reopen", async () => {
    status = "CLOSED";
    versions = [
      { id: VERSION, number: 2, status: "DRAFT", publishedAt: null, previewedAt: null },
      { id: "12121212-1212-4212-8212-121212121212", number: 1, status: "PUBLISHED", publishedAt: new Date(), previewedAt: null },
    ];
    await setOpeningClosed(ORG, ACTOR, OPENING, false);
    let writes = writesOf(fake.ops);
    expect(writes[0].values).toMatchObject({ status: "OPEN", closedAt: null });
    expect(writes[1].values).toMatchObject({ action: "hiring.opening.reopen" });
    const read = fake.ops.find((o) => o.table === "hiring_versions");
    expect(read?.params).toEqual(expect.arrayContaining([OPENING, ORG]));

    fake.ops = [];
    versions = [{ id: VERSION, number: 1, status: "DRAFT", publishedAt: null, previewedAt: null }];
    await setOpeningClosed(ORG, ACTOR, OPENING, false);
    writes = writesOf(fake.ops);
    expect(writes[0].values).toMatchObject({ status: "DRAFT", closedAt: null });
  });

  it("does nothing (and audits nothing) when the opening is already in the asked state", async () => {
    status = "CLOSED";
    await setOpeningClosed(ORG, ACTOR, OPENING, true);
    status = "DRAFT";
    await setOpeningClosed(ORG, ACTOR, OPENING, false);
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("answers not found for an opening of another organisation", async () => {
    status = null;
    await expect(setOpeningClosed(ORG, ACTOR, OPENING, true)).rejects.toBeInstanceOf(HiringNotFound);
    expect(writesOf(fake.ops)).toEqual([]);
  });
});
