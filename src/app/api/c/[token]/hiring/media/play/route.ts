import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { playbackUrl } from "@/solutions/hiring/server/candidate";
import { refuse, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

/**
 * HIRING-UX 6.6 "Gözden geçir": a ten minute URL to the candidate's own finished
 * take, nobody else's. Not the candidate's take: UPLOAD_NOT_FOUND (400); still
 * uploading: MEDIA_NOT_READY (409), so the screen can say "Kaydediliyor".
 * The answer is never cached (no-store): the signed URL is the candidate's
 * alone and short-lived.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(req, params, async (request, h) => {
    const played = await playbackUrl(h, new URL(request.url).searchParams.get("ref"));
    if (!played.ok) return refuse(h, played.code, statusOf(played.code));
    return candidateJson({ src: played.url }, { headers: { "Cache-Control": "no-store" } });
  });
}
