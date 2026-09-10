import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attempts, mediaAssets, stageRuns } from "@/db/schema";
import type { UploadPart } from "@/db/schema/types";
import type { ActivityRow, CandidateContext } from "@/lib/candidate-flow";
import { getStorage, mediaKey } from "@/lib/storage";

/**
 * Recording is uploaded while it is still being made. The browser hands us a
 * chunk every five seconds; each chunk becomes a multipart part as soon as it
 * exists, and nothing larger than one part is ever held in memory. That is what
 * keeps iOS Safari alive past the one minute mark, so it is not an optimisation
 * to trade away later.
 *
 * The consequence for this file: a media asset is a long lived row that starts
 * in UPLOADING, collects parts one at a time, and is completed at the end. If
 * the browser dies halfway, the parts already written stay on the object store
 * and the asset is finished as INCOMPLETE rather than thrown away.
 */

/** Accepted recording containers, in the order the client tries them. */
export const ACCEPTED_MEDIA_MIME = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mp4",
  "audio/webm",
  "audio/mpeg",
  "audio/wav",
];

export function normaliseMime(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const base = raw.split(";")[0].trim().toLowerCase();
  return ACCEPTED_MEDIA_MIME.includes(base) ? raw.slice(0, 120) : fallback;
}

/**
 * Opens a multipart upload and the row that tracks it. The storage key is
 * derived from ids the server owns; the client never chooses where bytes land.
 */
export async function createMediaAsset(
  ctx: CandidateContext,
  run: typeof stageRuns.$inferSelect,
  activity: ActivityRow,
  mime: string,
) {
  const [asset] = await db
    .insert(mediaAssets)
    .values({
      orgId: ctx.assessment.orgId,
      stageRunId: run.id,
      activityId: activity.id,
      storageKey: "pending",
      mime,
      status: "UPLOADING",
      parts: [],
    })
    .returning();

  const key = mediaKey({
    orgId: ctx.assessment.orgId,
    assessmentId: ctx.assessment.id,
    stageRunId: run.id,
    mediaId: asset.id,
    mime,
  });
  const { uploadId } = await getStorage().initUpload(key, mime);

  const [updated] = await db
    .update(mediaAssets)
    .set({ storageKey: key, uploadId })
    .where(eq(mediaAssets.id, asset.id))
    .returning();
  return updated;
}

/**
 * An upload reference is an id the server minted and handed to this candidate.
 * It is still checked against the token's own assessment on every use, so it
 * cannot be pointed at anybody else's recording.
 */
export async function resolveOwnedMedia(
  ctx: CandidateContext,
  uploadRef: unknown,
) {
  if (typeof uploadRef !== "string" || uploadRef.length !== 36) return null;
  const [row] = await db
    .select({ asset: mediaAssets, run: stageRuns })
    .from(mediaAssets)
    .innerJoin(stageRuns, eq(stageRuns.id, mediaAssets.stageRunId))
    .innerJoin(attempts, eq(attempts.id, stageRuns.attemptId))
    .where(
      and(
        eq(mediaAssets.id, uploadRef),
        eq(attempts.assessmentId, ctx.assessment.id),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Records a part the moment it lands, so a crash still leaves a usable asset. */
export async function recordPart(
  asset: typeof mediaAssets.$inferSelect,
  part: UploadPart,
) {
  const existing = (asset.parts ?? []).filter(
    (p) => p.partNumber !== part.partNumber,
  );
  const parts = [...existing, part].sort((a, b) => a.partNumber - b.partNumber);
  await db
    .update(mediaAssets)
    .set({ parts, bytes: parts.reduce((sum, p) => sum + p.bytes, 0) })
    .where(eq(mediaAssets.id, asset.id));
  return parts;
}

export async function completeMedia(
  asset: typeof mediaAssets.$inferSelect,
  parts: UploadPart[],
  durationMs: number | null,
  status: "READY" | "INCOMPLETE",
) {
  if (!asset.uploadId) throw new Error("media asset has no upload id");
  const { bytes } = await getStorage().completeUpload(
    asset.storageKey,
    asset.uploadId,
    parts,
  );
  const [updated] = await db
    .update(mediaAssets)
    .set({ status, bytes, durationMs, parts })
    .where(eq(mediaAssets.id, asset.id))
    .returning();
  return updated;
}

export async function failMedia(assetId: string) {
  await db
    .update(mediaAssets)
    .set({ status: "FAILED" })
    .where(eq(mediaAssets.id, assetId));
}
