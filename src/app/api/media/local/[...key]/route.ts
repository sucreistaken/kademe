import type { NextRequest } from "next/server";
import {
  LocalStorageProvider,
  extensionMime,
  getStorage,
  verifyLocalKeySignature,
} from "@/lib/storage";

/**
 * Serves an object back out of the local development storage directory. This
 * exists only so that `StorageProvider.getSignedUrl()` returns something that
 * actually plays while the R2 credentials are missing; with R2 configured the
 * signed URL points at the bucket and this route is never reached.
 *
 * Range requests are handled, and that is not a detail: the review screen seeks
 * the video from a click on a transcript line, and a video element seeks by
 * asking for a byte range. Answering every request with the whole file and a
 * 200 leaves the player stuck at wherever it started.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const storage = getStorage();
  if (!(storage instanceof LocalStorageProvider)) {
    return new Response("Not found", { status: 404 });
  }

  const { key: segments } = await params;
  const key = segments.join("/");
  const url = new URL(req.url);
  const expires = Number(url.searchParams.get("expires"));
  const sig = url.searchParams.get("sig") ?? "";

  if (!verifyLocalKeySignature(key, expires, sig)) {
    return new Response("Forbidden", { status: 403 });
  }

  const contentType = extensionMime(key);

  try {
    const requested = parseRange(req.headers.get("range"));
    const { bytes, totalBytes, stream } = await storage.openStream(
      key,
      requested ?? undefined,
    );

    if (!requested) {
      return new Response(stream, {
        headers: {
          "content-type": contentType,
          "content-length": String(bytes),
          "accept-ranges": "bytes",
          "cache-control": "private, max-age=60",
        },
      });
    }

    const start = requested.start;
    const end = Math.min(requested.end, totalBytes - 1);
    return new Response(stream, {
      status: 206,
      headers: {
        "content-type": contentType,
        "content-length": String(bytes),
        "content-range": `bytes ${start}-${end}/${totalBytes}`,
        "accept-ranges": "bytes",
        "cache-control": "private, max-age=60",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

/** `bytes=100-199`, `bytes=100-`. Anything else is treated as no range. */
function parseRange(header: string | null): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "") return null; // suffix ranges are not needed here
  const start = Number(rawStart);
  const end = rawEnd === "" ? Number.MAX_SAFE_INTEGER : Number(rawEnd);
  if (!Number.isFinite(start) || end < start) return null;
  return { start, end };
}
