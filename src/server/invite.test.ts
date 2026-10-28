import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { sha256 } from "@/lib/auth";

/**
 * createInvitation and inviteLink over a fake database: `selects` are the
 * rows each successive select returns; every insert (in or out of the
 * transaction) is recorded under its table's name. The point: the link the
 * invitation hands out once can be computed again from the stored row, while
 * the row itself only holds a hash.
 */
const state = vi.hoisted(() => ({
  selects: [] as unknown[][],
  inserts: [] as Array<{ table: string; values: Record<string, unknown> }>,
}));

vi.mock("@/db", async () => {
  const s = await import("@/db/schema");
  const names = new Map<unknown, string>([
    [s.candidates, "candidates"],
    [s.assessments, "assessments"],
    [s.examAssessments, "examAssessments"],
    [s.assessmentLinks, "assessmentLinks"],
    [s.messageOutbox, "messageOutbox"],
    [s.auditLogs, "auditLogs"],
  ]);
  const insert = (table: unknown) => {
    let values: Record<string, unknown> = {};
    const chain = {
      values: (v: Record<string, unknown>) => {
        values = v;
        state.inserts.push({ table: names.get(table) ?? "?", values: v });
        return chain;
      },
      returning: async () => [{ id: `${names.get(table)}-1`, ...values }],
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
    };
    return chain;
  };
  const where = async () => state.selects.shift() ?? [];
  return {
    db: {
      select: () => ({ from: () => ({ where, innerJoin: () => ({ where }) }) }),
      insert,
      transaction: async (fn: (tx: unknown) => unknown) => fn({ insert }),
    },
  };
});

/** Which forms of a course test each e-mail sat before (server/exam-exposure.ts), and what was asked. */
const exposure = vi.hoisted(() => ({ seen: new Map<string, Set<string>>(), asked: [] as unknown[][] }));
vi.mock("@/server/exam-exposure", () => ({
  courseFormsSeenBy: async (...args: unknown[]) => {
    exposure.asked.push(args);
    return exposure.seen;
  },
}));

import { courseBlueprint } from "@/lib/exam/course/config";
import { outboxLinkPlaceholder } from "@/lib/outbox";
import { createInvitation, examLinkToken, inviteLink, linkVerdict } from "./invite";

const SECRET = "dev-only-storage-secret";
const blueprint = { id: "bp1", orgId: "o1", name: "Yerleştirme", mode: "PLACEMENT", status: "PUBLISHED", config: {} };
const linkRow = () => state.inserts.find((i) => i.table === "assessmentLinks")!.values as { id: string; tokenHash: string; status: string; expiresAt: Date };

beforeEach(() => {
  state.selects = [];
  state.inserts = [];
  exposure.seen = new Map();
  exposure.asked = [];
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_SECRET", "");
  vi.stubEnv("APP_ORIGIN", "https://kademe.example");
});

describe("examLinkToken", () => {
  it("is a 32 byte base64url value, the same for the same row and secret", () => {
    const a = examLinkToken("11111111-1111-4111-8111-111111111111", SECRET);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(examLinkToken("11111111-1111-4111-8111-111111111111", SECRET)).toBe(a);
  });

  it("changes with the row and with the secret", () => {
    const a = examLinkToken("11111111-1111-4111-8111-111111111111", SECRET);
    expect(examLinkToken("22222222-2222-4222-8222-222222222222", SECRET)).not.toBe(a);
    expect(examLinkToken("11111111-1111-4111-8111-111111111111", "another-secret")).not.toBe(a);
  });
});

