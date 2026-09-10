import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import {
  loadState,
  recordDeviceCheck,
  workingAttempt,
} from "@/lib/candidate-flow";
import { conflict, withCandidate } from "@/lib/candidate-api";

/**
 * Marks the camera and microphone test as passed for THIS attempt, so a refresh
 * does not send the candidate through it again while a retake still does. The
 * trial recording itself never leaves the candidate's device.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(req, params, async (_request, ctx) => {
    const { attempt, finished } = await workingAttempt(ctx.assessment.id);
    if (finished) {
      return conflict(ctx, "ALREADY_COMPLETED");
    }
    await recordDeviceCheck(attempt.id);
    return candidateJson(await loadState(ctx));
  });
}
