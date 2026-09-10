import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { closeExpiredRuns, expireLinks } from "@/lib/close-expired";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One call settles at most this many runs, so a scheduled run stays bounded. */
const BATCH = 50;

/**
 * Closes stage runs whose deadline has passed, and expires links past their
 * date. Meant to be called every minute by Cloud Scheduler.
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
  const runs = await closeExpiredRuns(now, BATCH);
  const links = await expireLinks(now);

  return Response.json({ at: now.toISOString(), runs, links });
}
