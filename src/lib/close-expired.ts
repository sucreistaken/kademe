import { and, asc, eq, inArray, isNotNull, isNull, like, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  stageRuns,
  stages,
  activities,
  responses,
  attempts,
  assessmentLinks,
  mediaAssets,
} from "@/db/schema";
import type { ResponsePayload } from "@/db/schema/types";
import { enqueueTranscription } from "@/lib/queue";
import { getStorage } from "@/lib/storage";
import { isTranscribableMime } from "@/lib/transcription";
import type { TimeoutBehaviour } from "./timer";
import {
  SALVAGE_MIN_AGE_MS,
  decideClose,
  decideSalvage,
  hasAnswer,
  isDueForClose,
} from "./stage-timeout";

export { decideClose, hasAnswer, isDueForClose, decideSalvage };

/**
 * Closes stage runs whose deadline has passed.
 *
 * Without this a candidate who closes the tab leaves the stage open forever:
 * the clock is server-side so the deadline is correct, but nothing ever acts on
 * it. The run stays PENDING, the manager sees "in progress" indefinitely, and
 * whatever the candidate did type is never marked as submitted.
 */

export type CloseResult = {
  scanned: number;
  closed: number;
  leftOpen: number;
  /** Runs the candidate submitted between our read and our write. */
  raced: number;
  attemptsCompleted: number;
  details: Array<{ stageRunId: string; outcome: string }>;
};

/**
 * One pass. Bounded by `limit` so a scheduled call stays predictable, and
 * idempotent: a run already closed no longer matches the query.
 *
 * The WHERE clause is `isDueForClose()` in SQL. ALLOW_LATE stages are excluded
 * here and not only in `decideClose()`: they are never closed by the server, so
 * returning them would fill the batch with rows that are left open every tick,
 * and fifty abandoned late-allowed runs would starve everything behind them.
 * Oldest deadline first, so a backlog drains in the order it was incurred.
 */
export async function closeExpiredRuns(
  now: Date = new Date(),
  limit = 50,
): Promise<CloseResult> {
  const due = await db
    .select({
      run: stageRuns,
      onTimeout: stages.onTimeout,
      stageId: stages.id,
    })
    .from(stageRuns)
    .innerJoin(stages, eq(stages.id, stageRuns.stageId))
    .where(
      and(
        eq(stageRuns.completion, "PENDING"),
        isNull(stageRuns.submittedAt),
        lt(stageRuns.deadlineAt, now),
        ne(stages.onTimeout, "ALLOW_LATE"),
      ),
    )
    .orderBy(asc(stageRuns.deadlineAt))
    .limit(limit);

  const result: CloseResult = {
    scanned: due.length,
    closed: 0,
    leftOpen: 0,
    raced: 0,
    attemptsCompleted: 0,
    details: [],
  };
  if (due.length === 0) return result;

  const stageIds = [...new Set(due.map((d) => d.stageId))];
  const runIds = due.map((d) => d.run.id);

  const [activityRows, responseRows] = await Promise.all([
    db
      .select({
        id: activities.id,
        stageId: activities.stageId,
        isRequired: activities.isRequired,
      })
      .from(activities)
      .where(inArray(activities.stageId, stageIds)),
    db
      .select()
      .from(responses)
      .where(inArray(responses.stageRunId, runIds)),
  ]);

  const touchedAttempts = new Set<string>();

  for (const row of due) {
    const stageActivities = activityRows.filter((a) => a.stageId === row.stageId);
    const mine = responseRows.filter((r) => r.stageRunId === row.run.id);
    const answeredIds = new Set(
      mine.filter((r) => hasAnswer(r.payload)).map((r) => r.activityId),
    );

    const decision = decideClose({
      behaviour: row.onTimeout as TimeoutBehaviour,
      requiredCount: stageActivities.filter((a) => a.isRequired).length,
      answeredRequired: stageActivities.filter(
        (a) => a.isRequired && answeredIds.has(a.id),
      ).length,
      answeredAny: answeredIds.size,
    });

    if (decision.action === "LEAVE_OPEN") {
      result.leftOpen += 1;
      result.details.push({ stageRunId: row.run.id, outcome: decision.reason });
      continue;
    }

    // The guard repeats the SELECT's conditions on purpose. The candidate's own
    // submit can land in the seconds between our read and this write (the
    // client allows a few seconds of slack past the deadline), and without it
    // a COMPLETE submission would be overwritten with PARTIAL or EXPIRED and
    // flagged late. A row that no longer matches was settled by somebody
    // else, and that settlement wins.
    const changed = await db
      .update(stageRuns)
      .set({
        completion: decision.completion,
        submittedAt: now,
        wasLate: decision.late,
      })
      .where(
        and(
          eq(stageRuns.id, row.run.id),
          eq(stageRuns.completion, "PENDING"),
          isNull(stageRuns.submittedAt),
        ),
      )
      .returning({ id: stageRuns.id });

    if (changed.length === 0) {
      result.raced += 1;
      result.details.push({
        stageRunId: row.run.id,
        outcome: "already settled by the candidate",
      });
      continue;
    }

    result.closed += 1;
    result.details.push({ stageRunId: row.run.id, outcome: decision.completion });
    touchedAttempts.add(row.run.attemptId);
  }

  // An attempt whose every stage run is settled is finished, and the link that
  // led to it should stop saying "in progress".
  for (const attemptId of touchedAttempts) {
    const siblings = await db
      .select({ completion: stageRuns.completion })
      .from(stageRuns)
      .where(eq(stageRuns.attemptId, attemptId));
    if (siblings.some((s) => s.completion === "PENDING")) continue;

    await db
      .update(attempts)
      .set({ completedAt: now })
      .where(and(eq(attempts.id, attemptId), isNull(attempts.completedAt)));

    const [row] = await db
      .select({ assessmentId: attempts.assessmentId })
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);
    if (row) {
      await db
        .update(assessmentLinks)
        .set({ status: "COMPLETED" })
        .where(
          and(
            eq(assessmentLinks.assessmentId, row.assessmentId),
            inArray(assessmentLinks.status, ["IN_PROGRESS", "NOT_STARTED"]),
          ),
        );
    }
    result.attemptsCompleted += 1;
  }

  return result;
}

