import { and, eq, gt, inArray, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  aiRuns,
  assessments,
  attempts,
  mediaAssets,
  stageRuns,
  transcripts,
} from "@/db/schema";
import {
  TranscriberUnavailable,
  getTranscriber,
  isTranscribableMime,
} from "@/lib/transcription";

/**
 * One unit of transcription work.
 *
 * Deliberately does nothing on the unhappy paths except record them: a media
 * asset with no transcript renders as "no transcript yet" on the review screen,
 * which is honest. Writing an approximation, or an empty row, would be read as
 * "this is what the candidate said".
 */

export type TranscriptionOutcome =
  | { status: "DONE"; words: number }
  | { status: "SKIPPED"; reason: string }
  | { status: "FAILED"; reason: string };

/** Statuses whose bytes are worth reading. INCOMPLETE is a cut-short recording,
 *  which is exactly the case where reading beats watching. */
const TRANSCRIBABLE_STATUS = ["READY", "INCOMPLETE"] as const;

export async function runTranscription(
  mediaAssetId: string,
): Promise<TranscriptionOutcome> {
  const [row] = await db
    .select({
      asset: mediaAssets,
      locale: assessments.locale,
    })
    .from(mediaAssets)
    .leftJoin(stageRuns, eq(stageRuns.id, mediaAssets.stageRunId))
    .leftJoin(attempts, eq(attempts.id, stageRuns.attemptId))
    .leftJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(eq(mediaAssets.id, mediaAssetId))
    .limit(1);

  if (!row) return { status: "SKIPPED", reason: "media asset is gone" };
  const asset = row.asset;

  if (!TRANSCRIBABLE_STATUS.includes(asset.status as "READY" | "INCOMPLETE")) {
    return { status: "SKIPPED", reason: `status is ${asset.status}` };
  }
  if (!isTranscribableMime(asset.mime)) {
    return { status: "SKIPPED", reason: `mime is ${asset.mime}` };
  }

  const [existing] = await db
    .select({ id: transcripts.id })
    .from(transcripts)
    .where(eq(transcripts.mediaAssetId, asset.id))
    .limit(1);
  if (existing) return { status: "SKIPPED", reason: "already transcribed" };

  const transcriber = getTranscriber();
  if (!transcriber.available) {
    throw new TranscriberUnavailable(
      "No transcription provider configured (ELEVENLABS_API_KEY missing).",
    );
  }

  try {
    const result = await transcriber.transcribe({
      storageKey: asset.storageKey,
      mime: asset.mime,
      // A hint, not a constraint: the provider is free to disagree, because a
      // candidate invited in Turkish may answer in English.
      languageHint: row.locale ?? null,
    });

    const [written] = await db
      .insert(transcripts)
      .values({
        mediaAssetId: asset.id,
        language: result.language,
        text: result.text,
        words: result.words,
        provider: transcriber.name,
      })
      .onConflictDoNothing()
      .returning();

    await db.insert(aiRuns).values({
      orgId: asset.orgId,
      purpose: "TRANSCRIPTION",
      model: result.model,
      inputRef: asset.storageKey,
      outputRef: written?.id ?? null,
      costUsd: result.costUsd === null ? null : String(result.costUsd),
    });

    return { status: "DONE", words: result.words.length };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // The failure is recorded even though the transcript is not: an unexplained
    // gap on the review screen is worse than a logged error.
    await db.insert(aiRuns).values({
      orgId: asset.orgId,
      purpose: "TRANSCRIPTION",
      model: process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2",
      inputRef: asset.storageKey,
      error: reason.slice(0, 2000),
    });
    throw error;
  }
}

/**
 * Recordings that should have a transcript and do not.
 *
 * This is the safety net for an enqueue that failed silently while a candidate
 * was finishing an answer. It is bounded to the last day on purpose: an asset
 * the provider genuinely cannot read would otherwise be re-queued forever after
 * its retries were exhausted.
 */
export async function findUntranscribed(limit = 20) {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(
      and(
        inArray(mediaAssets.status, [...TRANSCRIBABLE_STATUS]),
        gt(mediaAssets.createdAt, dayAgo),
        sql`(${mediaAssets.mime} LIKE 'audio/%' OR ${mediaAssets.mime} LIKE 'video/%')`,
        notExists(
          db
            .select({ one: sql`1` })
            .from(transcripts)
            .where(eq(transcripts.mediaAssetId, mediaAssets.id)),
        ),
      ),
    )
    .limit(limit);
}
