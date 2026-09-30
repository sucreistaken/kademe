import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { workingAttempt } from "@/lib/exam-flow";
import { EVIDENCE_MIME, MAX_CLIP_BYTES, MAX_FRAME_BYTES, storeEvidence } from "@/server/proctoring";
import { badRequest, conflict, withCandidate } from "@/lib/candidate-api";

const KINDS = ["WEBCAM_FRAME", "SCREEN_FRAME", "CLIP_VIDEO", "CLIP_AUDIO"] as const;
const TRIGGERS = ["REFERENCE", "PERIODIC", "VIOLATION"] as const;

/**
 * One frame or clip, raw body, metadata in the query string. The storage key
 * is derived here from the token's own attempt; the client names nothing.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const url = new URL(request.url);
      const kind = url.searchParams.get("kind") as (typeof KINDS)[number];
      const trigger = url.searchParams.get("trigger") as (typeof TRIGGERS)[number];
      if (!KINDS.includes(kind) || !TRIGGERS.includes(trigger)) return badRequest(ctx, "EVIDENCE_INVALID");
      const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!EVIDENCE_MIME.includes(mime)) return badRequest(ctx, "EVIDENCE_INVALID");
      if (ctx.assessment.config.proctoring.preset === "OFF") return badRequest(ctx, "EVIDENCE_INVALID");
      const max = kind.startsWith("CLIP") ? MAX_CLIP_BYTES : MAX_FRAME_BYTES;
      // Refuse an oversized body before reading it into memory.
      if (Number(request.headers.get("content-length") ?? 0) > max) return badRequest(ctx, "EVIDENCE_INVALID");
      const body = new Uint8Array(await request.arrayBuffer());
      if (body.byteLength === 0 || body.byteLength > max) return badRequest(ctx, "EVIDENCE_INVALID");

      const { attempt, finished } = await workingAttempt(ctx.assessment.id);
      if (finished) return conflict(ctx, "ALREADY_COMPLETED");
      const at = Number(url.searchParams.get("at"));
      const capturedAt = Number.isFinite(at) && Math.abs(at - Date.now()) < 10 * 60_000 ? new Date(at) : new Date();
      const num = (k: string) => {
        const v = Number(url.searchParams.get(k));
        return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
      };
      let signals: Record<string, unknown> | null = null;
      const faces = url.searchParams.get("faces");
      if (faces !== null && Number.isFinite(Number(faces))) signals = { faces: Number(faces) };
      const stored = await storeEvidence(ctx, attempt.id, {
        kind,
        trigger,
        capturedAt,
        mime,
        body,
        clientEventId: url.searchParams.get("event")?.slice(0, 64) ?? null,
        width: num("w"),
        height: num("h"),
        browserSignals: signals,
      });
      return candidateJson({ stored: true, id: stored.id });
    },
    { limit: 240 },
  );
}
