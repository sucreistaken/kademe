import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { sha256 } from "@/lib/auth";

/**
 * webCheckPlacement over a stand-in database (test-fake-db): the owner lookup
 * and the e-mail's recent web checks resolve the queued rows in order. The
 * template and the invitation are mocked; their own tests cover them.
 */
const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => ({ db: (await import("@/server/create/test-fake-db")).proxyDb(fake) }));

const h = vi.hoisted(() => ({
  ensure: vi.fn(),
  invite: vi.fn(),
}));
vi.mock("@/server/template-blueprint", () => ({ ensureTemplateBlueprint: (...args: unknown[]) => h.ensure(...args) }));
vi.mock("@/server/invite", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/invite")>()),
  createInvitation: (...args: unknown[]) => h.invite(...args),
}));

import { examLinkToken } from "@/server/invite";
import { webCheckTemplate } from "@/lib/exam/templates";
import type { PublicPlacementRequest } from "@/solutions/types";
import { oneAtATime, visitExtra, WEB_CHECK_DAILY_CAP, webCheckPlacement } from "./public-placement";

const SECRET = "dev-only-storage-secret";
const NOW = new Date("2026-11-09T10:00:00.000Z");
const LATER = new Date("2026-11-12T10:00:00.000Z");

const request = (over: Partial<PublicPlacementRequest> = {}): PublicPlacementRequest => ({
  fullName: "Ada Lovelace",
  email: "Ada@Example.com",
  phone: "+49 30 1234567",
  locale: "de",
  crmLeadId: "lead-7",
  utm: { source: "instagram", campaign: "autumn" },
  ...over,
});

/** A link row as recentWebChecks returns it; derived from its id like every link since 2026-10. */
const link = (n: number, status: string, over: Record<string, unknown> = {}) => {
  const id = `00000000-0000-4000-8000-00000000000${n}`;
  return { assessmentId: `a${n}`, id, tokenHash: sha256(examLinkToken(id, SECRET)), status, expiresAt: LATER, ...over };
};

const OWNER = [{ orgId: "o1" }];
const wheres = () => fake.calls.filter(([m]) => m === "where").map(([, a]) => new PgDialect().sqlToQuery(a[0] as SQL));

beforeEach(() => {
  fake.results = [];
  fake.calls = [];
  h.ensure.mockReset();
  h.ensure.mockResolvedValue({ ok: true, blueprint: { id: "bp-web" }, created: false });
  h.invite.mockReset();
  h.invite.mockResolvedValue({ ok: true, url: "https://kademe.example/a/new-token", expiresAt: LATER });
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_SECRET", "");
  vi.stubEnv("APP_ORIGIN", "https://kademe.example");
});

describe("webCheckPlacement: the same e-mail within 24 hours", () => {
  it("gets its open link back, and nothing is published or invited", async () => {
    fake.results = [OWNER, [link(1, "NOT_STARTED")]];
    const r = await webCheckPlacement(request(), NOW);
    expect(r).toEqual({ ok: true, url: `https://kademe.example/a/${examLinkToken(link(1, "x").id, SECRET)}`, expiresAt: LATER, reused: true });
    expect(h.ensure).not.toHaveBeenCalled();
    expect(h.invite).not.toHaveBeenCalled();
  });

  it("also mid-exam: an in-progress link is the one to continue", async () => {
    fake.results = [OWNER, [link(1, "IN_PROGRESS")]];
    expect(await webCheckPlacement(request(), NOW)).toMatchObject({ ok: true, reused: true });
  });

  it("skips a finished, expired or unrecoverable link and invites again", async () => {
    fake.results = [OWNER, [link(1, "COMPLETED"), link(2, "EXPIRED"), link(3, "NOT_STARTED", { tokenHash: "random-token-hash" }), link(4, "NOT_STARTED", { expiresAt: NOW })]];
    // Four rows, but the cap counts invitations; make two of them the same one.
    fake.results[1] = (fake.results[1] as Array<Record<string, unknown>>).map((r, i) => ({ ...r, assessmentId: i < 2 ? "a1" : "a2" }));
    const r = await webCheckPlacement(request(), NOW);
    expect(r).toEqual({ ok: true, url: "https://kademe.example/a/new-token", expiresAt: LATER, reused: false });
    expect(h.invite).toHaveBeenCalledTimes(1);
  });

  it("asks only for this organisation's web checks of this e-mail (any case) made in the last 24 hours", async () => {
    fake.results = [OWNER, []];
    await webCheckPlacement(request(), NOW);
    const [owner, recent] = wheres();
    expect(owner.sql).toMatch(/"users"\."role" = \$1 and "users"\."disabled_at" is null/);
    expect(owner.params).toEqual(["OWNER"]);
    expect(recent.sql).toContain('lower("candidates"."email") = $2');
    expect(recent.sql).toContain('"candidates"."deleted_at" is null');
    expect(recent.sql).toContain('"assessments"."created_at" >= $');
    expect(recent.sql).toContain('"exam_blueprints"."template_key" = $');
    expect(recent.params).toEqual(["o1", "ada@example.com", "o1", "LANGUAGE_EXAM", new Date(NOW.getTime() - 24 * 3_600_000).toISOString(), "web-check"]);
  });
});

