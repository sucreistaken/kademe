import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import {
  closeExpiredRuns,
  expireLinks,
  salvageAbandonedUploads,
} from "@/lib/close-expired";
import { solutionModules } from "@/solutions/registry.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One call settles at most this many runs, so a scheduled run stays bounded. */
const BATCH = 50;

/**
 * Salvaging talks to object storage once per asset, so it gets a smaller
 * batch than the pure database work above.
 */
const SALVAGE_BATCH = 20;

/**
 * Closes stage runs whose deadline has passed, expires links past their date,
 * and finalises recordings whose browser died mid upload. Meant to be called
 * every minute by Cloud Scheduler.
 *
 * Without it the server clock is right but nothing acts on it: a candidate who
 * closes the tab leaves the stage PENDING forever, the manager sees "in
 * progress" indefinitely, and whatever was typed is never marked submitted.
 *
 * Protected by the same shared secret as the other cron endpoints, and
 * idempotent: a settled run no longer matches the query.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  const offered = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!safeEqual(offered, secret)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date();
  // Salvage before closing: a clip rescued here is attached to its answer, so
  // a run being closed in the same tick counts it and lands as PARTIAL rather
  // than EXPIRED. Best effort, so a storage outage cannot stop runs closing.
  let uploads;
  try {
    uploads = await salvageAbandonedUploads(now, SALVAGE_BATCH);
  } catch (error) {
    console.error("[close-expired] upload salvage sweep failed", error);
    uploads = { error: error instanceof Error ? error.message : String(error) };
  }
  const runs = await closeExpiredRuns(now, BATCH);
  const links = await expireLinks(now);
  // Solutions with their own timed parts close them here (hiring stage runs).
  const solutions: Record<string, unknown> = {};
  for (const solution of solutionModules()) {
    if (!solution.attempts.closeExpired) continue;
    try {
      solutions[solution.key] = await solution.attempts.closeExpired(now, BATCH);
    } catch (error) {
      console.error(`[close-expired] ${solution.key} sweep failed`, error);
      solutions[solution.key] = { error: error instanceof Error ? error.message : String(error) };
    }
  }

  return Response.json({ at: now.toISOString(), runs, links, uploads, solutions });
}
