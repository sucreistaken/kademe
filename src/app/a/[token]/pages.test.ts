import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";
import type { CandidateContext, ResolveResult } from "@/lib/candidate-context";
import type { CandidatePageInput, CandidatePageSlot } from "@/solutions/types";

/**
 * Every core `/a/[token]/*` page asks the serving solution first (platform spec
 * 4), and an invitation no live module serves renders exactly what an unknown
 * token renders on that page, whatever the link's state (spec 6).
 */

type RenderPage = (slot: CandidatePageSlot, input: CandidatePageInput) => Promise<ReactNode>;
type Served = { dbKind: string; accommodationRequests: boolean; candidate: { renderPage?: RenderPage } };

const h = vi.hoisted(() => ({
  resolveToken: vi.fn<(token: string) => Promise<unknown>>(),
  getConsentText: vi.fn<(ctx: unknown) => Promise<unknown>>(),
  resolveExamToken: vi.fn<(token: string) => Promise<unknown>>(),
  /** What the hiring module answers when asked to serve; null: not live or not served. */
  hiring: null as unknown,
}));

// Nothing may reach the database.
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));

vi.mock("@/lib/candidate-context", () => ({
  resolveToken: (token: string) => h.resolveToken(token),
  getConsentText: (ctx: unknown) => h.getConsentText(ctx),
  supportedLocales: () => ["tr", "en"],
  setAssessmentLocale: async () => undefined,
}));

// The exam's resolver, as its contract reads: a non-exam invitation is INVALID with no context.
vi.mock("@/lib/exam-flow", () => ({
  resolveExamToken: (token: string) => h.resolveExamToken(token),
  loadState: async () => ({ step: "CONSENT", proctoring: {}, sections: [] }),
  progressSummary: async () => ({ done: 0, total: 4 }),
}));

// The exam is live and keeps the core pages (no renderPage); hiring answers whatever h.hiring says.
vi.mock("@/solutions/registry.server", () => ({
  servingSolution: async (ctx: { assessment: { solution: string } }) =>
    ctx.assessment.solution === "LANGUAGE_EXAM" ? { dbKind: "LANGUAGE_EXAM", accommodationRequests: false, candidate: {} } : h.hiring,
}));

class Redirect extends Error {}
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Redirect(path);
  },
}));

import LandingPage from "./page";
import InfoPage from "./info/page";
import CheckPage from "./check/page";
import DonePage from "./done/page";
import PracticePage from "./practice/page";
import StagePage from "./stage/[n]/page";
import RightsPage from "./rights/page";
import { UnknownLink } from "@/components/candidate/UnknownLink";
import { IntroConsent } from "@/components/candidate/IntroConsent";

const TOKEN = "t".repeat(43);

function ctx(solution: CandidateContext["assessment"]["solution"], status: CandidateContext["link"]["status"]): CandidateContext {
  return {
    link: { id: "l", status, expiresAt: new Date("2026-10-20T12:00:00Z"), notBefore: null, firstSeenIp: null },
    assessment: { id: "a", orgId: "o", solution },
    candidate: { id: "c", fullName: "Ada Lovelace", email: null, phone: null, location: null },
    orgName: "Org",
    // A language other than the default, so a leak through the locale shows up.
    locale: "en",
    contactEmail: "ekip@example.com",
    contactName: "Deniz",
    mediaRetentionDays: 180,
    evidenceRetentionDays: 90,
  };
}

const PAGES = {
  landing: (search: Record<string, string>) => LandingPage({ params: Promise.resolve({ token: TOKEN }), searchParams: Promise.resolve(search) }),
  info: (search: Record<string, string>) => InfoPage({ params: Promise.resolve({ token: TOKEN }), searchParams: Promise.resolve(search) }),
  check: (search: Record<string, string>) => CheckPage({ params: Promise.resolve({ token: TOKEN }), searchParams: Promise.resolve(search) }),
  done: (search: Record<string, string>) => DonePage({ params: Promise.resolve({ token: TOKEN }), searchParams: Promise.resolve(search) }),
  practice: (search: Record<string, string>) => PracticePage({ params: Promise.resolve({ token: TOKEN }), searchParams: Promise.resolve(search) }),
  stage: (search: Record<string, string>) => StagePage({ params: Promise.resolve({ token: TOKEN, n: "2" }), searchParams: Promise.resolve(search) }),
  rights: (search: Record<string, string>) => RightsPage({ params: Promise.resolve({ token: TOKEN }), searchParams: Promise.resolve(search) }),
} as const;
type PageName = keyof typeof PAGES;

async function render(page: PageName, resolved: unknown, search: Record<string, string> = {}) {
  h.resolveToken.mockResolvedValue(resolved);
  return (await PAGES[page](search)) as ReactElement;
}

