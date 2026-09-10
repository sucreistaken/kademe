import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { recordPart, resolveOwnedMedia } from "@/lib/candidate-media";
import { badRequest, readJson, withCandidate } from "@/lib/candidate-api";

type Body = { uploadRef?: string; partNumber?: number; etag?: string; bytes?: number };

/**
 * Only used on the direct-to-bucket path: the server never saw those bytes, so
 * the browser tells it which part landed. Without this a crashed recording
 * would leave parts in the bucket that nothing knows how to assemble.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const body = await readJson<Body>(request);
      const owned = await resolveOwnedMedia(ctx, body?.uploadRef);
      if (!owned) return badRequest(ctx, "UPLOAD_NOT_FOUND");

      const partNumber = Number(body?.partNumber);
      if (!Number.isInteger(partNumber) || partNumber < 1) {
        return badRequest(ctx, "BAD_PART_NUMBER");
      }
      await recordPart(owned.asset, {
        partNumber,
        etag: String(body?.etag ?? "").replaceAll('"', "").slice(0, 128),
        bytes: Math.max(0, Number(body?.bytes ?? 0)),
      });
      return candidateJson({ recorded: true });
    },
    { limit: 600, windowMs: 60_000 },
  );
}
