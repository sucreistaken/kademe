import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import {
  currentStage,
  finishAttemptIfDone,
  isAnswered,
  loadResponses,
  loadState,
  submitStage,
  writeWindow,
} from "@/lib/candidate-flow";
import { conflict, message, withCandidate } from "@/lib/candidate-api";

/**
 * Closes the current stage and moves on. A stage whose required activities are
 * unanswered can still be closed once the deadline has passed, because the
 * alternative is a candidate stuck on a screen they can no longer answer; it is
 * then recorded as PARTIAL rather than COMPLETE.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(req, params, async (_request, ctx) => {
    const current = await currentStage(ctx);
    if (!current) return conflict(ctx, "NO_STAGE");

    const run = current.target.run;
    if (!run) return conflict(ctx, "STAGE_NOT_STARTED");

    const window = writeWindow(run, current.target.stage);
    const expired = !window.allowed;

    if (!expired) {
      const saved = await loadResponses(run.id);
      const byActivity = new Map(saved.map((r) => [r.activityId, r.payload]));
      const missing = current.stageActivities.filter(
        (a) => a.isRequired && !isAnswered(a, byActivity.get(a.id)),
      );
      if (missing.length > 0) {
        return candidateJson(
          {
            error: "REQUIRED_MISSING",
            message: message(ctx.locale, "REQUIRED_MISSING"),
            missing: missing.map((a) => a.orderIndex),
          },
          { status: 422 },
        );
      }
    }

    await submitStage(ctx, run, current.stageActivities, {
      late: window.allowed ? window.late : false,
      expired,
    });
    await finishAttemptIfDone(ctx, current.attempt, current.allStages);
    return candidateJson(await loadState(ctx));
  });
}
