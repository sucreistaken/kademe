import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import {
  getConsentText,
  hasConsented,
  loadState,
  recordConsent,
} from "@/lib/candidate-flow";
import {
  badRequest,
  clientIp,
  readJson,
  userAgent,
  withCandidate,
} from "@/lib/candidate-api";

/** The exact consent copy on screen, with the version that will be recorded. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(req, params, async (_req, ctx) => {
    const text = await getConsentText(ctx);
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
  return withCandidate(req, params, async (request, ctx) => {
    const body = await readJson<{ accepted?: boolean }>(request);
    if (!body?.accepted) {
      return badRequest(ctx, "CONSENT_REQUIRED");
    }
    if (!(await hasConsented(ctx.assessment.id))) {
      const text = await getConsentText(ctx);
      await recordConsent(ctx, text.id, clientIp(request), userAgent(request));
    }
    return candidateJson(await loadState(ctx));
  });
}