const STATES = [
  ["an open", "NOT_STARTED", null],
  ["a not yet open", "NOT_STARTED", "NOT_YET"],
  ["an EXPIRED", "EXPIRED", "EXPIRED"],
  ["a COMPLETED", "COMPLETED", "COMPLETED"],
] as const;

function hiringResolved(status: CandidateContext["link"]["status"], problem: string | null) {
  const c = ctx("HIRING", status);
  return problem ? { ok: false, problem, ctx: c } : { ok: true, ctx: c };
}

function contains(node: ReactNode, type: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((child) => contains(child, type));
  const element = node as ReactElement<{ children?: ReactNode }>;
  return element.type === type || contains(element.props?.children, type);
}

beforeEach(() => {
  h.resolveToken.mockReset();
  h.getConsentText.mockReset();
  h.getConsentText.mockResolvedValue({ version: 3, body: { tr: "Onay metni", en: "Consent text" } });
  h.resolveExamToken.mockReset();
  h.resolveExamToken.mockImplementation(async (token) => {
    const resolved = (await h.resolveToken(token)) as ResolveResult;
    if (!resolved.ctx) return { ok: false, problem: resolved.ok ? "INVALID" : resolved.problem };
    if (resolved.ctx.assessment.solution !== "LANGUAGE_EXAM") return { ok: false, problem: "INVALID" };
    return resolved;
  });
  h.hiring = null;
});

describe("an invitation no live module serves", () => {
  const pages = Object.keys(PAGES) as PageName[];
  for (const page of pages) {
    it.each(STATES)(`renders %s HIRING link on ${page} exactly like an unknown token`, async (_label, status, problem) => {
      const unknown = await render(page, { ok: false, problem: "INVALID" });
      const other = await render(page, hiringResolved(status, problem));
      expect(other).toEqual(unknown);
      expect(h.getConsentText).not.toHaveBeenCalled();
    });
  }

  it.each(["practice", "stage", "rights"] as const)("shows the one unknown-link card on %s", async (page) => {
    for (const [, status, problem] of STATES) {
      expect(await render(page, hiringResolved(status, problem))).toEqual(createElement(UnknownLink, { token: TOKEN }));
    }
    expect(await render(page, { ok: false, problem: "INVALID" })).toEqual(createElement(UnknownLink, { token: TOKEN }));
  });

  it("is also what an exam invitation sees on the pages only a solution renders", async () => {
    for (const page of ["practice", "stage"] as const) {
      expect(await render(page, { ok: true, ctx: ctx("LANGUAGE_EXAM", "NOT_STARTED") })).toEqual(createElement(UnknownLink, { token: TOKEN }));
    }
  });
});

describe("a module with its own pages", () => {
  const SLOTS: Array<[PageName, CandidatePageSlot, Record<string, string>]> = [
    ["landing", "landing", {}],
    ["info", "info", {}],
    ["check", "check", {}],
    ["done", "done", {}],
    ["practice", "practice", {}],
    ["stage", "stage", { n: "2" }],
  ];

  it.each(SLOTS)("answers %s with its own %s page", async (page, slot, routeParams) => {
    const renderPage = vi.fn<RenderPage>(async () => createElement("main", null, "HIRING PAGE"));
    const served: Served = { dbKind: "HIRING", accommodationRequests: true, candidate: { renderPage } };
    h.hiring = served;
    const resolved = hiringResolved("EXPIRED", "EXPIRED");
    const out = await render(page, resolved, { lang: "tr" });
    expect(out).toEqual(createElement("main", null, "HIRING PAGE"));
    expect(renderPage).toHaveBeenCalledWith(slot, { token: TOKEN, resolved, searchParams: { lang: "tr" }, params: routeParams });
    // The exam's reads never run for another solution's invitation.
    expect(h.resolveExamToken).not.toHaveBeenCalled();
    expect(h.getConsentText).not.toHaveBeenCalled();
  });
});

describe("the exam keeps the core pages", () => {
  it("reads the core consent text for an exam invitation on the landing", async () => {
    const exam = ctx("LANGUAGE_EXAM", "NOT_STARTED");
    const page = await render("landing", { ok: true, ctx: exam });
    expect(h.getConsentText).toHaveBeenCalledWith(exam);
    expect(contains(page, IntroConsent)).toBe(true);
  });

  it("never reads the core consent for a served hiring invitation that renders no page of its own", async () => {
    const served: Served = { dbKind: "HIRING", accommodationRequests: true, candidate: {} };
    h.hiring = served;
    const unknown = await render("landing", { ok: false, problem: "INVALID" });
    expect(await render("landing", hiringResolved("NOT_STARTED", null))).toEqual(unknown);
    expect(h.getConsentText).not.toHaveBeenCalled();
  });
});
