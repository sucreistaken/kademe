import type { NextRequest } from "next/server";
import { withExamCandidate } from "@/lib/exam-candidate-api";
import { servedImageKey } from "@/lib/exam/served-image";
import { getStorage } from "@/lib/storage";

const notFound = () => new Response(null, { status: 404 });

/**
 * One picture of a served exam item. The browser names it by the item's
 * sequence and the opaque slot it was given (an option's or target's alias, or
 * "p0", "p1" for a task picture). The storage key stays on the server: the
 * bytes are streamed from storage, with no signed URL and no key in the
 * response. Anything that does not resolve to a served picture is a plain 404.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; sequence: string; slot: string }> }) {
  const { sequence, slot } = await params;
  return withExamCandidate(req, params, async (_request, ctx) => {
    if (!/^\d{1,6}$/.test(sequence) || !/^[a-z0-9]{1,12}$/.test(slot)) return notFound();
    const key = await servedImageKey(ctx, Number(sequence), slot);
    if (!key) return notFound();
    try {
      const { stream, totalBytes } = await getStorage().openStream(key);
      return new Response(stream, {
        headers: {
          "content-type": "image/webp",
          "content-length": String(totalBytes),
          "cache-control": "private, max-age=3600",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return notFound();
    }
  });
}
