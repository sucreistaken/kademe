import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { workingAttempt } from "@/lib/exam-flow";
import { heartbeat } from "@/server/proctoring";
import { readJson, withCandidate } from "@/lib/candidate-api";

type Body = { sessionId?: string; state?: Record<string, unknown> };

/** Every 15 seconds: what the tab believes is on (share, fullscreen, camera, model). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const body = await readJson<Body>(request);
      const { attempt, finished } = await workingAttempt(ctx.assessment.id);
      if (finished) return candidateJson({ finished: true, serverNow: Date.now() });
      const state = body?.state && typeof body.state === "object" ? body.state : {};
      const beat = await heartbeat(ctx, attempt.id, body?.sessionId, state);
      return candidateJson({ finished: false, serverNow: beat?.serverNow ?? Date.now() });
    },
    { limit: 120 },
  );
}
