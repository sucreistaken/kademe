import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { assessments, attempts, auditLogs, consentTexts, consents, proctorRecordings, proctorSessions } from "@/db/schema";
import type { CandidateContext } from "@/lib/candidate-context";
import type { RecordingKind, RecordingMime, SegmentMeta } from "@/lib/proctor/recording-rules";
import { recordingRetentionDays } from "@/lib/proctor/recording-rules";
import { getStorage } from "@/lib/storage";

/**
 * The server half of the continuous proctoring recording: storing a segment
 * the browser sends, and handing segments to a panel user who may watch them.
 * Retention is in src/server/recording-retention.ts.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/**
 * Derived on the server only, from rows and validated metadata (the run id is
 * checked by parseSegmentMeta). The same segment always gets the same key, so
 * a retried upload overwrites itself instead of leaving a second object.
 */
export function recordingKey(input: {
  orgId: string;
  assessmentId: string;
  attemptId: string;
  kind: RecordingKind;
  runId: string;
  sequence: number;
  mime: RecordingMime;
}): string {
  const ext = input.mime === "video/mp4" ? "mp4" : "webm";
  const seq = String(input.sequence).padStart(5, "0");
  return `proctor/${input.orgId}/${input.assessmentId}/rec/${input.attemptId}/${input.kind.toLowerCase()}-${input.runId}-${seq}.${ext}`;
}

/** Keys this module writes; the purge refuses to delete anything else. */
export const isRecordingKey = (key: string) => key.startsWith("proctor/") && key.includes("/rec/");

/**
 * What the candidate agreed to about the recording: true when the consent text
 * they accepted announces it (consent_texts.covers_recording), false when they
 * accepted a text that does not (the version 1 an invitation accepted before
 * the recording keeps), null when no consent is on record. The latest
 * acceptance counts. Read by the session route, the upload route and the panel.
 */
export async function recordingConsent(assessmentId: string): Promise<boolean | null> {
  const [row] = await db
    .select({ covers: consentTexts.coversRecording })
    .from(consents)
    .innerJoin(consentTexts, eq(consentTexts.id, consents.consentTextId))
    .where(eq(consents.assessmentId, assessmentId))
    .orderBy(desc(consents.acceptedAt))
    .limit(1);
  return row ? row.covers : null;
}

/** A session id from the browser counts only when it is one of this attempt's sessions. */
async function ownedSessionId(attemptId: string, sessionId: string | null): Promise<string | null> {
  if (!isUuid(sessionId)) return null;
  const [s] = await db
    .select({ id: proctorSessions.id })
    .from(proctorSessions)
    .where(and(eq(proctorSessions.id, sessionId), eq(proctorSessions.attemptId, attemptId)));
  return s?.id ?? null;
}

async function existingSegment(attemptId: string, meta: SegmentMeta) {
  const [row] = await db
    .select({ id: proctorRecordings.id })
    .from(proctorRecordings)
    .where(
      and(
        eq(proctorRecordings.attemptId, attemptId),
        eq(proctorRecordings.kind, meta.kind),
        eq(proctorRecordings.runId, meta.runId),
        eq(proctorRecordings.sequence, meta.sequence),
      ),
    );
  return row ?? null;
}

