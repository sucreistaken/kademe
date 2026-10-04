import type { ReactNode } from "react";
import { resolveToken, type CandidateContext, type ResolveResult } from "@/lib/candidate-context";
import { servingSolution } from "@/solutions/registry.server";
import type { CandidatePageSlot } from "@/solutions/types";

export type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Every `/a/[token]/*` page asks here first (platform spec 4: the URLs are the
 * core's, the content is the solution's). A live module that serves this
 * invitation and renders its own candidate pages answers with its page, link
 * problems included. Anything else (the exam, which keeps the core pages, an
 * unknown token, a solution that does not serve this invitation) returns
 * undefined and the core page renders exactly as before.
 */
export async function solutionPage(
  token: string,
  slot: CandidatePageSlot,
  searchParams?: PageSearchParams,
  params: Record<string, string> = {},
): Promise<ReactNode | undefined> {
  const resolved = await resolveToken(token);
  if (!resolved.ctx) return undefined;
  const served = await servingSolution(resolved.ctx);
  if (!served?.candidate.renderPage) return undefined;
  return served.candidate.renderPage(slot, {
    token,
    resolved: resolved as ResolveResult & { ctx: CandidateContext },
    searchParams: searchParams ? await searchParams : {},
    params,
  });
}
