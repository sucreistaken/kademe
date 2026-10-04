import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { currentAttempt } from "@/lib/candidate-context";
import { ingestEvents } from "@/server/proctoring";
import { withSolution } from "@/lib/candidate-api";

type Body = { sessionId?: string; clientOffsetMs?: number; events?: unknown };

/**
 * A batch of proctoring events. Read as text so `sendBeacon` on page unload
 * works too. Events outside a section are kept: the check screen and the
 * pause between sections matter as much as the questions.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withSolution(
    req,
    params,
    async (request, ctx, solution) => {
      let body: Body | null = null;
      try {
        body = JSON.parse(await request.text()) as Body;
      } catch {
        body = null;
      }
      const { attempt, finished } = await currentAttempt(ctx.assessment);
      if (finished || !body) return candidateJson({ accepted: false });
      const terminated = await ingestEvents(ctx, solution, attempt, body.sessionId, body.events, Number(body.clientOffsetMs ?? 0));
      return candidateJson({ accepted: true, terminated });
    },
    { limit: 300 },
  );
}
