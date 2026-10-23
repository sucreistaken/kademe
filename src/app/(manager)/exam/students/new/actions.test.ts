import { beforeEach, describe, expect, it, vi } from "vitest";
import { examTemplateByKey, type ExamTemplate } from "@/lib/exam/templates";
import { orgTime } from "@/lib/exam-window";
import type { InviteStudentsInput } from "./actions";

/**
 * inviteStudentsAction (the invite wizard's "N daveti oluştur") with the
 * database, the bank and the template publisher faked. The template
 * publisher's own rules are in src/server/template-blueprint.test.ts, the
 * list's parsing in ./rows.test.ts.
 */
type Row = { id: string; orgId: string; mode: "PLACEMENT" | "LEVEL_VERIFICATION"; status: string; config: unknown; name: string };
const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  coverageOk: true,
  coverageClaims: [] as Array<string | null>,
  ensured: [] as Array<{ orgId: string; key: string; locale: string }>,
  ensureResult: null as unknown,
  invited: [] as Array<Record<string, unknown>>,
  invite: null as null | ((input: Record<string, unknown>) => unknown),
  revalidated: [] as string[],
}));

vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ where: async () => state.rows }) }) },
}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => state.revalidated.push(p) }));
vi.mock("@/server/session", () => ({
  requireUser: async () => ({ id: "u1", orgId: "o1", email: "m@x", name: "M", role: "MANAGER" }),
}));
vi.mock("@/server/panel", () => ({ bankCounts: async () => [] }));
vi.mock("@/lib/exam/blueprint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/exam/blueprint")>()),
  bankCoverage: (_c: unknown, _cfg: unknown, _mode: unknown, claim: string | null) => {
    state.coverageClaims.push(claim);
    return { ok: state.coverageOk, rows: [] };
  },
}));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "en" }));
vi.mock("@/server/invite", () => ({
  createInvitation: async (input: Record<string, unknown>) => {
    state.invited.push(input);
    if (state.invite) return state.invite(input);
    return { ok: true, url: `http://localhost:3100/a/tok-${state.invited.length}`, expiresAt: new Date("2026-10-28T10:00:00Z") };
  },
}));
vi.mock("@/server/template-blueprint", () => ({
  ensureTemplateBlueprint: async (orgId: string, _userId: string, template: ExamTemplate, locale: string) => {
    state.ensured.push({ orgId, key: template.key, locale });
    return state.ensureResult;
  },
}));

import { inviteStudentsAction } from "./actions";

const THREE = "Ayşe Yılmaz, ayse@ornek.com\nCan Demir; can@ornek.com\nDeniz Kaya <deniz@ornek.com>";
const input = (over: Partial<InviteStudentsInput> = {}): InviteStudentsInput => ({ text: THREE, exam: "template:placement", claimed: null, locale: "tr", ...over });
const published = (key: string, id = `bp-${key}`): Row => {
  const t = examTemplateByKey(key)!;
  return { id, orgId: "o1", mode: t.mode, status: "PUBLISHED", config: t.config, name: t.name.en };
};

beforeEach(() => {
  state.rows = [];
  state.coverageOk = true;
  state.coverageClaims = [];
  state.ensured = [];
  state.ensureResult = null;
  state.invited = [];
  state.invite = null;
  state.revalidated = [];
});

