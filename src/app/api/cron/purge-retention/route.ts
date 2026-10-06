import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { DEFAULT_BATCH, runRetention } from "@/lib/retention";
import { purgeStaleDrafts } from "@/server/create/drafts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Retention purge. Meant to be called once a day by Cloud Scheduler.
 *
 * THIS ENDPOINT REPORTS AND DELETES NOTHING BY DEFAULT.
 *
 * Two independent switches have to be on before a single byte is removed, and
 * neither of them is on anywhere right now:
 *
 *   1. the environment variable RETENTION_PURGE_ENABLED must be exactly "true"
 *   2. the request must carry ?apply=1
 *
 * One switch alone does nothing. The env var exists so that a misconfigured
 * scheduler, a copied curl line or a stray query string cannot delete anything
 * on a machine where deletion was never meant to be possible; the query
 * parameter exists so that even on a machine where it is allowed, a plain call
 * still only reports. Report mode opens no write at all, not even an audit row.
 *
 * Protected by the same shared secret as the other cron endpoints, bounded by a
 * batch size, and idempotent: rows already marked or already gone stop matching.
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

  const url = new URL(req.url);
  const requested = url.searchParams.get("apply") === "1";
  const allowed = process.env.RETENTION_PURGE_ENABLED === "true";
  const apply = requested && allowed;

  const batchParam = url.searchParams.get("batch");
  const batch = batchParam === null ? DEFAULT_BATCH : Number(batchParam);

  const report = await runRetention({ batch, apply });
  // Advanced drafts that never reached APPLIED, 30 days on (spec 5.3); same two switches.
  const creationDrafts = await purgeStaleDrafts({ now: new Date(), apply });

  return Response.json({
    ...report,
    creationDrafts,
    /**
     * Spelled out in every response so nobody has to guess from the mode alone
     * why a run did or did not delete.
     */
    switches: {
      applyRequested: requested,
      applyAllowed: allowed,
      note: apply
        ? "APPLY: rows and storage objects were removed"
        : "REPORT ONLY: nothing was written. Deletion needs RETENTION_PURGE_ENABLED=true in the environment AND ?apply=1 on the request.",
    },
  });
}

/** Same work, so a scheduler that can only issue GET still drives it. */
export async function GET(req: NextRequest) {
  return POST(req);
}
