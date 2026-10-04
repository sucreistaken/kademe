import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { hasConsented, recordConsent } from "@/lib/candidate-context";
import { badRequest, clientIp, readJson, userAgent, withSolution } from "@/lib/candidate-api";

/** The exact consent copy on screen, with the version that will be recorded. The solution names the text. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withSolution(req, params, async (_req, ctx, solution) => {
    const text = await solution.candidate.consentText(ctx);
    return candidateJson({
      version: text.version,
      body: text.body[ctx.locale] || text.body.tr,
      accepted: await hasConsented(ctx.assessment.id),
    });
  });
}

/**
 * Records which version of the consent copy was accepted, when, and from where.
 * A year later this is what proves what the candidate actually agreed to.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withSolution(req, params, async (request, ctx, solution) => {
    const body = await readJson<{ accepted?: boolean }>(request);
    if (!body?.accepted) {
      return badRequest(ctx, "CONSENT_REQUIRED");
    }
    if (!(await hasConsented(ctx.assessment.id))) {
      const text = await solution.candidate.consentText(ctx);
      await recordConsent(ctx, text.id, clientIp(request), userAgent(request));
    }
    return candidateJson(await solution.candidate.loadState(ctx));
  });
}
