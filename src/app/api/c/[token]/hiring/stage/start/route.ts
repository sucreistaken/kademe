import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { loadHiringState, startStage } from "@/solutions/hiring/server/candidate";
import { readBody, refuse, StageBody, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

/** HIRING-UX 6.5 "Aşamayı başlat": starts the stage's clock once; a repeat leaves it as it is. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(req, params, async (request, h) => {
    const body = await readBody(request, StageBody);
    if (!body) return refuse(h, "REQUEST_INVALID", 400);
    const started = await startStage(h, body.stagePosition);
    if (!started.ok) {
      const code = started.code === "NOT_READY" ? "STEPS_MISSING" : started.code;
      return refuse(h, code, statusOf(code));
    }
    return candidateJson(await loadHiringState(h));
  });
}
