import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { badRequest, conflict, readJson } from "@/lib/candidate-api";
import { withExamCandidate } from "@/lib/exam-candidate-api";
import { parseFeedbackBody } from "@/lib/exam/feedback";
import { saveExamFeedback } from "@/server/exam-feedback";

/**
 * The end-of-exam survey. It is sent from the finished screen, so the link is
 * COMPLETED by then and that is tolerated here; whether the exam is really over
 * is checked on the attempt (a live exam gets NOT_FINISHED, a terminated one
 * too). One answer per invitation: a second POST keeps the first and answers
 * `alreadyAnswered`, so a double click or a second tab ends on the thank-you too.
 * Nothing in the answer touches the result.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withExamCandidate(
    req,
    params,
    async (request, ctx) => {
      const parsed = parseFeedbackBody(await readJson<unknown>(request));
      if (!parsed.ok) return badRequest(ctx, parsed.code);
      const outcome = await saveExamFeedback(
        { assessmentId: ctx.assessment.id, orgId: ctx.assessment.orgId, locale: ctx.locale },
        parsed.value,
      );
      if (outcome === "NOT_FINISHED") return conflict(ctx, "NOT_FINISHED");
      return candidateJson({ received: true, alreadyAnswered: outcome === "ALREADY_ANSWERED" });
    },
    { limit: 10, windowMs: 60_000, allowProblems: ["COMPLETED"] },
  );
}
