import type { NextRequest } from "next/server";
import type { ResponsePayload } from "@/db/schema/types";
import { candidateJson } from "@/lib/candidate-safe";
import {
  activityAt,
  currentStage,
  loadResponses,
  saveResponse,
} from "@/lib/candidate-flow";
import { completeMedia, failMedia, resolveOwnedMedia } from "@/lib/candidate-media";
import { enqueueTranscription } from "@/lib/queue";
import { isTranscribableMime } from "@/lib/transcription";
import { badRequest, conflict, readJson, withCandidate } from "@/lib/candidate-api";

type Body = {
  uploadRef?: string;
  activityIndex?: number;
  durationMs?: number;
  /** Set when the recording was cut short but the parts we have are playable. */
  incomplete?: boolean;
};

/**
 * Assembles the parts and attaches the finished asset to the answer. A recording
 * that was cut short still completes, marked INCOMPLETE, so the manager sees
 * however much of it exists instead of an empty player.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(req, params, async (request, ctx) => {
    const body = await readJson<Body>(request);
    const owned = await resolveOwnedMedia(ctx, body?.uploadRef);
    if (!owned) return badRequest(ctx, "UPLOAD_NOT_FOUND");

    const parts = owned.asset.parts ?? [];
    if (parts.length === 0) {
      await failMedia(owned.asset.id);
      return conflict(ctx, "NO_PARTS");
    }

    const durationMs =
      typeof body?.durationMs === "number" && body.durationMs > 0
        ? Math.round(body.durationMs)
        : null;

    const asset = await completeMedia(
      owned.asset,
      parts,
      durationMs,
      body?.incomplete ? "INCOMPLETE" : "READY",
    );

    // A finished recording is worth reading, so it goes into the transcription
    // queue here. INCOMPLETE assets are queued too: a cut-short answer is
    // exactly the one a manager would rather read than watch. Enqueueing never
    // throws, so a queue problem cannot fail the candidate's submission.
    if (isTranscribableMime(asset.mime)) {
      await enqueueTranscription(asset.id);
    }

    // Attach it to the answer, keeping whatever text the candidate already wrote.
    const current = await currentStage(ctx);
    if (current && current.target.run && typeof body?.activityIndex === "number") {
      const activity = activityAt(current, body.activityIndex);
      if (activity) {
        const rows = await loadResponses(current.target.run.id);
        const before = rows.find((r) => r.activityId === activity.id)?.payload;
        const payload: ResponsePayload = { ...(before ?? {}) };
        // A recording supersedes the written alternative, so the flag that told
        // the manager "this was typed instead of recorded" has to go with it.
        delete payload.usedTextAlternative;
        if (activity.type === "FILE_UPLOAD") {
          payload.fileAssetIds = [...(before?.fileAssetIds ?? []), asset.id];
        } else {
          payload.mediaAssetId = asset.id;
        }
        await saveResponse(current.target.run.id, activity, payload);
      }
    }

    return candidateJson({
      status: asset.status,
      bytes: asset.bytes,
      durationMs: asset.durationMs,
    });
  });
}
