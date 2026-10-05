import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { completeMedia, failMedia, resolveOwnedMedia } from "@/lib/candidate-media";
import { enqueueTranscription } from "@/lib/queue";
import { isTranscribableMime } from "@/lib/transcription";
import { badRequest, conflict, readJson, withSolution } from "@/lib/candidate-api";

type Body = {
  uploadRef?: string;
  durationMs?: number;
  /** Set when the recording was cut short but the parts we have are playable. */
  incomplete?: boolean;
};

/**
 * Assembles the parts and attaches the finished recording to the answer it was
 * opened for. The asset carries its own item response, so a completion that
 * arrives after the student moved on still lands on the right task.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withSolution(req, params, async (request, ctx, solution) => {
    const body = await readJson<Body>(request);
    const owned = await resolveOwnedMedia(ctx, body?.uploadRef);
    if (!owned) return badRequest(ctx, "UPLOAD_NOT_FOUND");
    // Completing twice (a retry, a beacon plus a fetch) changes nothing.
    if (owned.asset.status !== "UPLOADING")
      return candidateJson({ status: owned.asset.status, bytes: owned.asset.bytes, durationMs: owned.asset.durationMs });

    const parts = owned.asset.parts ?? [];
    if (parts.length === 0) {
      await failMedia(owned.asset.id);
      // The solution decides that answer again (hiring: an older finished take becomes it).
      // Its failure is logged, never answered: the response is the same without the hook.
      try {
        await solution.attempts.onMediaFailed?.({ ...owned.asset, status: "FAILED" });
      } catch (error) {
        console.error(`[media/complete] ${solution.key} onMediaFailed failed for ${owned.asset.id}`, error);
      }
      return conflict(ctx, "NO_PARTS");
    }
    const durationMs =
      typeof body?.durationMs === "number" && body.durationMs > 0 ? Math.round(body.durationMs) : null;
    const asset = await completeMedia(owned.asset, parts, durationMs, body?.incomplete ? "INCOMPLETE" : "READY");

    // Never throws: a queue problem cannot fail the student's answer.
    if (isTranscribableMime(asset.mime)) await enqueueTranscription(asset.id);

    // Not caught here: an attach failure fails the request, so the exam's student
    // sees the error and records again (a retry would find the asset READY and
    // skip the hook). A solution that can recover by itself (hiring) catches inside its hook.
    await solution.attempts.onMediaComplete(asset);

    return candidateJson({ status: asset.status, bytes: asset.bytes, durationMs: asset.durationMs });
  }, { allowProblems: ["COMPLETED"] });
}