export async function storeRecordingSegment(
  ctx: CandidateContext,
  attemptId: string,
  input: SegmentMeta & { mime: RecordingMime; body: Uint8Array; sessionId: string | null },
): Promise<{ id: string; duplicate: boolean }> {
  // A retry of a segment whose answer was lost: it is already here.
  const known = await existingSegment(attemptId, input);
  if (known) return { id: known.id, duplicate: true };
  const key = recordingKey({ orgId: ctx.assessment.orgId, assessmentId: ctx.assessment.id, attemptId, ...input });
  await getStorage().putObject(key, input.mime, input.body);
  const startedAt = new Date(input.startedAt);
  const [row] = await db
    .insert(proctorRecordings)
    .values({
      orgId: ctx.assessment.orgId,
      attemptId,
      sessionId: await ownedSessionId(attemptId, input.sessionId),
      kind: input.kind,
      runId: input.runId,
      sequence: input.sequence,
      startedAt,
      durationMs: input.durationMs,
      bytes: input.body.byteLength,
      mime: input.mime,
      storageKey: key,
      purgeAfter: new Date(startedAt.getTime() + recordingRetentionDays(ctx.evidenceRetentionDays) * 86_400_000),
    })
    .onConflictDoNothing()
    .returning({ id: proctorRecordings.id });
  if (row) return { id: row.id, duplicate: false };
  // Two copies of the same retry raced; the other one wrote the row (and the same key).
  const again = await existingSegment(attemptId, input);
  return { id: again?.id ?? "", duplicate: true };
}

export type RecordingSegmentView = {
  id: string;
  kind: RecordingKind;
  start: number;
  durationMs: number;
  bytes: number;
};

/** Every segment of one attempt, for the panel player. Scoped to the viewer's organisation. */
export async function loadRecordingSegments(orgId: string, attemptId: string): Promise<{ segments: RecordingSegmentView[]; purgeAfter: Date | null }> {
  const rows = await db
    .select({
      id: proctorRecordings.id,
      kind: proctorRecordings.kind,
      startedAt: proctorRecordings.startedAt,
      durationMs: proctorRecordings.durationMs,
      bytes: proctorRecordings.bytes,
      purgeAfter: proctorRecordings.purgeAfter,
    })
    .from(proctorRecordings)
    .where(and(eq(proctorRecordings.orgId, orgId), eq(proctorRecordings.attemptId, attemptId)))
    .orderBy(asc(proctorRecordings.startedAt));
  const purge = rows.map((r) => r.purgeAfter?.getTime()).filter((t): t is number => typeof t === "number");
  return {
    segments: rows.map((r) => ({ id: r.id, kind: r.kind, start: r.startedAt.getTime(), durationMs: r.durationMs, bytes: r.bytes })),
    purgeAfter: purge.length ? new Date(Math.min(...purge)) : null,
  };
}

/** One segment, only when it belongs to the viewer's organisation. */
export async function findSegmentForViewer(orgId: string, segmentId: string) {
  if (!isUuid(segmentId)) return null;
  const [row] = await db
    .select({ storageKey: proctorRecordings.storageKey, mime: proctorRecordings.mime, bytes: proctorRecordings.bytes })
    .from(proctorRecordings)
    .where(and(eq(proctorRecordings.id, segmentId), eq(proctorRecordings.orgId, orgId)));
  return row ?? null;
}

/** How often one person watching one attempt is written down: once per half hour, not per segment. */
const VIEW_AUDIT_WINDOW_MS = 30 * 60_000;

/**
 * Writes "recording watched" to the audit log (the same `media.view` the audit
 * screen already filters on). Returns false when the attempt is not the
 * viewer's organisation's.
 */
export async function auditRecordingView(user: { id: string; orgId: string }, attemptId: string): Promise<boolean> {
  if (!isUuid(attemptId)) return false;
  const [owned] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(and(eq(attempts.id, attemptId), eq(assessments.orgId, user.orgId)));
  if (!owned) return false;
  const [recent] = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.orgId, user.orgId),
        eq(auditLogs.actorId, user.id),
        eq(auditLogs.action, "media.view"),
        eq(auditLogs.subjectId, attemptId),
        gt(auditLogs.at, new Date(Date.now() - VIEW_AUDIT_WINDOW_MS)),
      ),
    )
    .orderBy(desc(auditLogs.at))
    .limit(1);
  if (recent) return true;
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "media.view",
    subjectType: "attempt",
    subjectId: attemptId,
    meta: { what: "proctor_recording" },
  });
  return true;
}
