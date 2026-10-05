import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { openUpload } from "@/solutions/hiring/server/candidate";
import { MediaInitBody, readBody, refuse, statusOf, withHiringCandidate } from "@/solutions/hiring/server/candidate-route";

/**
 * Opens a take or a file upload for the running question before the first byte
 * exists; the parts and the completion go through the core /media/* routes.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withHiringCandidate(req, params, async (request, h) => {
    const body = await readBody(request, MediaInitBody);
    if (!body) return refuse(h, "REQUEST_INVALID", 400);
    const opened = await openUpload(h, { position: body.stagePosition, activityId: body.activityId, kind: body.kind, mime: body.mime, name: body.name, bytes: body.bytes });
    if (!opened.ok) return refuse(h, opened.code, statusOf(opened.code));
    return candidateJson(opened.upload);
  });
}
