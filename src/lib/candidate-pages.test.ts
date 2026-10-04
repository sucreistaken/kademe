import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolveResult } from "@/lib/candidate-context";
import type { CandidatePageInput, CandidatePageSlot } from "@/solutions/types";

type RenderPage = (slot: CandidatePageSlot, input: CandidatePageInput) => Promise<unknown>;

const h = vi.hoisted(() => ({
  resolveToken: vi.fn<(token: string) => Promise<unknown>>(),
  module: null as null | { candidate: { renderPage?: RenderPage } },
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/candidate-context", () => ({ resolveToken: h.resolveToken }));
vi.mock("@/solutions/registry.server", () => ({ servingSolution: async () => h.module }));

import { solutionPage } from "./candidate-pages";

const ctx = { assessment: { id: "a1", orgId: "o1", solution: "HIRING" } };

beforeEach(() => {
  h.resolveToken.mockReset();
  h.module = null;
});

describe("solutionPage", () => {
  it("leaves an unknown token to the core page", async () => {
    h.resolveToken.mockResolvedValueOnce({ ok: false, problem: "INVALID" });
    expect(await solutionPage("t", "landing")).toBeUndefined();
  });

  it("leaves an invitation no live module serves to the core page", async () => {
    h.resolveToken.mockResolvedValueOnce({ ok: true, ctx });
    expect(await solutionPage("t", "landing")).toBeUndefined();
  });

  it("leaves a module without its own pages (the exam) to the core page", async () => {
    h.resolveToken.mockResolvedValueOnce({ ok: true, ctx });
    h.module = { candidate: {} };
    expect(await solutionPage("t", "landing")).toBeUndefined();
  });

  it("asks a module with its own pages, problems, search and route params included", async () => {
    const resolved = { ok: false, problem: "EXPIRED", ctx } as unknown as ResolveResult;
    h.resolveToken.mockResolvedValueOnce(resolved);
    const renderPage = vi.fn<RenderPage>(async () => "PAGE");
    h.module = { candidate: { renderPage } };
    const page = await solutionPage("tok", "stage", Promise.resolve({ lang: "en" }), { n: "2" });
    expect(page).toBe("PAGE");
    expect(renderPage).toHaveBeenCalledWith("stage", { token: "tok", resolved, searchParams: { lang: "en" }, params: { n: "2" } });
  });
});
