import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { currentAttempt } from "@/lib/candidate-context";
import { badRequest, conflict, fail, withSolution } from "@/lib/candidate-api";
import {
  MAX_SEGMENT_BYTES,
  kindAllowed,
  parseSegmentMeta,
  recordingMime,
  recordingPermitted,
  sniffMedia,
  uploadWindow,
} from "@/lib/proctor/recording-rules";
import { recordingConsent, storeRecordingSegment } from "@/server/recordings";

/**
 * One segment of the continuous proctoring recording: raw body, metadata in
 * the query string, the same token and attempt checks as /proctor/evidence,
 * and only when the consent the candidate accepted announces the recording.
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
      // Only under a consent text that says the exam is recorded. A refusal
      // the browser does not retry: it should not have recorded at all.
      if (!recordingPermitted(policy, await recordingConsent(ctx.assessment.id))) return fail(ctx, "CONSENT_REQUIRED", 403);
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
