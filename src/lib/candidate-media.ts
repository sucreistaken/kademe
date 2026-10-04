import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, itemResponses, mediaAssets, sectionRuns } from "@/db/schema";
import type { UploadPart } from "@/db/schema/types";
import type { CandidateContext } from "@/lib/candidate-context";
import { getStorage, mediaKey } from "@/lib/storage";

/**
 * Recording is uploaded while it is still being made. The browser hands us a
 * chunk every five seconds; each chunk becomes a multipart part as soon as it
 * exists, and nothing larger than one part is ever held in memory.
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
 * What a FILE_UPLOAD activity may receive when the manager did not name the
 * types themselves. Documents and images, nothing that plays: a file answer is
 * read by a person, never sent to the transcription queue.
 */
export const DOCUMENT_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
];

/** Anything the allowlists do not name is stored opaque and served as such. */
export const OPAQUE_MIME = "application/octet-stream";

/**
 * Mime for a FILE_UPLOAD asset. Files used to run through `normaliseMime`,
 * which knows only recordings, so a PDF came out as `video/webm`, got a
 * `.webm` key and was queued for transcription.
 *
 * With an `acceptedMimeTypes` list on the activity the file must be on it, and
 * `null` tells the route to refuse it (the client already filtered, so this is
 * the server repeating a check it cannot delegate). Without a list, known
 * document types keep their own mime and anything else is stored opaque rather
 * than rejected: a manager who left the list empty asked for "any file".
 */
export function normaliseFileMime(
  raw: string | undefined,
  accepted: string[] | undefined,
): string | null {
  const base = (raw ?? "").split(";")[0].trim().toLowerCase();
  const configured = (accepted ?? [])
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
  if (configured.length > 0) {
    return configured.includes(base) ? base : null;
  }
  if (!base) return OPAQUE_MIME;
  return DOCUMENT_MIME.includes(base) ? base : OPAQUE_MIME;
}

/**
 * Opens a multipart upload and the row that tracks it. The storage key is
 * derived from ids the server owns; the client never chooses where bytes land.
 */
export async function createMediaAsset(
  ctx: CandidateContext,
  run: typeof sectionRuns.$inferSelect,
  response: typeof itemResponses.$inferSelect,
  mime: string,
) {
  const [asset] = await db
    .insert(mediaAssets)
    .values({
      orgId: ctx.assessment.orgId,
      attemptId: run.attemptId,
      sectionRunId: run.id,
      itemResponseId: response.id,
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
 * Recordings that count as a take: finished, cut short but playable, or still
 * uploading. An upload in progress counts so that several parallel `init`
 * calls cannot buy extra takes; a failed one does not.
 */
export async function takeCount(itemResponseId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.itemResponseId, itemResponseId), inArray(mediaAssets.status, ["READY", "INCOMPLETE", "UPLOADING"])));
  return row?.n ?? 0;
}

/**
 * An upload reference is an id the server minted and handed to this student.
 * It is still checked against the token's own assessment on every use, so it
 * cannot be pointed at anybody else's recording.
 */
export async function resolveOwnedMedia(ctx: CandidateContext, uploadRef: unknown) {
  if (typeof uploadRef !== "string" || uploadRef.length !== 36) return null;
  const [row] = await db
    .select({ asset: mediaAssets })
    .from(mediaAssets)
    .innerJoin(attempts, eq(attempts.id, mediaAssets.attemptId))
    .where(and(eq(mediaAssets.id, uploadRef), eq(attempts.assessmentId, ctx.assessment.id)))
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
