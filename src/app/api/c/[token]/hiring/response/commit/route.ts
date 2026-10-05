import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { message } from "@/lib/candidate-api";
import { commitResponse, loadHiringState } from "@/solutions/hiring/server/candidate";
import { AnswerBody, readBody, refuse, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

/** "Sonraki soru" / "Bu cevabı kullan": closes the question; the reply is the next state. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(req, params, async (request, h) => {
    const body = await readBody(request, AnswerBody);
    if (!body) return refuse(h, "REQUEST_INVALID", 400);
    const committed = await commitResponse(h, { position: body.stagePosition, activityId: body.activityId, answer: body.answer });
    if (!committed.ok) {
      if (committed.code === "REQUIRED_MISSING") {
        return candidateJson({ error: "REQUIRED_MISSING", message: message(h.locale, "REQUIRED_MISSING"), missing: [body.activityId] }, { status: 422 });
      }
      return refuse(h, committed.code, statusOf(committed.code));
    }
    return candidateJson(await loadHiringState(h));
  });
}
