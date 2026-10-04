import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

// The page resolves the token through a mock; nothing may reach the database.
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));

const resolveToken = vi.fn();
vi.mock("@/lib/candidate-context", () => ({
  resolveToken: (...args: unknown[]) => resolveToken(...args),
}));

import CandidateRightsPage from "./page";
import { RightsForm } from "@/components/candidate/RightsForm";
import { LinkProblem } from "@/components/candidate/LinkProblem";
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

async function render(resolved: unknown) {
  resolveToken.mockResolvedValueOnce(resolved);
  return (await CandidateRightsPage({ params: Promise.resolve({ token: TOKEN }) })) as ReactElement;
}

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
  ] as const)("renders %s HIRING link (no module) exactly like an unknown token", async (_label, status, problem) => {
    const unknown = await render({ ok: false, problem: "INVALID" });
    const hiring = ctx("HIRING", status);
    const other = await render(problem ? { ok: false, problem, ctx: hiring } : { ok: true, ctx: hiring });
    expect(other).toEqual(unknown);
    expect(contains(other, LinkProblem)).toBe(true);
    expect(contains(other, RightsForm)).toBe(false);
  });

  it("keeps the rights form reachable on an expired LANGUAGE_EXAM link", async () => {
    const exam = ctx("LANGUAGE_EXAM", "EXPIRED");
    const page = await render({ ok: false, problem: "EXPIRED", ctx: exam });
    expect(contains(page, RightsForm)).toBe(true);
    expect(contains(page, LinkProblem)).toBe(false);
  });
});
