import { and, asc, count, inArray, isNotNull, lte, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, proctorEvidence, proctorRecordings } from "@/db/schema";
import { clampBatch } from "@/lib/retention";
import { getStorage } from "@/lib/storage";
import { isRecordingKey } from "@/server/recordings";

/**
 * Retention for proctoring media: the continuous recording's segments and the
 * evidence files (frames and short clips). Run by the same purge-retention
 * cron and behind the same two switches as everything else there
 * (RETENTION_PURGE_ENABLED=true AND ?apply=1): without both it only reports
 * and writes nothing.
 *
 * Both clocks are fixed on the row when it is written, so the date a file dies
 * is visible on it: a recording segment gets its start plus the organisation's
 * evidence retention, capped at MAX_RECORDING_RETENTION_DAYS; an evidence file
 * gets its capture time plus the evidence retention (src/server/proctoring.ts,
 * storeEvidence). A row is due once purge_after has passed.
 *
 * Storage first, row second, as in src/lib/retention.ts: a file whose object
 * cannot be removed keeps its row and is tried again on the next run.
 */

type DueRow = { id: string; orgId: string; attemptId: string; storageKey: string; bytes: number | null; purgeAfter: Date };

type Failure = { key: string; reason: string };

export type RecordingPurgeReport = {
  mode: "REPORT" | "APPLY";
  due: number;
  bytesDue: number;
  inBatch: number;
  remaining: number;
  oldest: string | null;
  applied: { segmentsDeleted: number; bytesDeleted: number; keysSkipped: number; storageFailures: Failure[] } | null;
};

export type EvidencePurgeReport = Omit<RecordingPurgeReport, "applied"> & {
  applied: { filesDeleted: number; bytesDeleted: number; keysSkipped: number; storageFailures: Failure[] } | null;
};

/** The selection rule, in SQL: a purge date that is set and has passed. */
export function recordingPurgeWhere(now: Date): SQL {
  return and(isNotNull(proctorRecordings.purgeAfter), lte(proctorRecordings.purgeAfter, now))!;
}

/** The same rule for evidence files. */
export function evidencePurgeWhere(now: Date): SQL {
  return and(isNotNull(proctorEvidence.purgeAfter), lte(proctorEvidence.purgeAfter, now))!;
}

/** The same rule as the two above, for rows already in memory (and for the tests). */
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
 * Keys storeEvidence writes: `proctor/<org>/<assessment>/<evidence id>.<ext>`
 * (src/lib/storage.ts, proctorEvidenceKey). Recording keys have a `rec/`
 * level more and do not match.
 */
export const isEvidenceKey = (key: string) => /^proctor\/[^/]+\/[^/]+\/[^/]+\.[a-z0-9]+$/.test(key);

/**
 * Rows one round touches when the caller names no batch. An hour of exam is
 * about 480 segments (camera and screen), so the media batch of 200 would never
 * keep up; a run goes round after round until nothing is due or the time budget
 * is spent.
 */
export const RECORDING_ROUND = 2000;
const RUN_BUDGET_MS = 180_000;

/** One table the purge works through: how to find what is due and how to remove it. */
type PurgeSource = {
  /** Keys this table's feature writes; nothing else is handed to storage. */
  ownsKey: (key: string) => boolean;
  /** One audit row per attempt and round. */
  auditAction: string;
  /** What the audit row calls the rows it counts. */
  unit: "segments" | "files";
  where: (now: Date) => SQL;
  totals: (where: SQL) => Promise<{ n: number; bytes: string } | undefined>;
  select: (where: SQL, limit: number) => Promise<DueRow[]>;
  excluding: (where: SQL, ids: string[]) => SQL;
  remove: (ids: string[]) => Promise<unknown>;
};

const RECORDINGS: PurgeSource = {
  ownsKey: isRecordingKey,
  auditAction: "retention.recording.purge",
  unit: "segments",
  where: recordingPurgeWhere,
  totals: async (where) =>
    (await db.select({ n: count(), bytes: sql<string>`coalesce(sum(${proctorRecordings.bytes}), 0)` }).from(proctorRecordings).where(where))[0],
  select: (where, limit) =>
    db
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
      .limit(limit) as Promise<DueRow[]>,
  excluding: (where, ids) => and(where, notInArray(proctorRecordings.id, ids))!,
  remove: (ids) => db.delete(proctorRecordings).where(inArray(proctorRecordings.id, ids)),
};

