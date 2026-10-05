import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { saveSurvey } from "@/solutions/hiring/server/candidate";
import { readBody, refuse, statusOf, SurveyBody, SurveyRating, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

/**
 * HIRING-UX 6.13: the optional survey on a finished (COMPLETED) link. A body
 * that is not the survey's shape (a comment that is not text) is
 * REQUEST_INVALID; a rating outside 1-5 is SURVEY_INVALID.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(
    req,
    params,
    async (request, h) => {
      const body = await readBody(request, SurveyBody);
      if (!body) return refuse(h, "REQUEST_INVALID", 400);
      const rating = SurveyRating.safeParse(body.rating);
      if (!rating.success) return refuse(h, "SURVEY_INVALID", 400);
      const saved = await saveSurvey(h, { rating: rating.data, comment: body.comment ?? undefined });
      if (!saved.ok) return refuse(h, saved.code, statusOf(saved.code));
      return candidateJson({ received: true });
    },
    { limit: 10, allowProblems: ["COMPLETED"] },
  );
}