/** Marks links whose expiry has passed. Separate from stage timing on purpose. */
export async function expireLinks(now: Date = new Date()) {
  const rows = await db
    .update(assessmentLinks)
    .set({ status: "EXPIRED" })
    .where(
      and(
        lt(assessmentLinks.expiresAt, now),
        inArray(assessmentLinks.status, [
          "NOT_STARTED",
          "IN_PROGRESS",
          "RETAKE_AVAILABLE",
          "RETAKE_REQUESTED",
        ]),
      ),
    )
    .returning({ id: assessmentLinks.id });
  return { expired: rows.length };
}

export type SalvageResult = {
  scanned: number;
  salvaged: number;
  failed: number;
  skipped: number;
  errors: number;
  details: Array<{ mediaAssetId: string; outcome: string }>;
};

/**
 * Finalises uploads whose browser never came back.
 *
 * A recording is uploaded part by part while it is being made, and the row
 * sits in UPLOADING until the browser posts the completion. When the tab dies
 * mid answer that post never arrives, and until now nothing on the server ever
 * acted on it: the parts stayed in the bucket (billed, never played) and the
 * row stayed UPLOADING forever. Every provider already knows how to assemble
 * what it is holding (`salvage()`); this is the caller it was missing.
 *
 * The outcome mirrors what `POST .../media/complete` would have done had the
 * browser sent `incomplete: true`: the asset becomes INCOMPLETE with its real
 * size, is attached to the answer it was recorded for, and goes into the
 * transcription queue, because a cut-short answer is exactly the one a manager
 * would rather read than watch. With no parts at all it becomes FAILED, the
 * same as a completion request with nothing to assemble.
 *
 * Which rows qualify is `decideSalvage()`. The SQL below is a coarse prefilter
 * (old enough, still UPLOADING, has an upload id and a real key); the decision
 * itself is taken in code so it can be unit tested.
 */
