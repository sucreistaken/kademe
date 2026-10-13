import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { currentAttempt } from "@/lib/candidate-context";
import { badRequest, conflict, fail, withSolution } from "@/lib/candidate-api";
import {
  MAX_SEGMENT_BYTES,
  kindAllowed,
  parseSegmentMeta,
  recordingMime,
  sniffMedia,
  uploadWindow,
} from "@/lib/proctor/recording-rules";
import { storeRecordingSegment } from "@/server/recordings";

/**
 * One segment of the continuous proctoring recording: raw body, metadata in
 * the query string, the same token and attempt checks as /proctor/evidence.
 * The storage key is derived here from the token's own attempt; the client
 * names nothing.
 *
 * The one difference from the evidence route: the attempt may already be
 * finished. The browser cuts its last segment at the finish and may still hold
 * a few while it was offline, so segments land for UPLOAD_GRACE_MS after the
 * attempt ends, and only then is the door closed. That is also why a link the
 * exam already marked COMPLETED is let through to the handler, which decides
 * from the attempt itself.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withSolution(
    req,
    params,
    async (request, ctx, solution) => {
      const now = Date.now();
      const url = new URL(request.url);
      const meta = parseSegmentMeta(url.searchParams, now);
      const mime = recordingMime(request.headers.get("content-type"));
      if (!meta || !mime) return badRequest(ctx, "EVIDENCE_INVALID");
      const policy = await solution.proctorPolicy(ctx.assessment.id);
      if (!policy || !kindAllowed(meta.kind, policy)) return badRequest(ctx, "EVIDENCE_INVALID");
      // Refuse an oversized body before reading it into memory.
      if (Number(request.headers.get("content-length") ?? 0) > MAX_SEGMENT_BYTES) return fail(ctx, "RECORDING_TOO_LARGE", 413);
      const body = new Uint8Array(await request.arrayBuffer());
      if (body.byteLength > MAX_SEGMENT_BYTES) return fail(ctx, "RECORDING_TOO_LARGE", 413);
      if (body.byteLength === 0 || !sniffMedia(body, mime)) return badRequest(ctx, "EVIDENCE_INVALID");

      const { attempt } = await currentAttempt(ctx.assessment);
      const window = uploadWindow(attempt, now);
      if (window === "CLOSED") return conflict(ctx, "ALREADY_COMPLETED");
      if (window === "NOT_STARTED") return badRequest(ctx, "EVIDENCE_INVALID");

      const stored = await storeRecordingSegment(ctx, attempt.id, {
        ...meta,
        mime,
        body,
        sessionId: url.searchParams.get("session"),
      });
      return candidateJson({ stored: true, id: stored.id, duplicate: stored.duplicate });
    },
    { limit: 120, allowProblems: ["COMPLETED"] },
  );
}