describe("inviteStudentsAction: the list", () => {
  it("invites every student of the list on a ready template and hands every link back", async () => {
    state.ensureResult = { ok: true, blueprint: published("placement"), created: true };
    const r = await inviteStudentsAction(input());
    expect(r).toEqual({
      ok: true,
      examName: "Placement test",
      created: [
        { line: 1, fullName: "Ayşe Yılmaz", email: "ayse@ornek.com", url: "http://localhost:3100/a/tok-1", expiresAt: "2026-10-28T10:00:00.000Z", notBefore: null },
        { line: 2, fullName: "Can Demir", email: "can@ornek.com", url: "http://localhost:3100/a/tok-2", expiresAt: "2026-10-28T10:00:00.000Z", notBefore: null },
        { line: 3, fullName: "Deniz Kaya", email: "deniz@ornek.com", url: "http://localhost:3100/a/tok-3", expiresAt: "2026-10-28T10:00:00.000Z", notBefore: null },
      ],
      failed: [],
    });
    expect(state.ensured).toEqual([{ orgId: "o1", key: "placement", locale: "en" }]);
    expect(state.invited).toHaveLength(3);
    expect(state.invited[0]).toMatchObject({ orgId: "o1", blueprintId: "bp-placement", fullName: "Ayşe Yılmaz", email: "ayse@ornek.com", claimedLevel: null, locale: "tr", invitedBy: "u1" });
    expect(state.revalidated).toEqual(["/exam/students"]);
  });

  it("parses the text again on the server and skips a spreadsheet's titles", async () => {
    state.ensureResult = { ok: true, blueprint: published("placement"), created: false };
    const r = await inviteStudentsAction(input({ text: "Ad Soyad;E-posta\nAyşe Yılmaz;ayse@ornek.com" }));
    expect(r).toMatchObject({ ok: true, created: [{ line: 2, fullName: "Ayşe Yılmaz" }] });
  });

  it("a list with an invalid e-mail, a duplicate or nothing in it invites nobody and publishes nothing", async () => {
    state.ensureResult = { ok: true, blueprint: published("placement"), created: true };
    expect(await inviteStudentsAction(input({ text: "Ayşe Yılmaz, ayse@ornek\nCan Demir, can@ornek.com" }))).toEqual({ ok: false, code: "LIST" });
    expect(await inviteStudentsAction(input({ text: "Ayşe Yılmaz, ayse@ornek.com\nAyşe Y., AYSE@ornek.com" }))).toEqual({ ok: false, code: "LIST" });
    expect(await inviteStudentsAction(input({ text: "  \n " }))).toEqual({ ok: false, code: "LIST" });
    expect(await inviteStudentsAction(input({ text: 42 as never }))).toEqual({ ok: false, code: "LIST" });
    expect(state.ensured).toEqual([]);
    expect(state.invited).toEqual([]);
  });

  it("one student that fails is reported on its line; the others stand", async () => {
    state.ensureResult = { ok: true, blueprint: published("placement"), created: false };
    state.invite = (i) => {
      if (i.email === "can@ornek.com") throw new Error("boom");
      if (i.email === "deniz@ornek.com") return { ok: false, code: "NOT_PUBLISHED" };
      return { ok: true, url: "http://localhost:3100/a/ok", expiresAt: new Date("2026-10-28T10:00:00Z") };
    };
    const r = await inviteStudentsAction(input());
    expect(r).toMatchObject({
      ok: true,
      created: [{ line: 1, email: "ayse@ornek.com" }],
      failed: [
        { line: 2, fullName: "Can Demir", email: "can@ornek.com", code: "GENERIC" },
        { line: 3, fullName: "Deniz Kaya", email: "deniz@ornek.com", code: "NOT_PUBLISHED" },
      ],
    });
  });
});

