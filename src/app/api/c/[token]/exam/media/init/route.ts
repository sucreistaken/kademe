import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { checkWrite } from "@/lib/exam-flow";
import { createMediaAsset, normaliseMime, takeCount } from "@/lib/candidate-media";
import { getStorage } from "@/lib/storage";
import { badRequest, conflict, readJson } from "@/lib/candidate-api";
import { withExamCandidate } from "@/lib/exam-candidate-api";

/** How many part targets are handed out up front. More are fetched lazily. */
const PREFETCH_PARTS = 24;

type Body = {
  /** Which section and item the tab is on. A mismatch is refused, never guessed. */
  sectionPosition?: number;
  sequence?: number;
  mime?: string;
};

/**
 * Opens the upload for a speaking answer before recording starts, so the first
 * chunk has somewhere to go the instant it is produced. `minPartBytes` tells
 * the recorder how much it may coalesce: object storage refuses parts under
 * 5 MiB, local disk takes every five second chunk as it arrives.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withExamCandidate(req, params, async (request, ctx) => {
    const body = await readJson<Body>(request);
    const check = await checkWrite(ctx, body?.sectionPosition, body?.sequence);
    if (!check.ok) return conflict(ctx, check.code);
    const { run, response } = check;
    const content = response.itemSnapshot.content;
    if (content.kind !== "SPEAKING") return badRequest(ctx, "NOT_A_RECORDING");

    // Enforced on the server's own count, because the client's counter starts
    // at zero on every reload.
    if ((await takeCount(response.id)) >= content.maxTakes) return conflict(ctx, "TAKES_EXHAUSTED");

    const mime = normaliseMime(body?.mime, "video/webm");
    const asset = await createMediaAsset(ctx, run, response, mime);
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
