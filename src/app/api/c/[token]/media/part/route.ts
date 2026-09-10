import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { recordPart, resolveOwnedMedia } from "@/lib/candidate-media";
import { getStorage } from "@/lib/storage";
import { badRequest, withCandidate } from "@/lib/candidate-api";

/** One chunk cannot be larger than this even after coalescing. */
const MAX_PART_BYTES = 24 * 1024 * 1024;

/**
 * The proxy path: used while storage is local disk. With R2 the browser PUTs
 * straight to the bucket and this route is never called, which is why the
 * recorder treats both the same and only reads `proxy` to decide where to send.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const url = new URL(request.url);
      const uploadRef = url.searchParams.get("ref");
      const partNumber = Number(url.searchParams.get("part"));
      if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
        return badRequest(ctx, "BAD_PART_NUMBER");
      }

      const owned = await resolveOwnedMedia(ctx, uploadRef);
      if (!owned?.asset.uploadId) return badRequest(ctx, "UPLOAD_NOT_FOUND");
      if (owned.asset.status !== "UPLOADING") {
        return badRequest(ctx, "UPLOAD_CLOSED");
      }

      const buffer = new Uint8Array(await request.arrayBuffer());
      if (buffer.byteLength === 0) return badRequest(ctx, "EMPTY_PART");
      if (buffer.byteLength > MAX_PART_BYTES) {
        return badRequest(ctx, "PART_TOO_LARGE");
      }

      const part = await getStorage().uploadPart(
        owned.asset.storageKey,
        owned.asset.uploadId,
        partNumber,
        buffer,
      );
      await recordPart(owned.asset, part);

      return candidateJson(part, { headers: { ETag: part.etag } });
    },
    { limit: 600, windowMs: 60_000 },
  );
}
