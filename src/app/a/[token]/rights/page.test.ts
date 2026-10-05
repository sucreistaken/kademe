import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";

// The page resolves the token through a mock; nothing may reach the database.
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));

const resolveToken = vi.fn();
vi.mock("@/lib/candidate-context", () => ({
  resolveToken: (...args: unknown[]) => resolveToken(...args),
}));

// Stubbed registry: the exam is live and serves its invitations; hiring is live only in the tests that say so.
const serving = vi.hoisted(() => ({ hiring: false }));
vi.mock("@/solutions/registry.server", () => ({
  servingSolution: async (ctx: { assessment: { solution: string } }) =>
    ctx.assessment.solution === "LANGUAGE_EXAM"
      ? { key: "language-exam", dbKind: "LANGUAGE_EXAM", candidateFlowLive: true, accommodationRequests: false, candidate: {} }
      : serving.hiring
        ? { key: "hiring", dbKind: "HIRING", candidateFlowLive: true, accommodationRequests: true, candidate: { requestContact: async () => "deniz@ornek.test" } }
        : null,
}));

import CandidateRightsPage from "./page";
import { RightsForm } from "@/components/candidate/RightsForm";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { UnknownLink } from "@/components/candidate/UnknownLink";
import type { CandidateContext } from "@/lib/candidate-context";

const TOKEN = "t".repeat(43);

function ctx(solution: CandidateContext["assessment"]["solution"], status: CandidateContext["link"]["status"]): CandidateContext {
  return {
    link: { id: "l", status, expiresAt: new Date(), notBefore: null, firstSeenIp: null },
    assessment: { id: "a", orgId: "o", solution },
    candidate: { id: "c", fullName: "Ada Lovelace", email: null, phone: null, location: null },
    orgName: "Org",
    // A language other than the default, so a leak through the locale shows up.
    locale: "en",
    contactEmail: null,
    contactName: null,
    mediaRetentionDays: 180,
    evidenceRetentionDays: 90,
  };
}

async function render(resolved: unknown, search: Record<string, string> = {}) {
  resolveToken.mockResolvedValueOnce(resolved);
  return (await CandidateRightsPage({ params: Promise.resolve({ token: TOKEN }), searchParams: Promise.resolve(search) })) as ReactElement;
}

function find(node: ReactNode, type: unknown): ReactElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [...(element.type === type ? [element] : []), ...find(element.props?.children, type)];
}

beforeEach(() => {
  serving.hiring = false;
});

function contains(node: ReactNode, type: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((child) => contains(child, type));
  const element = node as ReactElement<{ children?: ReactNode }>;
  return element.type === type || contains(element.props?.children, type);
}

describe("candidate rights page", () => {
  it.each([
    ["an open", "NOT_STARTED", null],
    ["an EXPIRED", "EXPIRED", "EXPIRED"],
    ["a COMPLETED", "COMPLETED", "COMPLETED"],
  ] as const)("renders %s HIRING link (no live candidate flow) exactly like an unknown token", async (_label, status, problem) => {
    const unknown = await render({ ok: false, problem: "INVALID" });
    const hiring = ctx("HIRING", status);
    const other = await render(problem ? { ok: false, problem, ctx: hiring } : { ok: true, ctx: hiring });
    expect(other).toEqual(unknown);
    // Ruling C19: the one unknown-link card, not a copy of it.
    expect(other).toEqual(createElement(UnknownLink, { token: TOKEN }));
    expect(contains(other, RightsForm)).toBe(false);
  });

  it("keeps the rights form reachable on an expired LANGUAGE_EXAM link", async () => {
    const exam = ctx("LANGUAGE_EXAM", "EXPIRED");
    const page = await render({ ok: false, problem: "EXPIRED", ctx: exam });
    expect(contains(page, RightsForm)).toBe(true);
    expect(contains(page, LinkProblem)).toBe(false);
  });

  it("offers the exam's candidates only the three data rights", async () => {
    const page = await render({ ok: true, ctx: ctx("LANGUAGE_EXAM", "NOT_STARTED") });
    expect(find(page, RightsForm)[0].props).toMatchObject({ kinds: ["ACCESS", "COPY", "DELETE"], initialKind: null });
  });

  it("does not preselect an accommodation request where the solution does not read them", async () => {
    const page = await render({ ok: true, ctx: ctx("LANGUAGE_EXAM", "NOT_STARTED") }, { type: "accommodation" });
    expect(find(page, RightsForm)[0].props).toMatchObject({ kinds: ["ACCESS", "COPY", "DELETE"], initialKind: null });
  });

  it("offers a live hiring invitation the accommodation request, preselected from ?type=accommodation", async () => {
    serving.hiring = true;
    const page = await render({ ok: true, ctx: ctx("HIRING", "NOT_STARTED") }, { type: "accommodation" });
    expect(find(page, RightsForm)[0].props).toMatchObject({ kinds: ["ACCOMMODATION", "ACCESS", "COPY", "DELETE"], initialKind: "ACCOMMODATION" });
  });

  it("keeps a served hiring invitation's rights form on a closed link, with nothing preselected by default", async () => {
    serving.hiring = true;
    const page = await render({ ok: false, problem: "EXPIRED", ctx: ctx("HIRING", "EXPIRED") });
    expect(find(page, RightsForm)[0].props).toMatchObject({ initialKind: null });
  });

  it("words the hiring confirmation without a reply promise and with the solution's contact; the exam keeps its wording", async () => {
    serving.hiring = true;
    const hiring = await render({ ok: true, ctx: ctx("HIRING", "NOT_STARTED") });
    expect(find(hiring, RightsForm)[0].props).toMatchObject({ noReply: { email: "deniz@ornek.test" } });
    const exam = await render({ ok: true, ctx: ctx("LANGUAGE_EXAM", "NOT_STARTED") });
    expect(find(exam, RightsForm)[0].props).not.toHaveProperty("noReply");
  });
});