const EVIDENCE: PurgeSource = {
  ownsKey: isEvidenceKey,
  auditAction: "retention.evidence.purge",
  unit: "files",
  where: evidencePurgeWhere,
  totals: async (where) =>
    (await db.select({ n: count(), bytes: sql<string>`coalesce(sum(${proctorEvidence.bytes}), 0)` }).from(proctorEvidence).where(where))[0],
  select: (where, limit) =>
    db
      .select({
        id: proctorEvidence.id,
        orgId: proctorEvidence.orgId,
        attemptId: proctorEvidence.attemptId,
        storageKey: proctorEvidence.storageKey,
        bytes: proctorEvidence.bytes,
        purgeAfter: proctorEvidence.purgeAfter,
      })
      .from(proctorEvidence)
      .where(where)
      .orderBy(asc(proctorEvidence.purgeAfter))
      .limit(limit) as Promise<DueRow[]>,
  excluding: (where, ids) => and(where, notInArray(proctorEvidence.id, ids))!,
  remove: (ids) => db.delete(proctorEvidence).where(inArray(proctorEvidence.id, ids)),
};

type Options = { now?: Date; batch?: number; apply?: boolean };
type Applied = { deleted: number; bytesDeleted: number; keysSkipped: number; storageFailures: Failure[] };
type Report = Omit<RecordingPurgeReport, "applied"> & { applied: Applied | null };

/**
 * Report mode (the default) counts and samples, writing nothing. Apply mode
 * deletes. An explicit `batch` means exactly one round of that size, which is
 * how an operator tries the switch on a single row first (docs/RETENTION.md).
 */
async function purgeDue(source: PurgeSource, options: Options): Promise<Report> {
  const now = options.now ?? new Date();
  const single = options.batch !== undefined;
  const batch = single ? clampBatch(options.batch) : RECORDING_ROUND;
  const where = source.where(now);

  const totals = await source.totals(where);
  const due = totals?.n ?? 0;
  const first = await source.select(where, batch);
  const report: Report = {
    mode: options.apply === true ? "APPLY" : "REPORT",
    due,
    bytesDue: Number(totals?.bytes ?? 0),
    inBatch: first.length,
    remaining: Math.max(0, due - first.length),
    oldest: first[0]?.purgeAfter.toISOString() ?? null,
    applied: null,
  };
  if (options.apply !== true) return report;

  const applied: Applied = { deleted: 0, bytesDeleted: 0, keysSkipped: 0, storageFailures: [] };
  // Rows this run could not remove are not selected again, or they would block every round.
  const stuck: string[] = [];
  const startedAt = Date.now();
  let rows = first;
  for (;;) {
    const removed = await applyRound(source, rows, now, applied, stuck);
    if (single || rows.length < batch || removed === 0 || Date.now() - startedAt > RUN_BUDGET_MS) break;
    rows = await source.select(stuck.length ? source.excluding(where, stuck) : where, batch);
    if (rows.length === 0) break;
  }
  report.applied = applied;
  report.remaining = Math.max(0, due - applied.deleted);
  return report;
}

async function applyRound(source: PurgeSource, rows: DueRow[], now: Date, applied: Applied, stuck: string[]): Promise<number> {
  const storage = getStorage();
  const removed: DueRow[] = [];
  for (const row of rows) {
    // Only keys this feature writes; anything else is left for a human to look at.
    if (!source.ownsKey(row.storageKey)) {
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
  await source.remove(removed.map((r) => r.id));
  applied.deleted += removed.length;
  applied.bytesDeleted += removed.reduce((sum, r) => sum + (r.bytes ?? 0), 0);
  // One audit row per attempt and round, not per file.
  const byAttempt = new Map<string, { orgId: string; rows: number; bytes: number }>();
  for (const r of removed) {
    const entry = byAttempt.get(r.attemptId) ?? { orgId: r.orgId, rows: 0, bytes: 0 };
    entry.rows++;
    entry.bytes += r.bytes ?? 0;
    byAttempt.set(r.attemptId, entry);
  }
  await db.insert(auditLogs).values(
    [...byAttempt].map(([attemptId, e]) => ({
      orgId: e.orgId,
      actorId: null,
      action: source.auditAction,
      subjectType: "attempt",
      subjectId: attemptId,
      meta: { [source.unit]: e.rows, bytes: e.bytes, at: now.toISOString() },
    })),
  );
  return removed.length;
}

/** Recording segments past their purge date. */
export async function purgeRecordings(options: Options = {}): Promise<RecordingPurgeReport> {
  const { applied, ...report } = await purgeDue(RECORDINGS, options);
  return {
    ...report,
    applied: applied && { segmentsDeleted: applied.deleted, bytesDeleted: applied.bytesDeleted, keysSkipped: applied.keysSkipped, storageFailures: applied.storageFailures },
  };
}

/**
 * Evidence files (frames, short clips) past their purge date. They were
 * stamped with one since the start and nothing deleted them; this is that job.
 */
export async function purgeEvidence(options: Options = {}): Promise<EvidencePurgeReport> {
  const { applied, ...report } = await purgeDue(EVIDENCE, options);
  return {
    ...report,
    applied: applied && { filesDeleted: applied.deleted, bytesDeleted: applied.bytesDeleted, keysSkipped: applied.keysSkipped, storageFailures: applied.storageFailures },
  };
}
