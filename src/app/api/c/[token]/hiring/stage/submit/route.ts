import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { message } from "@/lib/candidate-api";
import { loadHiringState, submitStage } from "@/solutions/hiring/server/candidate";
import { readBody, refuse, StageBody, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

/**
 * "Aşamayı bitir", the final submit after its 8 second undo, and the client's
 * submit at 0:00. Missing required answers are named (422) while time is
 * left; after the deadline the stage closes with what it has.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(req, params, async (request, h) => {
    const body = await readBody(request, StageBody);
    if (!body) return refuse(h, "REQUEST_INVALID", 400);
    const submitted = await submitStage(h, body.stagePosition);
    if (!submitted.ok) {
      if (submitted.code === "REQUIRED_MISSING") {
        return candidateJson({ error: "REQUIRED_MISSING", message: message(h.locale, "REQUIRED_MISSING"), missing: submitted.missing ?? [] }, { status: 422 });
      }
      return refuse(h, submitted.code, statusOf(submitted.code));
    }
    return candidateJson(await loadHiringState(h));
  });
}
