import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { getAiProvider } from "@/lib/ai";
import { findUngraded, runGrading } from "@/lib/exam-results";
import { GRADING_QUEUE, enqueueGrading, queue, superviseQueue, type GradingJob } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** One call grades at most this many answers, so a run stays bounded. */
const BATCH = 3;

/**
 * Drains the grading queue: writing and speaking answers get an AI proposal.
 * Same shape as the transcription drain, same shared secret. A proposal is
 * never a final level; the teacher decides.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const offered = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(offered, secret)) return Response.json({ error: "forbidden" }, { status: 403 });

  if (!getAiProvider().available) {
    return Response.json({ skipped: true, reason: "no AI provider configured; gradings stay PENDING" });
  }
  const supervised = await superviseQueue(GRADING_QUEUE);
  const missed = await findUngraded();
  for (const id of missed) await enqueueGrading(id);

  const boss = await queue();
  const jobs = await boss.fetch<GradingJob>(GRADING_QUEUE, { batchSize: BATCH });
  const results: Array<{ gradingId: string; outcome: string }> = [];
  for (const job of jobs) {
    const gradingId = job.data?.gradingId;
    if (!gradingId) {
      await boss.complete(GRADING_QUEUE, job.id, { skipped: "no id" });
      continue;
    }
    try {
      const outcome = await runGrading(gradingId);
      await boss.complete(GRADING_QUEUE, job.id, outcome);
      results.push({ gradingId, outcome: outcome.status });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await boss.fail(GRADING_QUEUE, job.id, { reason });
      results.push({ gradingId, outcome: `FAILED: ${reason}` });
    }
  }
  return Response.json({ supervised, swept: missed.length, fetched: jobs.length, results });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
