import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { PROCTOR_REVIEW_QUEUE, enqueueProctorReview, queue, superviseQueue, type ProctorReviewJob } from "@/lib/queue";
import { findQueuedReviews, runProctorReview } from "@/server/proctor-review-job";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BATCH = 4;

/** Drains the AI second look at proctoring flags. Bounded, idempotent, shared secret. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const offered = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(offered, secret)) return Response.json({ error: "forbidden" }, { status: 403 });

  const supervised = await superviseQueue(PROCTOR_REVIEW_QUEUE);
  const queued = await findQueuedReviews();
  for (const r of queued) await enqueueProctorReview(r.eventId);
  const boss = await queue();
  const jobs = await boss.fetch<ProctorReviewJob>(PROCTOR_REVIEW_QUEUE, { batchSize: BATCH });
  const results: Array<{ eventId: string; outcome: string }> = [];
  for (const job of jobs) {
    const eventId = job.data?.eventId;
    if (!eventId) {
      await boss.complete(PROCTOR_REVIEW_QUEUE, job.id, { skipped: "no id" });
      continue;
    }
    try {
      const outcome = await runProctorReview(eventId);
      // Frames still uploading: hand the job back so it is tried again later.
      if (outcome.status === "WAITING") await boss.fail(PROCTOR_REVIEW_QUEUE, job.id, outcome);
      else await boss.complete(PROCTOR_REVIEW_QUEUE, job.id, outcome);
      results.push({ eventId, outcome: `${outcome.status}: ${outcome.detail}` });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await boss.fail(PROCTOR_REVIEW_QUEUE, job.id, { reason });
      results.push({ eventId, outcome: `FAILED: ${reason}` });
    }
  }
  return Response.json({ supervised, swept: queued.length, fetched: jobs.length, results });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