describe("createInvitation", () => {
  it("stores only the hash of a token derived from the link row, and hands out its URL", async () => {
    state.selects = [[blueprint]];
    const r = await createInvitation({ orgId: "o1", blueprintId: "bp1", fullName: "Ayşe Yılmaz", email: "ayse@ornek.com", claimedLevel: null, locale: "tr", invitedBy: "u1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const link = linkRow();
    expect(link.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.rawToken).toBe(examLinkToken(link.id, SECRET));
    expect(link.tokenHash).toBe(sha256(r.rawToken));
    // No row, the outbox included, holds the token or the link.
    expect(JSON.stringify(state.inserts)).not.toContain(r.rawToken);
    expect(JSON.stringify(state.inserts)).not.toContain("/a/");
    expect(r.url).toBe(`https://kademe.example/a/${r.rawToken}`);
    expect(r.expiresAt).toBeInstanceOf(Date);
    expect(link.expiresAt).toEqual(r.expiresAt);
    expect(state.inserts.map((i) => i.table)).toEqual(["candidates", "assessments", "examAssessments", "assessmentLinks", "messageOutbox", "auditLogs"]);
  });

  it("writes the outbox message with the invitation's placeholder where the link goes", async () => {
    state.selects = [[blueprint]];
    const r = await createInvitation({ orgId: "o1", blueprintId: "bp1", fullName: "Ayşe Yılmaz", email: "ayse@ornek.com", claimedLevel: null, locale: "tr", invitedBy: "u1" });
    if (!r.ok) throw new Error("invite failed");
    const mail = state.inserts.find((i) => i.table === "messageOutbox")!.values as { toEmail: string; subject: string; body: string };
    expect(mail.toEmail).toBe("ayse@ornek.com");
    expect(mail.subject).toBe("Almanca sınavınız: Yerleştirme");
    expect(mail.body).toContain(`Başlamak için: ${outboxLinkPlaceholder(r.assessmentId)}`);
    expect(mail.body).toContain("Merhaba Ayşe Yılmaz,");
    expect(mail.body).toContain("bilgisayarda");
    expect(mail.body).not.toContain("\u2014");
    expect(mail.body).not.toContain("https://");
  });

  it("refuses a draft and a verification exam without a claim, writing nothing", async () => {
    state.selects = [[{ ...blueprint, status: "DRAFT" }]];
    expect(await createInvitation({ orgId: "o1", blueprintId: "bp1", fullName: "A B", email: "a@b.co", claimedLevel: null, locale: "tr", invitedBy: null })).toEqual({ ok: false, code: "NOT_PUBLISHED" });
    state.selects = [[{ ...blueprint, mode: "LEVEL_VERIFICATION" }]];
    expect(await createInvitation({ orgId: "o1", blueprintId: "bp1", fullName: "A B", email: "a@b.co", claimedLevel: null, locale: "tr", invitedBy: null })).toEqual({ ok: false, code: "CLAIM_REQUIRED" });
    expect(state.inserts).toEqual([]);
  });
});

describe("createInvitation: a course test", () => {
  const course = { id: "bp-course", orgId: "o1", name: "Kurs ara sınavı B1.1", mode: "COURSE_TEST", status: "PUBLISHED", config: courseBlueprint("B1.1") };
  const invite = (over: Record<string, unknown> = {}) =>
    createInvitation({ orgId: "o1", blueprintId: "bp-course", fullName: "Ayşe Yılmaz", email: "Ayse@Ornek.com", claimedLevel: null, locale: "en", invitedBy: "u1", ...over });
  const stored = () => state.inserts.find((i) => i.table === "examAssessments")!.values as { mode: string; claimedLevel: unknown; blueprintSnapshot: { course?: { key: string; form: string | null; rules: unknown }; sections: unknown[] } };

  it("needs no claimed level and keeps none, even when one is passed", async () => {
    state.selects = [[course]];
    expect(await invite()).toMatchObject({ ok: true });
    expect(stored()).toMatchObject({ mode: "COURSE_TEST", claimedLevel: null });
    state.inserts = [];
    state.selects = [[course]];
    expect(await invite({ claimedLevel: "B2" })).toMatchObject({ ok: true });
    expect(stored().claimedLevel).toBeNull();
    const audit = state.inserts.find((i) => i.table === "auditLogs")!.values as { meta: Record<string, unknown> };
    expect(audit.meta).toMatchObject({ mode: "COURSE_TEST", claimedLevel: null, course: "B1.1" });
  });

  it("writes the form into the student's copy of the exam and leaves the published exam as it was", async () => {
    state.selects = [[course]];
    const r = await invite({ courseForm: "B" });
    expect(r).toMatchObject({ ok: true, courseForm: "B" });
    expect(stored().blueprintSnapshot.course).toEqual({ key: "B1.1", form: "B", rules: courseBlueprint("B1.1").course!.rules });
    expect(stored().blueprintSnapshot.sections).toEqual(courseBlueprint("B1.1").sections);
    expect(course.config.course!.form).toBeNull();
    // A form that was asked for needs no lookup.
    expect(exposure.asked).toEqual([]);
  });

  it("without a form gives the one the student has not seen, else A", async () => {
    const cases: Array<[string[], string]> = [
      [["A"], "B"],
      [["B"], "A"],
      [[], "A"],
      [["A", "B"], "A"],
    ];
    for (const [sat, form] of cases) {
      state.inserts = [];
      exposure.asked = [];
      exposure.seen = new Map([["ayse@ornek.com", new Set(sat)]]);
      state.selects = [[course]];
      expect(await invite()).toMatchObject({ ok: true, courseForm: form });
      expect(stored().blueprintSnapshot.course?.form).toBe(form);
      expect(exposure.asked).toEqual([["o1", ["Ayse@Ornek.com"], "B1.1"]]);
    }
  });

  it("treats a form that is not A or B as not given", async () => {
    exposure.seen = new Map([["ayse@ornek.com", new Set(["B"])]]);
    for (const bad of ["C", "a", "", null]) {
      state.inserts = [];
      state.selects = [[course]];
      expect(await invite({ courseForm: bad })).toMatchObject({ ok: true, courseForm: "A" });
    }
  });

  it("names the test in German in the mail, whatever language the exam was published in", async () => {
    state.selects = [[course]];
    await invite({ locale: "en" });
    const mail = state.inserts.find((i) => i.table === "messageOutbox")!.values as { subject: string; body: string };
    expect(mail.subject).toBe("Your German exam: Zwischentest B1.1");
    expect(mail.body).toContain('"Zwischentest B1.1"');
    state.inserts = [];
    state.selects = [[{ ...course, name: "Mid-course test B1.1" }]];
    await invite({ locale: "tr" });
    expect((state.inserts.find((i) => i.table === "messageOutbox")!.values as { subject: string }).subject).toBe("Almanca sınavınız: Zwischentest B1.1");
  });

  it("refuses a draft, and a course exam that does not say which course it is, writing nothing", async () => {
    state.selects = [[{ ...course, status: "DRAFT" }]];
    expect(await invite()).toEqual({ ok: false, code: "NOT_PUBLISHED" });
    const withoutCourse = { ...course.config };
    delete withoutCourse.course;
    state.selects = [[{ ...course, config: withoutCourse }]];
    expect(await invite()).toEqual({ ok: false, code: "BLUEPRINT_NOT_FOUND" });
    expect(state.inserts).toEqual([]);
  });

  it("leaves the other exams alone: no form, no lookup, the config as it was", async () => {
    state.selects = [[blueprint]];
    const r = await createInvitation({ orgId: "o1", blueprintId: "bp1", fullName: "Ayşe Yılmaz", email: "ayse@ornek.com", claimedLevel: null, locale: "tr", invitedBy: "u1", courseForm: "B" });
    expect(r.ok).toBe(true);
    expect("courseForm" in r).toBe(false);
    expect(exposure.asked).toEqual([]);
    expect(stored().blueprintSnapshot).toBe(blueprint.config);
  });
});

describe("without a secret (production without AUTH_SECRET)", () => {
  it("still invites, with a random token, and says the link cannot be shown again", async () => {
    vi.stubEnv("NODE_ENV", "production");
    state.selects = [[blueprint]];
    const r = await createInvitation({ orgId: "o1", blueprintId: "bp1", fullName: "Ayşe Yılmaz", email: "ayse@ornek.com", claimedLevel: null, locale: "tr", invitedBy: "u1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const link = linkRow();
    expect(link.tokenHash).toBe(sha256(r.rawToken));
    expect(r.rawToken).not.toBe(examLinkToken(link.id, SECRET));
    state.inserts = [];
    state.selects = [[{ id: link.id, tokenHash: link.tokenHash, status: "NOT_STARTED", expiresAt: link.expiresAt }]];
    expect(await inviteLink({ orgId: "o1", assessmentId: "a1", actorId: "u1" })).toEqual({ ok: false, code: "NOT_RECOVERABLE" });
    expect(state.inserts).toEqual([]);
  });
});

describe("linkVerdict", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const later = new Date("2026-10-28T12:00:00Z");
  const id = "33333333-3333-4333-8333-333333333333";
  const derived = { id, tokenHash: sha256(examLinkToken(id, SECRET)), status: "NOT_STARTED", expiresAt: later };

  it("gives the raw token back for a live derived link, also mid-exam", () => {
    expect(linkVerdict(derived, now, SECRET)).toEqual({ ok: true, raw: examLinkToken(id, SECRET) });
    expect(linkVerdict({ ...derived, status: "IN_PROGRESS" }, now, SECRET)).toMatchObject({ ok: true });
  });

  it("never shows a finished, expired or replaced link", () => {
    expect(linkVerdict({ ...derived, status: "COMPLETED" }, now, SECRET)).toEqual({ ok: false, code: "USED" });
    expect(linkVerdict({ ...derived, status: "EXPIRED" }, now, SECRET)).toEqual({ ok: false, code: "EXPIRED" });
    expect(linkVerdict({ ...derived, expiresAt: now }, now, SECRET)).toEqual({ ok: false, code: "EXPIRED" });
  });

  it("cannot recover a random token from before, or after the secret changed", () => {
    const legacy = { ...derived, tokenHash: sha256(randomBytes(32).toString("base64url")) };
    expect(linkVerdict(legacy, now, SECRET)).toEqual({ ok: false, code: "NOT_RECOVERABLE" });
    expect(linkVerdict(derived, now, "rotated")).toEqual({ ok: false, code: "NOT_RECOVERABLE" });
  });
});

describe("inviteLink", () => {
  it("returns the same URL the invitation handed out and writes the reveal to the audit log", async () => {
    state.selects = [[blueprint]];
    const made = await createInvitation({ orgId: "o1", blueprintId: "bp1", fullName: "Ayşe Yılmaz", email: "ayse@ornek.com", claimedLevel: null, locale: "tr", invitedBy: "u1" });
    if (!made.ok) throw new Error("invite failed");
    const link = linkRow();
    state.inserts = [];
    state.selects = [[{ id: link.id, tokenHash: link.tokenHash, status: "NOT_STARTED", expiresAt: link.expiresAt }]];
    const r = await inviteLink({ orgId: "o1", assessmentId: "a1", actorId: "u1" });
    expect(r).toEqual({ ok: true, url: made.url, expiresAt: link.expiresAt });
    expect(state.inserts).toEqual([{ table: "auditLogs", values: expect.objectContaining({ orgId: "o1", actorId: "u1", action: "student.link.show", subjectId: "a1" }) }]);
  });

  it("prefers the live link over replaced ones and says NOT_FOUND for nothing", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    const live = { id, tokenHash: sha256(examLinkToken(id, SECRET)), status: "NOT_STARTED", expiresAt: new Date(Date.now() + 86_400_000) };
    state.selects = [[{ ...live, id: "old", status: "EXPIRED" }, live]];
    expect(await inviteLink({ orgId: "o1", assessmentId: "a1", actorId: "u1" })).toMatchObject({ ok: true });
    state.selects = [[]];
    expect(await inviteLink({ orgId: "o1", assessmentId: "a1", actorId: "u1" })).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("writes nothing when the link cannot be shown", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    state.selects = [[{ id, tokenHash: sha256("random"), status: "NOT_STARTED", expiresAt: new Date(Date.now() + 86_400_000) }]];
    expect(await inviteLink({ orgId: "o1", assessmentId: "a1", actorId: "u1" })).toEqual({ ok: false, code: "NOT_RECOVERABLE" });
    expect(state.inserts).toEqual([]);
  });
});
