import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { itemResponses } from "@/db/schema";
import { candidateJson } from "@/lib/candidate-safe";
import { completeMedia, failMedia, resolveOwnedMedia } from "@/lib/candidate-media";
import { reopenGradingForMedia } from "@/lib/exam-results";
import { enqueueTranscription } from "@/lib/queue";
import { isTranscribableMime } from "@/lib/transcription";
import { badRequest, conflict, readJson, withCandidate } from "@/lib/candidate-api";

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
  return withCandidate(req, params, async (request, ctx) => {
    const body = await readJson<Body>(request);
    const owned = await resolveOwnedMedia(ctx, body?.uploadRef);
    if (!owned) return badRequest(ctx, "UPLOAD_NOT_FOUND");
    // Completing twice (a retry, a beacon plus a fetch) changes nothing.
    if (owned.asset.status !== "UPLOADING")
      return candidateJson({ status: owned.asset.status, bytes: owned.asset.bytes, durationMs: owned.asset.durationMs });

    const parts = owned.asset.parts ?? [];
    if (parts.length === 0) {
      await failMedia(owned.asset.id);
      return conflict(ctx, "NO_PARTS");
    }
    const durationMs =
      typeof body?.durationMs === "number" && body.durationMs > 0 ? Math.round(body.durationMs) : null;
    const asset = await completeMedia(owned.asset, parts, durationMs, body?.incomplete ? "INCOMPLETE" : "READY");

    // Never throws: a queue problem cannot fail the student's answer.
    if (isTranscribableMime(asset.mime)) await enqueueTranscription(asset.id);

    if (asset.itemResponseId) {
      const [response] = await db.select().from(itemResponses).where(eq(itemResponses.id, asset.itemResponseId));
      if (response) {
        // The newest take is the answer. It supersedes a typed alternative.
        const answer = { ...(response.answer ?? {}), mediaAssetId: asset.id };
        delete answer.usedTextAlternative;
        await db.update(itemResponses).set({ answer, updatedAt: new Date() }).where(eq(itemResponses.id, response.id));
        await reopenGradingForMedia(response.id);
      }
    }

    return candidateJson({ status: asset.status, bytes: asset.bytes, durationMs: asset.durationMs });
  }, { allowProblems: ["COMPLETED"] });
}
