import type { NextRequest } from "next/server";
import { can } from "@/lib/authorize";
import { RangeNotSatisfiableError, getStorage } from "@/lib/storage";
import { parseByteRange } from "@/lib/proctor/recording-rules";
import { findSegmentForViewer } from "@/server/recordings";
import { currentUser } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * One segment of a proctoring recording, streamed to a signed-in panel user
 * whose role may watch recordings (`media:view`) and whose organisation owns
 * it. Never a public or signed URL: the bytes always pass this check, with the
 * session cookie, on every request, including each range request a seeking
 * video element makes.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  // A route handler answers rather than redirecting: the caller is a <video> element.
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!can(user, "media:view")) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const segment = await findSegmentForViewer(user.orgId, id);
  // Another organisation's segment is answered exactly like a missing one.
  if (!segment) return new Response("Not found", { status: 404 });

  const headers = {
    "content-type": segment.mime,
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=300",
    "x-content-type-options": "nosniff",
    "content-disposition": "inline",
  };
  const requested = parseByteRange(req.headers.get("range"));
  try {
    const { bytes, totalBytes, stream } = await getStorage().openStream(segment.storageKey, requested ?? undefined);
    if (!requested) {
      return new Response(stream, { headers: { ...headers, "content-length": String(bytes) } });
    }
    const end = Math.min(requested.end, totalBytes - 1);
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "content-length": String(bytes), "content-range": `bytes ${requested.start}-${end}/${totalBytes}` },
    });
  } catch (error) {
    if (error instanceof RangeNotSatisfiableError) {
      return new Response("Range not satisfiable", { status: 416, headers: { "content-range": `bytes */${error.totalBytes}` } });
    }
    return new Response("Not found", { status: 404 });
  }
}