describe("webCheckPlacement: a new invitation", () => {
  it("publishes the web check without a manager and invites for three days with the visit's details", async () => {
    fake.results = [OWNER, []];
    const r = await webCheckPlacement(request(), NOW);
    expect(r).toMatchObject({ ok: true, reused: false });
    const [orgId, userId, template, locale] = h.ensure.mock.calls[0];
    expect([orgId, userId, locale]).toEqual(["o1", null, "tr"]);
    expect(template).toEqual(webCheckTemplate());
    expect(h.invite).toHaveBeenCalledWith({
      orgId: "o1",
      blueprintId: "bp-web",
      fullName: "Ada Lovelace",
      email: "Ada@Example.com",
      claimedLevel: null,
      locale: "de",
      invitedBy: null,
      ttlDays: 3,
      phone: "+49 30 1234567",
      extra: { websiteConsentAt: NOW.toISOString(), crmLeadId: "lead-7", utm_source: "instagram", utm_campaign: "autumn" },
      via: "public-placement",
    });
  });

  it(`refuses a ${WEB_CHECK_DAILY_CAP + 1}th invitation for the same e-mail in 24 hours, and writes nothing`, async () => {
    fake.results = [OWNER, [link(1, "COMPLETED"), link(2, "COMPLETED"), link(3, "EXPIRED")]];
    expect(await webCheckPlacement(request(), NOW)).toEqual({ ok: false, code: "DAILY_LIMIT" });
    expect(h.ensure).not.toHaveBeenCalled();
    expect(h.invite).not.toHaveBeenCalled();
  });

  it("under the cap a finished test can be taken again", async () => {
    fake.results = [OWNER, [link(1, "COMPLETED"), link(2, "COMPLETED")]];
    expect(await webCheckPlacement(request(), NOW)).toMatchObject({ ok: true, reused: false });
  });

  it("says why when it cannot invite: no organisation, a bank that cannot fill the web check, a refused invite", async () => {
    fake.results = [[]];
    expect(await webCheckPlacement(request(), NOW)).toEqual({ ok: false, code: "NOT_SET_UP" });
    fake.results = [OWNER, []];
    h.ensure.mockResolvedValueOnce({ ok: false, code: "TEMPLATE_COVERAGE" });
    expect(await webCheckPlacement(request(), NOW)).toEqual({ ok: false, code: "TEMPLATE_COVERAGE" });
    expect(h.invite).not.toHaveBeenCalled();
    fake.results = [OWNER, []];
    h.invite.mockResolvedValueOnce({ ok: false, code: "NOT_PUBLISHED" });
    expect(await webCheckPlacement(request(), NOW)).toEqual({ ok: false, code: "INVITE_FAILED" });
  });

  it("without a link secret (production without AUTH_SECRET) cannot show the open link again, so it invites within the cap", async () => {
    vi.stubEnv("NODE_ENV", "production");
    fake.results = [OWNER, [link(1, "NOT_STARTED")]];
    expect(await webCheckPlacement(request(), NOW)).toMatchObject({ ok: true, reused: false });
  });
});

describe("visitExtra", () => {
  it("keeps the consent time, the lead and the UTM tags with their prefix", () => {
    expect(visitExtra(request(), NOW)).toEqual({ websiteConsentAt: NOW.toISOString(), crmLeadId: "lead-7", utm_source: "instagram", utm_campaign: "autumn" });
    expect(visitExtra(request({ crmLeadId: null, utm: {} }), NOW)).toEqual({ websiteConsentAt: NOW.toISOString() });
  });
});

describe("oneAtATime", () => {
  const tick = () => new Promise((r) => setTimeout(r, 5));

  it("runs tasks for one key one after another, and other keys alongside", async () => {
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`${name} start`);
      await tick();
      log.push(`${name} end`);
      return name;
    };
    const results = await Promise.all([oneAtATime("a", task("a1")), oneAtATime("a", task("a2")), oneAtATime("b", task("b1"))]);
    expect(results).toEqual(["a1", "a2", "b1"]);
    expect(log.indexOf("a1 end")).toBeLessThan(log.indexOf("a2 start"));
    expect(log.indexOf("b1 start")).toBeLessThan(log.indexOf("a1 end"));
  });

  it("a failed task does not stop the next one", async () => {
    const failing = oneAtATime("c", async () => {
      throw new Error("boom");
    });
    const next = oneAtATime("c", async () => "ran");
    await expect(failing).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ran");
  });

  it("two parallel requests for one e-mail: the second sees the first's invitation and gets it back", async () => {
    // The first finds nothing and invites; by the time the second reads, that invitation is there.
    const created = link(5, "NOT_STARTED");
    fake.results = [OWNER, [], OWNER, [created]];
    const [first, second] = await Promise.all([webCheckPlacement(request(), NOW), webCheckPlacement(request({ email: "ada@example.com" }), NOW)]);
    expect(first).toMatchObject({ ok: true, reused: false });
    expect(second).toMatchObject({ ok: true, reused: true });
    expect(h.invite).toHaveBeenCalledTimes(1);
  });
});
