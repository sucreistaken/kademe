import { and, asc, count, inArray, isNotNull, lte, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, proctorRecordings } from "@/db/schema";
import { clampBatch } from "@/lib/retention";
import { getStorage } from "@/lib/storage";
import { isRecordingKey } from "@/server/recordings";

/**
 * Retention for the continuous proctoring recording, run by the same
 * purge-retention cron and behind the same two switches as everything else
 * there (RETENTION_PURGE_ENABLED=true AND ?apply=1): without both it only
 * reports and writes nothing.
 *
 * The clock is the organisation's evidence retention, the one the proctoring
 * frames use: each segment is stored with purge_after = its start plus
 * `evidence_retention_days`, so the date a recording dies is fixed when it is
 * made and visible on the row. A segment is due once purge_after has passed.
 *
 * Storage first, row second, as in src/lib/retention.ts: a segment whose
 * object cannot be removed keeps its row and is tried again on the next run.
 */

type DueRow = { id: string; orgId: string; attemptId: string; storageKey: string; bytes: number; purgeAfter: Date };

export type RecordingPurgeReport = {
  mode: "REPORT" | "APPLY";
  due: number;
  bytesDue: number;
  inBatch: number;
  remaining: number;
  oldest: string | null;
  applied: { segmentsDeleted: number; bytesDeleted: number; keysSkipped: number; storageFailures: Array<{ key: string; reason: string }> } | null;
};

/** The selection rule, in SQL: a purge date that is set and has passed. */
export function recordingPurgeWhere(now: Date): SQL {
  return and(isNotNull(proctorRecordings.purgeAfter), lte(proctorRecordings.purgeAfter, now))!;
}

/** The same rule as `recordingPurgeWhere`, for rows already in memory (and for the tests). */
export function isRecordingDue(row: { purgeAfter: Date | null }, now: Date): boolean {
  return row.purgeAfter !== null && row.purgeAfter.getTime() <= now.getTime();
}

/** Oldest first, at most `batch`: the order the job works through a backlog. */
export function selectDue<T extends { purgeAfter: Date | null }>(rows: readonly T[], now: Date, batch: number): T[] {
  return rows
    .filter((r) => isRecordingDue(r, now))
    .sort((a, b) => a.purgeAfter!.getTime() - b.purgeAfter!.getTime())
    .slice(0, clampBatch(batch));
}

/**
 * Segments one round touches when the caller names no batch. An hour of exam is
 * about 480 segments (camera and screen), so the media batch of 200 would never
 * keep up; a run goes round after round until nothing is due or the time budget
 * is spent.
 */
export const RECORDING_ROUND = 2000;
const RUN_BUDGET_MS = 180_000;

type Applied = NonNullable<RecordingPurgeReport["applied"]>;

function selectRows(where: SQL, limit: number) {
  return db
    .select({
      id: proctorRecordings.id,
      orgId: proctorRecordings.orgId,
      attemptId: proctorRecordings.attemptId,
      storageKey: proctorRecordings.storageKey,
      bytes: proctorRecordings.bytes,
      purgeAfter: proctorRecordings.purgeAfter,
    })
    .from(proctorRecordings)
    .where(where)
    .orderBy(asc(proctorRecordings.purgeAfter))
    .limit(limit) as Promise<DueRow[]>;
}

/**
 * Report mode (the default) counts and samples, writing nothing. Apply mode
 * deletes. An explicit `batch` means exactly one round of that size, which is
 * how an operator tries the switch on a single segment first (docs/RETENTION.md).
 */
export async function purgeRecordings(options: { now?: Date; batch?: number; apply?: boolean } = {}): Promise<RecordingPurgeReport> {
  const now = options.now ?? new Date();
  const single = options.batch !== undefined;
  const batch = single ? clampBatch(options.batch) : RECORDING_ROUND;
  const where = recordingPurgeWhere(now);

  const [totals] = await db
    .select({ n: count(), bytes: sql<string>`coalesce(sum(${proctorRecordings.bytes}), 0)` })
    .from(proctorRecordings)
    .where(where);
  const due = totals?.n ?? 0;
  const first = await selectRows(where, batch);
  const report: RecordingPurgeReport = {
    mode: options.apply === true ? "APPLY" : "REPORT",
    due,
    bytesDue: Number(totals?.bytes ?? 0),
    inBatch: first.length,
    remaining: Math.max(0, due - first.length),
    oldest: first[0]?.purgeAfter.toISOString() ?? null,
    applied: null,
  };
  if (options.apply !== true) return report;

  const applied: Applied = { segmentsDeleted: 0, bytesDeleted: 0, keysSkipped: 0, storageFailures: [] };
  // Rows this run could not remove are not selected again, or they would block every round.
  const stuck: string[] = [];
  const startedAt = Date.now();
  let rows = first;
  for (;;) {
    const removed = await applyRound(rows, now, applied, stuck);
    if (single || rows.length < batch || removed === 0 || Date.now() - startedAt > RUN_BUDGET_MS) break;
    rows = await selectRows(stuck.length ? and(where, notInArray(proctorRecordings.id, stuck))! : where, batch);
    if (rows.length === 0) break;
  }
  report.applied = applied;
  report.remaining = Math.max(0, due - applied.segmentsDeleted);
  return report;
}

async function applyRound(rows: DueRow[], now: Date, applied: Applied, stuck: string[]): Promise<number> {
  const storage = getStorage();
  const removed: DueRow[] = [];
  for (const row of rows) {
    // Only keys this feature writes; anything else is left for a human to look at.
    if (!isRecordingKey(row.storageKey)) {
      applied.keysSkipped++;
      stuck.push(row.id);
      continue;
    }
    try {
      await storage.delete(row.storageKey);
      removed.push(row);
    } catch (error) {
      applied.storageFailures.push({ key: row.storageKey, reason: error instanceof Error ? error.message : String(error) });
      stuck.push(row.id);
    }
  }
  if (removed.length === 0) return 0;
  await db.delete(proctorRecordings).where(inArray(proctorRecordings.id, removed.map((r) => r.id)));
  applied.segmentsDeleted += removed.length;
  applied.bytesDeleted += removed.reduce((sum, r) => sum + r.bytes, 0);
  // One audit row per attempt and round, not per segment.
  const byAttempt = new Map<string, { orgId: string; segments: number; bytes: number }>();
  for (const r of removed) {
    const entry = byAttempt.get(r.attemptId) ?? { orgId: r.orgId, segments: 0, bytes: 0 };
    entry.segments++;
    entry.bytes += r.bytes;
    byAttempt.set(r.attemptId, entry);
  }
  await db.insert(auditLogs).values(
    [...byAttempt].map(([attemptId, e]) => ({
      orgId: e.orgId,
      actorId: null,
      action: "retention.recording.purge",
      subjectType: "attempt",
      subjectId: attemptId,
      meta: { segments: e.segments, bytes: e.bytes, at: now.toISOString() },
    })),
  );
  return removed.length;
}
