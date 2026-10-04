import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { proctorEvidence, proctorSessions } from "@/db/schema";
import { candidateJson } from "@/lib/candidate-safe";
import { loadState, recordDeviceCheck, workingAttempt } from "@/lib/exam-flow";
import { conflict } from "@/lib/candidate-api";
import { withExamCandidate } from "@/lib/exam-candidate-api";

/**
 * Marks the system check as passed. The server does not take the tab's word for
 * it alone: a proctored exam needs a registered session and, when the camera is
 * required, the reference frame the teacher will compare the rest against.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withExamCandidate(req, params, async (_request, ctx) => {
    const { attempt, finished } = await workingAttempt(ctx.assessment.id);
    if (finished) return conflict(ctx, "ALREADY_COMPLETED");
    const policy = ctx.assessment.config.proctoring;
    if (policy.preset !== "OFF") {
      const [session] = await db
        .select({ id: proctorSessions.id })
        .from(proctorSessions)
        .where(eq(proctorSessions.attemptId, attempt.id))
        .limit(1);
      if (!session) return conflict(ctx, "SESSION_INVALID");
      if (policy.camera) {
        const [reference] = await db
          .select({ id: proctorEvidence.id })
          .from(proctorEvidence)
          .where(and(eq(proctorEvidence.attemptId, attempt.id), eq(proctorEvidence.trigger, "REFERENCE")))
          .limit(1);
        if (!reference) return conflict(ctx, "EVIDENCE_INVALID");
      }
    }
    await recordDeviceCheck(attempt.id);
    return candidateJson(await loadState(ctx));
  });
}
