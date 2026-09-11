import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import {
  activityAt,
  currentStage,
  takeCounts,
  writeWindow,
} from "@/lib/candidate-flow";
import {
  createMediaAsset,
  normaliseFileMime,
  normaliseMime,
} from "@/lib/candidate-media";
import { getStorage } from "@/lib/storage";
import { badRequest, conflict, readJson, withCandidate } from "@/lib/candidate-api";

/** How many part targets are handed out up front. More are fetched lazily. */
const PREFETCH_PARTS = 24;

type Body = {
  /** Which stage the tab is on. See response/route.ts for why it is checked. */
  stagePosition?: number;
  activityIndex?: number;
  mime?: string;
  kind?: "video" | "audio" | "file";
};

/**
 * Opens the upload before recording starts, so the first chunk has somewhere to
 * go the instant it is produced. `minPartBytes` tells the recorder how much it
 * may coalesce: object storage refuses parts under 5 MiB, local disk does not
 * care and takes every five second chunk as it arrives.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(req, params, async (request, ctx) => {
    const body = await readJson<Body>(request);
    if (!body || typeof body.activityIndex !== "number") {
      return badRequest(ctx, "ACTIVITY_INDEX_REQUIRED");
    }

    const current = await currentStage(ctx);
    if (!current) return conflict(ctx, "NO_STAGE");
    const run = current.target.run;
    if (!run) return conflict(ctx, "STAGE_NOT_STARTED");
    if (body.stagePosition !== current.target.position) {
      return conflict(ctx, "STAGE_MISMATCH");
    }
    if (!writeWindow(run, current.target.stage).allowed) {
      return conflict(ctx, "STAGE_EXPIRED");
    }

    const activity = activityAt(current, body.activityIndex);
    if (!activity) return badRequest(ctx, "ACTIVITY_NOT_FOUND");

    let mime: string;
    if (activity.type === "FILE_UPLOAD") {
      // A file keeps its own type. Running it through the recording rules
      // stored PDFs as video/webm and queued them for transcription.
      const fileMime = normaliseFileMime(
        body.mime,
        activity.config?.acceptedMimeTypes,
      );
      if (!fileMime) return badRequest(ctx, "FILE_TYPE_REJECTED");
      mime = fileMime;
    } else {
      // `maxTakes` is enforced here, on the server's own count of finished
      // recordings, because the client's counter starts at zero on every
      // reload. A recording that never produced a playable asset is not a take.
      const used = (await takeCounts(run.id)).get(activity.id) ?? 0;
      if (used >= activity.maxTakes) return conflict(ctx, "TAKES_EXHAUSTED");
      const fallback = activity.type === "AUDIO" ? "audio/webm" : "video/webm";
      mime = normaliseMime(body.mime, fallback);
    }

    const asset = await createMediaAsset(ctx, run, activity, mime);

    const storage = getStorage();
    const targets = await storage.signPartUrls(
      asset.storageKey,
      asset.uploadId!,
      Array.from({ length: PREFETCH_PARTS }, (_, i) => i + 1),
    );

    return candidateJson({
      uploadRef: asset.id,
      mime,
      minPartBytes: storage.minPartBytes,
      proxy: targets[0]?.proxy ?? true,
      partTargets: targets,
    });
  });
}