describe("inviteStudentsAction: the exam", () => {
  it("verification: the batch's claim for every row, a row's own level wins", async () => {
    state.ensureResult = { ok: true, blueprint: published("level-check"), created: false };
    const r = await inviteStudentsAction(input({ exam: "template:level-check", claimed: "B1", text: "Ayşe Yılmaz, ayse@ornek.com\nCan Demir, can@ornek.com, A2" }));
    expect(r).toMatchObject({ ok: true });
    expect(state.invited.map((i) => i.claimedLevel)).toEqual(["B1", "A2"]);
    // The bank is checked once per claim on the list.
    expect(state.coverageClaims.sort()).toEqual(["A2", "B1"]);
  });

  it("verification: the chosen difficulty goes to every invitation and to the bank check; a stray value is ignored", async () => {
    state.ensureResult = { ok: true, blueprint: published("level-check"), created: false };
    const shifts: unknown[] = [];
    state.invite = (i) => {
      shifts.push(i.difficultyOffset);
      return { ok: true, url: "http://localhost:3100/a/x", expiresAt: new Date("2026-10-28T10:00:00Z") };
    };
    expect(await inviteStudentsAction(input({ exam: "template:level-check", claimed: "B1", shift: -1 }))).toMatchObject({ ok: true });
    expect(shifts).toEqual([-1, -1, -1]);
    shifts.length = 0;
    expect(await inviteStudentsAction(input({ exam: "template:level-check", claimed: "B1", shift: 7 as never }))).toMatchObject({ ok: true });
    expect(shifts).toEqual([undefined, undefined, undefined]);
  });

  it("placement: a difficulty is not applied", async () => {
    state.ensureResult = { ok: true, blueprint: published("placement"), created: false };
    expect(await inviteStudentsAction(input({ shift: 1 }))).toMatchObject({ ok: true });
    expect(state.invited.map((i) => i.difficultyOffset)).toEqual([undefined, undefined, undefined]);
  });

  it("asks for the claim before publishing anything", async () => {
    expect(await inviteStudentsAction(input({ exam: "template:level-check" }))).toEqual({ ok: false, code: "CLAIM_REQUIRED" });
    expect(await inviteStudentsAction(input({ exam: "template:level-check", claimed: "Z9" }))).toEqual({ ok: false, code: "CLAIM_REQUIRED" });
    expect(state.ensured).toEqual([]);
    expect(state.invited).toEqual([]);
  });

  it("returns the template coverage error and invites nobody when the bank cannot fill it", async () => {
    state.ensureResult = { ok: false, code: "TEMPLATE_COVERAGE" };
    expect(await inviteStudentsAction(input({ exam: "template:quick-screen" }))).toEqual({ ok: false, code: "TEMPLATE_COVERAGE" });
    expect(state.invited).toEqual([]);
  });

  it("checks the bank for an existing exam too, before anyone is invited", async () => {
    state.ensureResult = { ok: true, blueprint: published("placement"), created: false };
    state.coverageOk = false;
    expect(await inviteStudentsAction(input())).toEqual({ ok: false, code: "COVERAGE" });
    expect(state.invited).toEqual([]);
  });

  it("invites on the organisation's own published exam", async () => {
    state.rows = [{ ...published("placement", "own-1"), name: "B1 Kurs Mai" }];
    const r = await inviteStudentsAction(input({ exam: "blueprint:own-1" }));
    expect(r).toMatchObject({ ok: true, examName: "B1 Kurs Mai" });
    expect(state.ensured).toEqual([]);
    expect(state.invited.every((i) => i.blueprintId === "own-1")).toBe(true);
  });

  it("refuses another organisation's exam, a draft, an unknown template and a malformed choice", async () => {
    state.rows = [{ ...published("placement", "own-1"), orgId: "o2" }];
    expect(await inviteStudentsAction(input({ exam: "blueprint:own-1" }))).toEqual({ ok: false, code: "EXAM" });
    state.rows = [{ ...published("placement", "own-1"), status: "DRAFT" }];
    expect(await inviteStudentsAction(input({ exam: "blueprint:own-1" }))).toEqual({ ok: false, code: "EXAM" });
    expect(await inviteStudentsAction(input({ exam: "template:toefl" }))).toEqual({ ok: false, code: "EXAM" });
    expect(await inviteStudentsAction(input({ exam: "own-1" }))).toEqual({ ok: false, code: "EXAM" });
    expect(await inviteStudentsAction(input({ exam: "" }))).toEqual({ ok: false, code: "EXAM" });
    expect(state.ensured).toEqual([]);
    expect(state.invited).toEqual([]);
  });

  it("an unknown screen language falls back to English", async () => {
    state.ensureResult = { ok: true, blueprint: published("placement"), created: false };
    await inviteStudentsAction(input({ locale: "fr" as never, text: "Ayşe Yılmaz, ayse@ornek.com" }));
    expect(state.invited[0]).toMatchObject({ locale: "en" });
  });

  it.each(["tr", "en", "de", "es", "ar"] as const)("passes the student's language %s on to the invitation", async (locale) => {
    state.ensureResult = { ok: true, blueprint: published("placement"), created: false };
    await inviteStudentsAction(input({ locale, text: "Ayşe Yılmaz, ayse@ornek.com" }));
    expect(state.invited[0]).toMatchObject({ locale });
  });
});

describe("inviteStudentsAction: the exam window", () => {
  const ONE = "Ayşe Yılmaz, ayse@ornek.com";
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  it("without a window: open now, last entry 14 days from now", async () => {
    state.ensureResult = { ok: true, blueprint: published("placement"), created: false };
    await inviteStudentsAction(input({ text: ONE }));
    const sent = state.invited[0] as { notBefore: Date | null; expiresAt: Date };
    expect(sent.notBefore).toBeNull();
    expect(Math.abs(sent.expiresAt.getTime() - (Date.now() + 14 * 86_400_000))).toBeLessThan(5_000);
  });

  it("stores the chosen opening and last entry on every invitation", async () => {
    state.ensureResult = { ok: true, blueprint: published("placement"), created: false };
    const r = await inviteStudentsAction(input({ window: { start: { date: day(3), time: "09:00" }, end: { date: day(6), time: "18:30" } } }));
    expect(r.ok).toBe(true);
    expect(state.invited).toHaveLength(3);
    for (const sent of state.invited as Array<{ notBefore: Date; expiresAt: Date }>) {
      expect(orgTime(sent.notBefore)).toBe("09:00");
      expect(orgTime(sent.expiresAt)).toBe("18:30");
    }
  });

  it.each([
    ["an opening in the past", { start: { date: "2020-01-01", time: "09:00" }, end: null }, "START_PAST"],
    ["a last entry before the opening", { start: { date: day(3), time: "09:00" }, end: { date: day(3), time: "09:30" } }, "END_TOO_EARLY"],
    ["a start that is not a date", { start: { date: "soon", time: "09:00" }, end: null }, "START_INVALID"],
    ["a malformed start", { start: { date: 5, time: null } as never, end: null }, "START_INVALID"],
  ])("refuses %s before anything is published or written", async (_name, window, fault) => {
    state.ensureResult = { ok: true, blueprint: published("placement"), created: false };
    expect(await inviteStudentsAction(input({ window }))).toEqual({ ok: false, code: "WINDOW", fault });
    expect(state.ensured).toEqual([]);
    expect(state.invited).toEqual([]);
  });
});
