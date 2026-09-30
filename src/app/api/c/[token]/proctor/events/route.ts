import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { workingAttempt } from "@/lib/exam-flow";
import { ingestEvents } from "@/server/proctoring";
import { withCandidate } from "@/lib/candidate-api";

type Body = { sessionId?: string; clientOffsetMs?: number; events?: unknown };

/**
 * A batch of proctoring events. Read as text so `sendBeacon` on page unload
 * works too. Events outside a section are kept: the check screen and the
 * pause between sections matter as much as the questions.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      let body: Body | null = null;
      try {
        body = JSON.parse(await request.text()) as Body;
      } catch {
        body = null;
      }
      const { attempt, finished } = await workingAttempt(ctx.assessment.id);
      if (finished || !body) return candidateJson({ accepted: false });
      const terminated = await ingestEvents(ctx, attempt, body.sessionId, body.events, Number(body.clientOffsetMs ?? 0));
      return candidateJson({ accepted: true, terminated });
    },
    { limit: 300 },
  );
}
