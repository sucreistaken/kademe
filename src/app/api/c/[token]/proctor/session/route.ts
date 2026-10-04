import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { workingAttempt } from "@/lib/exam-flow";
import { registerSession } from "@/server/proctoring";
import { clientIp, conflict, readJson } from "@/lib/candidate-api";
import { withExamCandidate } from "@/lib/exam-candidate-api";

type Body = { clientSessionId?: string; env?: Record<string, unknown> };

/**
 * Registers one browser tab running this exam and hands back the policy the
 * tab must enforce. The fake media mode for automated testing is decided here,
 * by the server, and never outside development.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withExamCandidate(req, params, async (request, ctx) => {
    const body = await readJson<Body>(request);
    const { attempt, finished } = await workingAttempt(ctx.assessment.id);
    if (finished) return conflict(ctx, "ALREADY_COMPLETED");
    if (typeof body?.clientSessionId !== "string" || body.clientSessionId.length < 8)
      return conflict(ctx, "SESSION_INVALID");
    const env = body.env && typeof body.env === "object" ? body.env : {};
    if (JSON.stringify(env).length > 4000) return conflict(ctx, "SESSION_INVALID");
    const session = await registerSession(ctx, attempt.id, body.clientSessionId, env, clientIp(request));
    return candidateJson({
      sessionId: session.id,
      policy: ctx.assessment.config.proctoring,
      serverNow: Date.now(),
      devFakeMedia: process.env.NODE_ENV !== "production" && process.env.PROCTOR_DEV_FAKE === "1",
      maxFrameBytes: 512 * 1024,
    });
  });
}
