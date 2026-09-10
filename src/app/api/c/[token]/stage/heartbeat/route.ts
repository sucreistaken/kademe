import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { currentStage, heartbeat, remainingMs } from "@/lib/candidate-flow";
import { withCandidate } from "@/lib/candidate-api";

/**
 * Every 15 seconds. Two jobs: keep a presence record so the manager can see
 * where a candidate dropped, and re-anchor the countdown to the server clock so
 * a drifting device cannot buy itself extra time.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(
    req,
    params,
    async (_request, ctx) => {
      const current = await currentStage(ctx);
      const run = current?.target.run;
      if (!current || !run) {
        return candidateJson({ active: false, serverNow: Date.now(), remainingMs: 0 });
      }
      await heartbeat(run.id);
      return candidateJson({
        active: true,
        serverNow: Date.now(),
        deadlineAt: run.deadlineAt?.getTime() ?? null,
        remainingMs: remainingMs(run),
      });
    },
    { limit: 120, windowMs: 60_000 },
  );
}
