import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { checkWrite, recordPlay } from "@/lib/exam-flow";
import { getStorage } from "@/lib/storage";
import { conflict, readJson } from "@/lib/candidate-api";
import { withExamCandidate } from "@/lib/exam-candidate-api";

type Body = { sectionPosition?: number; sequence?: number };

/**
 * One play of the current listening clip. The play is counted on the server,
 * under a lock, before the audio URL is handed out, so a reload or a second tab
 * cannot buy an extra listen. The URL is short lived and names no item.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withExamCandidate(req, params, async (request, ctx) => {
    const body = await readJson<Body>(request);
    const check = await checkWrite(ctx, body?.sectionPosition, body?.sequence);
    if (!check.ok) return conflict(ctx, check.code);
    const stimulus = check.response.itemSnapshot.stimulus;
    if (!stimulus || stimulus.section !== "LISTENING" || !stimulus.audioKey) return conflict(ctx, "NOT_LISTENING");
    const played = await recordPlay(ctx, check.run, stimulus.id);
    if (!played.ok) return conflict(ctx, "PLAYS_EXHAUSTED");
    const url = await getStorage().getSignedUrl(stimulus.audioKey, 120);
    return candidateJson({
      src: url,
      playsLeft: Math.max(0, ctx.assessment.config.listening.maxPlays - played.playsUsed),
    });
  });
}
