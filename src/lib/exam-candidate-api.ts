import type { NextRequest } from "next/server";
import { notFoundForSolution, withCandidate, type CandidateRouteOptions } from "@/lib/candidate-api";
import { loadExamContext, type ExamCandidateContext } from "@/lib/exam-flow";

export type ExamHandler = (req: NextRequest, ctx: ExamCandidateContext) => Promise<Response>;

/**
 * `withCandidate` for the language exam's endpoints. The token is resolved by
 * the core; anything that is not a language exam invitation is answered with
 * the unknown-token 404 before a single exam table is read.
 */
export function withExamCandidate(
  req: NextRequest,
  params: Promise<{ token: string }>,
  handler: ExamHandler,
  options: CandidateRouteOptions = {},
): Promise<Response> {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const exam = await loadExamContext(ctx);
      // Second check: acceptSolution already turned other solutions away; this
      // also covers a language exam invitation whose exam terms are missing.
      if (!exam) return notFoundForSolution(request);
      return handler(request, exam);
    },
    { ...options, acceptSolution: (kind) => kind === "LANGUAGE_EXAM" },
  );
}
