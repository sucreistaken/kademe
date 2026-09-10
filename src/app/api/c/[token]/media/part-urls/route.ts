import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { resolveOwnedMedia } from "@/lib/candidate-media";
import { getStorage } from "@/lib/storage";
import { badRequest, readJson, withCandidate } from "@/lib/candidate-api";

/** More part targets for a recording that outran the batch handed out at init. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(req, params, async (request, ctx) => {
    const body = await readJson<{ uploadRef?: string; from?: number; count?: number }>(request);
    const owned = await resolveOwnedMedia(ctx, body?.uploadRef);
    if (!owned?.asset.uploadId) return badRequest(ctx, "UPLOAD_NOT_FOUND");

    const from = Math.max(1, Math.min(9000, Number(body?.from ?? 1)));
    const count = Math.max(1, Math.min(48, Number(body?.count ?? 24)));
    const targets = await getStorage().signPartUrls(
      owned.asset.storageKey,
      owned.asset.uploadId,
      Array.from({ length: count }, (_, i) => from + i),
    );
    return candidateJson({ partTargets: targets });
  });
}