export async function salvageAbandonedUploads(
  now: Date = new Date(),
  limit = 20,
): Promise<SalvageResult> {
  const oldEnough = new Date(now.getTime() - SALVAGE_MIN_AGE_MS);
  const candidates = await db
    .select({
      asset: mediaAssets,
      run: {
        id: stageRuns.id,
        completion: stageRuns.completion,
        deadlineAt: stageRuns.deadlineAt,
        lastHeartbeatAt: stageRuns.lastHeartbeatAt,
      },
    })
    .from(mediaAssets)
    .leftJoin(stageRuns, eq(stageRuns.id, mediaAssets.stageRunId))
    .where(
      and(
        eq(mediaAssets.status, "UPLOADING"),
        lt(mediaAssets.createdAt, oldEnough),
        isNotNull(mediaAssets.uploadId),
        // "pending" is the placeholder written before initUpload ran; there is
        // no multipart upload behind it to salvage.
        like(mediaAssets.storageKey, "media/%"),
      ),
    )
    .orderBy(asc(mediaAssets.createdAt))
    .limit(limit);

  const result: SalvageResult = {
    scanned: candidates.length,
    salvaged: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  const storage = getStorage();

  for (const { asset, run } of candidates) {
    const decision = decideSalvage(
      {
        assetCreatedAt: asset.createdAt,
        // Depending on the driver a LEFT JOIN with no match comes back as
        // null or as an object of nulls; both mean "no run".
        run: run?.id ? run : null,
      },
      now,
    );
    if (decision.action === "SKIP") {
      result.skipped += 1;
      result.details.push({ mediaAssetId: asset.id, outcome: decision.reason });
      continue;
    }

    try {
      const { bytes, parts } = await storage.salvage(
        asset.storageKey,
        asset.uploadId!,
      );

      if (bytes === 0) {
        // Nothing landed. The same guard as the update above: if the browser
        // completed it in the meantime, leave that result alone.
        await db
          .update(mediaAssets)
          .set({ status: "FAILED" })
          .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.status, "UPLOADING")));
        result.failed += 1;
        result.details.push({ mediaAssetId: asset.id, outcome: "FAILED: no parts" });
        continue;
      }

      const [updated] = await db
        .update(mediaAssets)
        .set({ status: "INCOMPLETE", bytes, parts })
        .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.status, "UPLOADING")))
        .returning({ id: mediaAssets.id });
      if (!updated) {
        result.skipped += 1;
        result.details.push({
          mediaAssetId: asset.id,
          outcome: "completed by the browser meanwhile",
        });
        continue;
      }

      if (run?.id && asset.activityId) {
        await attachSalvagedMedia(run.id, asset.activityId, asset.id, now);
      }
      if (isTranscribableMime(asset.mime)) {
        await enqueueTranscription(asset.id);
      }

      result.salvaged += 1;
      result.details.push({
        mediaAssetId: asset.id,
        outcome: `INCOMPLETE: ${bytes} bytes from ${parts.length} parts`,
      });
    } catch (error) {
      // One bad upload must not stop the sweep. The row stays UPLOADING and is
      // retried next tick; a persistent failure shows up in the logs each time.
      result.errors += 1;
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[close-expired] salvage failed for ${asset.id}: ${reason}`);
      result.details.push({ mediaAssetId: asset.id, outcome: `ERROR: ${reason}` });
    }
  }

  return result;
}

/**
 * Points the answer at the salvaged clip, the way the completion route would
 * have. Only fills a gap: an answer that already has a recording (the candidate
 * re-recorded) or was deliberately typed instead (`usedTextAlternative`) is
 * left as it is. Everything else in the payload is kept.
 */
async function attachSalvagedMedia(
  stageRunId: string,
  activityId: string,
  mediaAssetId: string,
  now: Date,
) {
  const [existing] = await db
    .select({ id: responses.id, payload: responses.payload })
    .from(responses)
    .where(
      and(eq(responses.stageRunId, stageRunId), eq(responses.activityId, activityId)),
    )
    .limit(1);

  if (existing) {
    if (existing.payload.mediaAssetId || existing.payload.usedTextAlternative) return;
    const payload: ResponsePayload = { ...existing.payload, mediaAssetId };
    await db
      .update(responses)
      .set({
        payload,
        answeredAt: sql`coalesce(${responses.answeredAt}, ${now.toISOString()}::timestamptz)`,
        updatedAt: now,
      })
      .where(eq(responses.id, existing.id));
    return;
  }

  await db
    .insert(responses)
    .values({
      stageRunId,
      activityId,
      payload: { mediaAssetId },
      answeredAt: now,
      updatedAt: now,
    })
    // The candidate's own save can race this insert; theirs is the one to keep.
    .onConflictDoNothing();
}
