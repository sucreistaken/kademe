import { and, asc, eq, isNotNull, isNull, like, lt } from "drizzle-orm";
import { db } from "@/db";
import { assessmentLinks, itemResponses, mediaAssets, sectionRuns } from "@/db/schema";
import { closeSectionRun } from "@/lib/exam-flow";
import { reopenGradingForMedia } from "@/lib/exam-results";
import { enqueueTranscription } from "@/lib/queue";
import { getStorage } from "@/lib/storage";
import { isTranscribableMime } from "@/lib/transcription";
import { SUBMIT_SLACK_MS } from "./timer";
import { decideSalvage, SALVAGE_MIN_AGE_MS } from "./stage-timeout";

/**
 * The clock's enforcement, run every minute by the scheduler.
 *
 * Without it the server's deadline is right but nothing acts on it: a student
 * who closes the tab leaves the section open forever, the teacher sees "in
 * exam" indefinitely, and the autosaved answers are never scored.
 */

export type CloseResult = { scanned: number; closed: number };

/** Closes sections whose deadline (plus the write slack) has passed. */
export async function closeExpiredRuns(now: Date = new Date(), limit = 50): Promise<CloseResult> {
  const due = new Date(now.getTime() - SUBMIT_SLACK_MS);
  const rows = await db
    .select({ id: sectionRuns.id })
    .from(sectionRuns)
    .where(and(isNull(sectionRuns.submittedAt), isNotNull(sectionRuns.deadlineAt), lt(sectionRuns.deadlineAt, due)))
    .orderBy(asc(sectionRuns.deadlineAt))
    .limit(limit);
  let closed = 0;
  for (const r of rows) {
    try {
      await closeSectionRun(r.id, "EXPIRED");
      closed += 1;
    } catch (error) {
      console.error(`[close-expired] could not close ${r.id}`, error);
    }
  }
  return { scanned: rows.length, closed };
}

/** Links never opened before their date. A started exam runs on its section clocks. */
export async function expireLinks(now: Date = new Date()) {
  const rows = await db
    .update(assessmentLinks)
    .set({ status: "EXPIRED" })
    .where(and(lt(assessmentLinks.expiresAt, now), eq(assessmentLinks.status, "NOT_STARTED")))
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
 * Finalises speaking recordings whose browser never came back. The parts that
 * landed are assembled into an INCOMPLETE asset, attached to its answer if the
 * answer has no recording yet, and sent to transcription, the same as a
 * completion with `incomplete: true` would have done.
 */
export async function salvageAbandonedUploads(now: Date = new Date(), limit = 20): Promise<SalvageResult> {
  const oldEnough = new Date(now.getTime() - SALVAGE_MIN_AGE_MS);
  const candidates = await db
    .select({
      asset: mediaAssets,
      run: {
        id: sectionRuns.id,
        completion: sectionRuns.completion,
        deadlineAt: sectionRuns.deadlineAt,
        lastHeartbeatAt: sectionRuns.lastHeartbeatAt,
      },
    })
    .from(mediaAssets)
    .leftJoin(sectionRuns, eq(sectionRuns.id, mediaAssets.sectionRunId))
    .where(
      // Only the exam's own uploads (they carry their section run). Every
      // other solution salvages its uploads itself (attempts.closeExpired) and
      // attaches them to its own answers.
      and(
        isNotNull(mediaAssets.sectionRunId),
        eq(mediaAssets.status, "UPLOADING"),
        lt(mediaAssets.createdAt, oldEnough),
        isNotNull(mediaAssets.uploadId),
        like(mediaAssets.storageKey, "media/%"),
      ),
    )
    .orderBy(asc(mediaAssets.createdAt))
    .limit(limit);

  const result: SalvageResult = { scanned: candidates.length, salvaged: 0, failed: 0, skipped: 0, errors: 0, details: [] };
  const storage = getStorage();

  for (const { asset, run } of candidates) {
    const decision = decideSalvage({ assetCreatedAt: asset.createdAt, run: run?.id ? run : null }, now);
    if (decision.action === "SKIP") {
      result.skipped += 1;
      result.details.push({ mediaAssetId: asset.id, outcome: decision.reason });
      continue;
    }
    try {
      const { bytes, parts } = await storage.salvage(asset.storageKey, asset.uploadId!);
      if (bytes === 0) {
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
        result.details.push({ mediaAssetId: asset.id, outcome: "completed by the browser meanwhile" });
        continue;
      }
      if (asset.itemResponseId) {
        const [response] = await db.select().from(itemResponses).where(eq(itemResponses.id, asset.itemResponseId));
        if (response && !response.answer?.mediaAssetId && !response.answer?.usedTextAlternative) {
          await db
            .update(itemResponses)
            .set({ answer: { ...(response.answer ?? {}), mediaAssetId: asset.id }, updatedAt: now })
            .where(eq(itemResponses.id, response.id));
          await reopenGradingForMedia(response.id);
        }
      }
      if (isTranscribableMime(asset.mime)) await enqueueTranscription(asset.id);
      result.salvaged += 1;
      result.details.push({ mediaAssetId: asset.id, outcome: `INCOMPLETE: ${bytes} bytes from ${parts.length} parts` });
    } catch (error) {
      result.errors += 1;
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[close-expired] salvage failed for ${asset.id}: ${reason}`);
      result.details.push({ mediaAssetId: asset.id, outcome: `ERROR: ${reason}` });
    }
  }
  return result;
}

