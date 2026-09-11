import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import {
  currentStage,
  finishAttemptIfDone,
  isAnswered,
  loadResponses,
  loadState,
  submitStage,
} from "@/lib/candidate-flow";
import { submitDecision } from "@/lib/timer";
import { conflict, message, withCandidate } from "@/lib/candidate-api";

/**
 * Closes the current stage and moves on. A stage whose required activities are
 * unanswered can still be closed once the deadline has passed, because the
 * alternative is a candidate stuck on a screen they can no longer answer; it is
 * then recorded as PARTIAL rather than COMPLETE.
 *
 * "Once the deadline has passed" means the deadline itself, not the end of the
 * latency slack: the client's auto-submit at 0:00 lands inside that slack, and
 * refusing it with 422 is exactly the stuck screen this route exists to avoid.
 * The rule lives in `submitDecision` so it can be tested without a database.
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

    const saved = await loadResponses(run.id);
    const byActivity = new Map(saved.map((r) => [r.activityId, r.payload]));
    const missing = current.stageActivities.filter(
      (a) => a.isRequired && !isAnswered(a, byActivity.get(a.id)),
    );

    const decision = submitDecision({
      deadlineAt: run.deadlineAt,
      behaviour: current.target.stage.onTimeout,
      missingRequired: missing.length,
    });

    if (decision.kind === "REJECT_REQUIRED") {
      return candidateJson(
        {
          error: "REQUIRED_MISSING",
          message: message(ctx.locale, "REQUIRED_MISSING"),
          missing: missing.map((a) => a.orderIndex),
        },
        { status: 422 },
      );
    }

    await submitStage(ctx, run, current.stageActivities, {
      late: decision.late,
      expired: decision.expired,
    });
    await finishAttemptIfDone(ctx, current.attempt, current.allStages);
    return candidateJson(await loadState(ctx));
  });
}
