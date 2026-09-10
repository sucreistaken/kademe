import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { currentStage, loadState, startStage } from "@/lib/candidate-flow";
import { conflict, withCandidate } from "@/lib/candidate-api";

/**
 * Starts the stage the server decided is next. Writes `started_at` and
 * `deadline_at` exactly once: calling this again after a refresh returns the
 * same deadline, so a refresh neither resets nor extends the clock.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(req, params, async (_request, ctx) => {
    const current = await currentStage(ctx);
    if (!current) return conflict(ctx, "NO_STAGE");
    await startStage(ctx, current.attempt, current.target);
    return candidateJson(await loadState(ctx));
  });
}
