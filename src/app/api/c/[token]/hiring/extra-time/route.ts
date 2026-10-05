import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { loadHiringState, setExtraTime } from "@/solutions/hiring/server/candidate";
import { ExtraTimeBody, readBody, refuse, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

/** HIRING-UX 6.1 "Ek süre, kendin seç": no reason asked, applied to stages started afterwards. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(req, params, async (request, h) => {
    const body = await readBody(request, ExtraTimeBody);
    if (!body) return refuse(h, "EXTRA_TIME_INVALID", 400);
    const chosen = await setExtraTime(h, body.pct);
    if (!chosen.ok) return refuse(h, chosen.code, statusOf(chosen.code));
    return candidateJson(await loadHiringState(h));
  });
}
