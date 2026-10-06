import { beforeEach, describe, expect, it, vi } from "vitest";
import { examTemplateByKey, type ExamTemplate } from "@/lib/exam/templates";

/**
 * inviteStudent with the database, the bank and the template publisher faked.
 * The template publisher's own rules are in src/server/template-blueprint.test.ts.
 */
type Row = { id: string; orgId: string; mode: "PLACEMENT" | "LEVEL_VERIFICATION"; status: string; config: unknown; name: string };
const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  coverageOk: true,
  ensured: [] as Array<{ orgId: string; key: string; locale: string }>,
  ensureResult: null as unknown,
  invited: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ where: async () => state.rows }) }) },
}));
vi.mock("@/server/session", () => ({
  requireUser: async () => ({ id: "u1", orgId: "o1", email: "m@x", name: "M", role: "MANAGER" }),
}));
vi.mock("@/server/panel", () => ({ bankCounts: async () => [] }));
vi.mock("@/lib/exam/blueprint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/exam/blueprint")>()),
  bankCoverage: () => ({ ok: state.coverageOk, rows: [] }),
}));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "en" }));
vi.mock("@/server/invite", () => ({
  createInvitation: async (input: Record<string, unknown>) => {
    state.invited.push(input);
    return { ok: true, url: "http://localhost:3100/a/tok" };
  },
}));
vi.mock("@/server/template-blueprint", () => ({
  ensureTemplateBlueprint: async (orgId: string, _userId: string, template: ExamTemplate, locale: string) => {
    state.ensured.push({ orgId, key: template.key, locale });
    return state.ensureResult;
  },
}));

import { inviteStudent } from "./actions";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
const base = { fullName: "Ada Lovelace", email: "ada@example.com", locale: "tr" };
const published = (key: string, id = `bp-${key}`): Row => {
  const t = examTemplateByKey(key)!;
  return { id, orgId: "o1", mode: t.mode, status: "PUBLISHED", config: t.config, name: t.name.en };
};

beforeEach(() => {
  state.rows = [];
  state.coverageOk = true;
  state.ensured = [];
  state.ensureResult = null;
  state.invited = [];
});

describe("inviteStudent with a ready template", () => {
  it("invites on the organisation's published exam for the template", async () => {
    state.ensureResult = { ok: true, blueprint: published("placement"), created: true };
    const r = await inviteStudent(null, form({ ...base, exam: "template:placement" }));
    expect(r).toEqual({ ok: true, url: "http://localhost:3100/a/tok", name: "Ada Lovelace" });
    expect(state.ensured).toEqual([{ orgId: "o1", key: "placement", locale: "en" }]);
    expect(state.invited).toEqual([expect.objectContaining({ orgId: "o1", blueprintId: "bp-placement", claimedLevel: null, locale: "tr", invitedBy: "u1" })]);
  });

  it("keeps the claimed level for a verification template", async () => {
    state.ensureResult = { ok: true, blueprint: published("level-check"), created: false };
    const r = await inviteStudent(null, form({ ...base, exam: "template:level-check", claimed: "B1" }));
    expect(r).toMatchObject({ ok: true });
    expect(state.invited[0]).toMatchObject({ blueprintId: "bp-level-check", claimedLevel: "B1" });
  });

  it("asks for the claim before publishing anything", async () => {
    const r = await inviteStudent(null, form({ ...base, exam: "template:level-check" }));
    expect(r).toEqual({ ok: false, code: "CLAIM_REQUIRED" });
    expect(state.ensured).toEqual([]);
    expect(state.invited).toEqual([]);
  });

  it("returns the template coverage error and invites nobody when the bank cannot fill it", async () => {
    state.ensureResult = { ok: false, code: "TEMPLATE_COVERAGE" };
    const r = await inviteStudent(null, form({ ...base, exam: "template:quick-screen" }));
    expect(r).toEqual({ ok: false, code: "TEMPLATE_COVERAGE" });
    expect(state.invited).toEqual([]);
  });

  it("still checks the chosen claim's coverage on an existing template exam", async () => {
    state.ensureResult = { ok: true, blueprint: published("level-check"), created: false };
    state.coverageOk = false;
    const r = await inviteStudent(null, form({ ...base, exam: "template:level-check", claimed: "C1" }));
    expect(r).toEqual({ ok: false, code: "COVERAGE" });
    expect(state.invited).toEqual([]);
  });

  it("rejects an unknown template without publishing", async () => {
    const r = await inviteStudent(null, form({ ...base, exam: "template:toefl" }));
    expect(r).toEqual({ ok: false, code: "EXAM" });
    expect(state.ensured).toEqual([]);
  });
});

describe("inviteStudent with an own exam", () => {
  it("invites on the organisation's exam, as before", async () => {
    state.rows = [{ ...published("placement", "own-1") }];
    const r = await inviteStudent(null, form({ ...base, exam: "blueprint:own-1" }));
    expect(r).toMatchObject({ ok: true });
    expect(state.ensured).toEqual([]);
    expect(state.invited[0]).toMatchObject({ blueprintId: "own-1" });
  });

  it("refuses another organisation's exam", async () => {
    state.rows = [{ ...published("placement", "own-1"), orgId: "o2" }];
    expect(await inviteStudent(null, form({ ...base, exam: "blueprint:own-1" }))).toEqual({ ok: false, code: "EXAM" });
    expect(state.invited).toEqual([]);
  });

  it("refuses a missing or malformed choice", async () => {
    expect(await inviteStudent(null, form({ ...base }))).toEqual({ ok: false, code: "EXAM" });
    expect(await inviteStudent(null, form({ ...base, exam: "own-1" }))).toEqual({ ok: false, code: "EXAM" });
  });

  it("validates the name and email first", async () => {
    expect(await inviteStudent(null, form({ ...base, fullName: "A", exam: "template:placement" }))).toEqual({ ok: false, code: "NAME" });
    expect(await inviteStudent(null, form({ ...base, email: "nope", exam: "template:placement" }))).toEqual({ ok: false, code: "EMAIL" });
    expect(state.ensured).toEqual([]);
  });
});
