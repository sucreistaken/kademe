import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import {
  TRANSCRIPTION_QUEUE,
  enqueueTranscription,
  queue,
  superviseQueue,
  type TranscriptionJob,
} from "@/lib/queue";
import { findUntranscribed, runTranscription } from "@/lib/transcribe-job";
import { getTranscriber } from "@/lib/transcription";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** One call transcribes at most this many recordings, so a run stays bounded. */
const BATCH = 3;

/**
 * Drains the transcription queue. Called on a schedule (Cloud Scheduler) rather
 * than by a resident worker, because the application scales to zero and a
 * long-lived `boss.work()` subscription would have no lifetime to run in.
 *
 * Protected by a shared secret. Everything it does is idempotent: a job already
 * transcribed is skipped, and a job that fails goes back to pg-boss to be
 * retried with backoff.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  const offered = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(offered, secret)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const transcriber = getTranscriber();
  if (!transcriber.available) {
    // Leave the jobs queued rather than burning their retry budget against a
    // provider that is not configured yet.
    return Response.json({
      skipped: true,
      reason: "ELEVENLABS_API_KEY is not set, no transcription provider",
      provider: transcriber.name,
    });
  }

  // Maintenance first: fail jobs left `active` by a killed process, so their
  // singleton key stops blocking a fresh send. See superviseQueue().
  const supervised = await superviseQueue();

  // Safety net next: anything that should have been queued and was not.
  const missed = await findUntranscribed();
  for (const asset of missed) await enqueueTranscription(asset.id);

  const boss = await queue();
  const jobs = await boss.fetch<TranscriptionJob>(TRANSCRIPTION_QUEUE, {
    batchSize: BATCH,
  });

  const results: Array<{ id: string; mediaAssetId: string; outcome: string }> = [];

  for (const job of jobs) {
    const mediaAssetId = job.data?.mediaAssetId;
    if (!mediaAssetId) {
      await boss.complete(TRANSCRIPTION_QUEUE, job.id, { skipped: "no id" });
      continue;
    }
    try {
      const outcome = await runTranscription(mediaAssetId);
      await boss.complete(TRANSCRIPTION_QUEUE, job.id, outcome);
      results.push({ id: job.id, mediaAssetId, outcome: outcome.status });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await boss.fail(TRANSCRIPTION_QUEUE, job.id, { reason });
      results.push({ id: job.id, mediaAssetId, outcome: `FAILED: ${reason}` });
    }
  }

  return Response.json({
    provider: transcriber.name,
    supervised,
    swept: missed.length,
    fetched: jobs.length,
    results,
  });
}

/** Same work, so a scheduler that can only issue GET still drives it. */
export async function GET(req: NextRequest) {
  return POST(req);
}
