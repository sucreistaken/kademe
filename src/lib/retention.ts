import { and, asc, count, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assessments,
  attempts,
  auditLogs,
  candidates,
  decisions,
  mediaAssets,
  organizations,
  stageRuns,
} from "@/db/schema";
import { getStorage } from "@/lib/storage";

/**
 * Retention purge.
 *
 * Two clocks, two stages, and a default that deletes nothing.
 *
 * The clocks are separate on purpose and carry separate numbers, both on the
 * organization row:
 *
 *   mediaRetentionDays      recordings die a while after the decision is made,
 *                           because once someone has been hired or rejected the
 *                           video has served its purpose. The candidate record
 *                           itself is still needed.
 *   candidateRetentionDays  the whole candidate record dies a much longer while
 *                           after the last contact.
 *
 * The stages are soft then hard, seven days apart. The soft stage only marks
 * (media_assets.purge_after, candidates.deleted_at); the hard stage removes the
 * storage object and then the row. That week is the whole point: a retention
 * setting typed with an extra zero missing, or a clock skew, or a bad anchor
 * shows up as a week of marked rows rather than as an unrecoverable delete.
 *
 * DEFAULT IS REPORT ONLY. `runRetention()` with no options reads and returns
 * what it would do and writes nothing at all, not even an audit row. Deletion
 * happens only when the caller passes `apply: true`. See
 * src/app/api/cron/purge-retention/route.ts for the switch that a human has to
 * flip on the HTTP side.
 */

/** Days between the soft mark and the irreversible delete. */
export const SOFT_DELETE_GRACE_DAYS = 7;

/** How many rows of each kind a single call will touch. */
export const DEFAULT_BATCH = 200;
export const MAX_BATCH = 2000;

/** Rows echoed back in the report so a human can eyeball them. */
const SAMPLE_SIZE = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/* Pure helpers. No database, no clock of their own, so they are unit testable. */
/* -------------------------------------------------------------------------- */

/**
 * Fixed 24 hour days rather than calendar days. Across a DST boundary the two
 * differ by an hour, which is meaningless against a 180 or 730 day window and
 * buys predictability: the same input always produces the same instant.
 */
export function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export function daysAfter(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

/**
 * Anything whose anchor date is strictly older than this is out of retention.
 * A negative or non finite setting is refused rather than quietly treated as
 * zero, because "0 days" would mean "delete everything that exists".
 */
export function retentionCutoff(now: Date, retentionDays: number): Date {
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    throw new Error(`retention days must be a positive number, got ${retentionDays}`);
  }
  return daysBefore(now, Math.floor(retentionDays));
}

/** True when `anchor` has fallen out of the window. Boundary is exclusive. */
export function isExpired(anchor: Date, now: Date, retentionDays: number): boolean {
  return anchor.getTime() < retentionCutoff(now, retentionDays).getTime();
}

/** When a row marked soft deleted now becomes eligible for the real delete. */
export function hardDeleteDueAt(
  softDeletedAt: Date,
  graceDays: number = SOFT_DELETE_GRACE_DAYS,
): Date {
  return daysAfter(softDeletedAt, graceDays);
}

/** The grace window has run out once the due instant is at or before now. */
export function isPurgeDue(dueAt: Date, now: Date): boolean {
  return dueAt.getTime() <= now.getTime();
}

/**
 * A caller supplied batch size, made safe. Absent or nonsense falls back to the
 * default; an enormous request is capped so one call cannot run unbounded.
 */
export function clampBatch(requested?: number | null): number {
  if (requested === null || requested === undefined) return DEFAULT_BATCH;
  if (!Number.isFinite(requested)) return DEFAULT_BATCH;
  const n = Math.floor(requested);
  if (n < 1) return 1;
  if (n > MAX_BATCH) return MAX_BATCH;
  return n;
}

/**
 * How much of a backlog one call gets through. Reported alongside the totals so
 * an operator can tell "nothing left to do" from "still 4000 rows behind".
 */
export function batchWindow(
  total: number,
  batch: number,
): { inBatch: number; remaining: number; complete: boolean } {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeBatch = clampBatch(batch);
  const inBatch = Math.min(safeTotal, safeBatch);
  const remaining = safeTotal - inBatch;
  return { inBatch, remaining, complete: remaining === 0 };
}

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type RetentionMode = "REPORT" | "APPLY";

export type RetentionOptions = {
  now?: Date;
  batch?: number;
  graceDays?: number;
  /**
   * The only way anything is deleted. Absent or false means a pure read.
   */
  apply?: boolean;
};

export type OrgClock = {
  orgId: string;
  orgName: string;
  mediaRetentionDays: number;
  candidateRetentionDays: number;
  mediaCutoff: Date;
  candidateCutoff: Date;
  hardDeleteCutoff: Date;
};

type MediaRow = {
  id: string;
  orgId: string;
  storageKey: string;
  bytes: number | null;
  anchor: Date;
};

type CandidateRow = {
  id: string;
  orgId: string;
  anchor: Date;
};

type MediaPlan = {
  total: number;
  bytes: number;
  rows: MediaRow[];
};

type CandidatePlan = {
  total: number;
  /** Storage objects that go with the candidates in `rows`. */
  objectCount: number;
  rows: CandidateRow[];
};

type OrgPlan = {
  clock: OrgClock;
  softMedia: MediaPlan;
  softCandidates: CandidatePlan;
  hardMedia: MediaPlan;
  hardCandidates: CandidatePlan;
};

export type Finding = {
  total: number;
  inBatch: number;
  remaining: number;
  oldest: string | null;
  sample: Array<Record<string, unknown>>;
};

export type ApplyResult = {
  mediaMarked: number;
  candidatesMarked: number;
  mediaObjectsDeleted: number;
  /**
   * Rows whose storage key was never a real object path. Counted rather than
   * ignored: a non zero number here means an upload died before it started and
   * somebody should look at the row.
   */
  mediaKeysSkipped: number;
  mediaRowsDeleted: number;
  candidateObjectsDeleted: number;
  candidateRowsDeleted: number;
  storageFailures: Array<{ key: string; reason: string }>;
};

export type OrgReport = {
  orgId: string;
  orgName: string;
  /**
   * Set when this organization's retention settings are unusable, in which case
   * every count below is zero and nothing was planned or applied for it. The
   * other organizations in the same run are unaffected.
   */
  error?: string;
  mediaRetentionDays: number;
  candidateRetentionDays: number;
  /** Media anchored before this instant is out of retention. */
  mediaCutoff: string;
  candidateCutoff: string;
  softDelete: { media: Finding; candidates: Finding };
  hardDelete: { media: Finding; candidates: Finding };
  /** Bytes of storage the media soft stage is about to put on the clock. */
  mediaBytesDue: number;
  /** Storage objects the hard stage would remove, media plus candidate cascade. */
  objectsToRemove: number;
  applied: ApplyResult | null;
};

export type RetentionReport = {
  mode: RetentionMode;
  at: string;
  batch: number;
  graceDays: number;
  organizations: OrgReport[];
  totals: {
    mediaToMark: number;
    candidatesToMark: number;
    mediaToPurge: number;
    candidatesToPurge: number;
    objectsToRemove: number;
    bytesToRemove: number;
  };
};

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Nothing stops someone typing 0 into the retention setting, and 0 would mean
 * "delete everything that exists". A bad setting takes that one organization out
 * of the run and says so, rather than throwing and taking the whole nightly job
 * down with it.
 */
export function settingsProblem(org: {
  mediaRetentionDays: number;
  candidateRetentionDays: number;
}): string | null {
  const check = (label: string, value: number) =>
    !Number.isFinite(value) || value < 1
      ? `${label} is ${value}, which must be at least 1 day`
      : null;
  return (
    check("mediaRetentionDays", org.mediaRetentionDays) ??
    check("candidateRetentionDays", org.candidateRetentionDays)
  );
}

function orgClock(
  org: {
    id: string;
    name: string;
    mediaRetentionDays: number;
    candidateRetentionDays: number;
  },
  now: Date,
  graceDays: number,
): OrgClock {
  return {
    orgId: org.id,
    orgName: org.name,
    mediaRetentionDays: org.mediaRetentionDays,
    candidateRetentionDays: org.candidateRetentionDays,
    mediaCutoff: retentionCutoff(now, org.mediaRetentionDays),
    candidateCutoff: retentionCutoff(now, org.candidateRetentionDays),
    hardDeleteCutoff: daysBefore(now, graceDays),
  };
}

/**
 * The decisions that end a review. Only these start the media clock. Every
 * other value of `decision_status` (NEW, IN_REVIEW, SHORTLISTED, INTERVIEW,
 * RETAKE_REQUESTED, ON_HOLD) is a step inside the review, during which the
 * manager may still need to watch the recording.
 */
export const TERMINAL_DECISION_STATUSES = ["ACCEPTED", "REJECTED"] as const;

export type TerminalDecisionStatus = (typeof TERMINAL_DECISION_STATUSES)[number];

export function isTerminalDecision(status: string): status is TerminalDecisionStatus {
  return (TERMINAL_DECISION_STATUSES as readonly string[]).includes(status);
}

/**
 * The instant the media clock starts for one assessment, given its decision
 * history: the latest terminal decision, or null when there is none. Null means
 * "not on the clock at all", not "count from something else". This is the rule
 * `latestTerminalDecision()` expresses in SQL; the two have to agree, and this
 * one is the testable half.
 */
export function mediaAnchorFrom(
  history: ReadonlyArray<{ status: string; at: Date }>,
): Date | null {
  let anchor: Date | null = null;
  for (const decision of history) {
    if (!isTerminalDecision(decision.status)) continue;
    if (anchor === null || decision.at.getTime() > anchor.getTime()) anchor = decision.at;
  }
  return anchor;
}

/**
 * Latest terminal decision per assessment. The media clock starts there, not at
 * the recording, the invitation, or an intermediate decision: a candidate still
 * under review keeps their video however long the review takes. An earlier
 * version anchored on any decision row and fell back to the invitation date,
 * which put a video on the clock the moment somebody clicked "in review".
 */
function latestTerminalDecision() {
  return db
    .select({
      assessmentId: decisions.assessmentId,
      decidedAt: sql<Date>`max(${decisions.at})`.as("decided_at"),
    })
    .from(decisions)
    .where(inArray(decisions.status, [...TERMINAL_DECISION_STATUSES]))
    .groupBy(decisions.assessmentId)
    .as("latest_terminal_decision");
}

/**
 * The date the media clock counts from. Deliberately no fallback: media whose
 * assessment has no terminal decision is not selected at all, and that includes
 * an upload not attached to any stage run. Such a row is kept by the candidate
 * clock instead (`candidates` cascades to everything under it), so nothing
 * lives forever, it just does not get the shorter media window.
 */
const MEDIA_ANCHOR_SQL = (ld: ReturnType<typeof latestTerminalDecision>) =>
  sql<Date>`${ld.decidedAt}`;

/** The candidate clock counts from the last contact, else from the row itself. */
const CANDIDATE_ANCHOR_SQL = sql<Date>`coalesce(${candidates.lastContactAt}, ${candidates.createdAt})`;

/** Media that has fallen out of retention and is not yet on the purge clock. */
async function planSoftMedia(clock: OrgClock, batch: number): Promise<MediaPlan> {
  const ld = latestTerminalDecision();
  const anchor = MEDIA_ANCHOR_SQL(ld);
  const where = and(
    eq(mediaAssets.orgId, clock.orgId),
    isNull(mediaAssets.purgeAfter),
    // A missing anchor is a review still open. `null < cutoff` is already not
    // true in SQL, but the intent is worth stating rather than relying on it.
    isNotNull(ld.decidedAt),
    sql`${anchor} < ${clock.mediaCutoff.toISOString()}::timestamptz`,
  );

  const [totals] = await db
    .select({
      n: count(),
      bytes: sql<string>`coalesce(sum(${mediaAssets.bytes}), 0)`,
    })
    .from(mediaAssets)
    .leftJoin(stageRuns, eq(stageRuns.id, mediaAssets.stageRunId))
    .leftJoin(attempts, eq(attempts.id, stageRuns.attemptId))
    .leftJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .leftJoin(ld, eq(ld.assessmentId, assessments.id))
    .where(where);

  const rows = await db
    .select({
      id: mediaAssets.id,
      orgId: mediaAssets.orgId,
      storageKey: mediaAssets.storageKey,
      bytes: mediaAssets.bytes,
      anchor: anchor,
    })
    .from(mediaAssets)
    .leftJoin(stageRuns, eq(stageRuns.id, mediaAssets.stageRunId))
    .leftJoin(attempts, eq(attempts.id, stageRuns.attemptId))
    .leftJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .leftJoin(ld, eq(ld.assessmentId, assessments.id))
    .where(where)
    .orderBy(asc(anchor))
    .limit(batch);

  return {
    total: totals?.n ?? 0,
    bytes: Number(totals?.bytes ?? 0),
    rows: rows.map((r) => ({ ...r, anchor: new Date(r.anchor) })),
  };
}

/** Candidates out of retention and not yet soft deleted. */
async function planSoftCandidates(
  clock: OrgClock,
  batch: number,
): Promise<CandidatePlan> {
  const where = and(
    eq(candidates.orgId, clock.orgId),
    isNull(candidates.deletedAt),
    sql`${CANDIDATE_ANCHOR_SQL} < ${clock.candidateCutoff.toISOString()}::timestamptz`,
  );

  const [totals] = await db.select({ n: count() }).from(candidates).where(where);

  const rows = await db
    .select({
      id: candidates.id,
      orgId: candidates.orgId,
      anchor: CANDIDATE_ANCHOR_SQL,
    })
    .from(candidates)
    .where(where)
    .orderBy(asc(CANDIDATE_ANCHOR_SQL))
    .limit(batch);

  const ids = rows.map((r) => r.id);
  return {
    total: totals?.n ?? 0,
    objectCount: await countCandidateObjects(ids),
    rows: rows.map((r) => ({ ...r, anchor: new Date(r.anchor) })),
  };
}

/** Media whose grace week has run out. */
async function planHardMedia(now: Date, clock: OrgClock, batch: number): Promise<MediaPlan> {
  const where = and(
    eq(mediaAssets.orgId, clock.orgId),
    isNotNull(mediaAssets.purgeAfter),
    sql`${mediaAssets.purgeAfter} <= ${now.toISOString()}::timestamptz`,
  );

  const [totals] = await db
    .select({
      n: count(),
      bytes: sql<string>`coalesce(sum(${mediaAssets.bytes}), 0)`,
    })
    .from(mediaAssets)
    .where(where);

  const rows = await db
    .select({
      id: mediaAssets.id,
      orgId: mediaAssets.orgId,
      storageKey: mediaAssets.storageKey,
      bytes: mediaAssets.bytes,
      anchor: mediaAssets.purgeAfter,
    })
    .from(mediaAssets)
    .where(where)
    .orderBy(asc(mediaAssets.purgeAfter))
    .limit(batch);

  return {
    total: totals?.n ?? 0,
    bytes: Number(totals?.bytes ?? 0),
    rows: rows.map((r) => ({ ...r, anchor: r.anchor ?? now })),
  };
}

/** Candidates soft deleted longer ago than the grace window. */
async function planHardCandidates(
  clock: OrgClock,
  batch: number,
): Promise<CandidatePlan> {
  const where = and(
    eq(candidates.orgId, clock.orgId),
    isNotNull(candidates.deletedAt),
    sql`${candidates.deletedAt} <= ${clock.hardDeleteCutoff.toISOString()}::timestamptz`,
  );

  const [totals] = await db.select({ n: count() }).from(candidates).where(where);

  const rows = await db
    .select({
      id: candidates.id,
      orgId: candidates.orgId,
      anchor: candidates.deletedAt,
    })
    .from(candidates)
    .where(where)
    .orderBy(asc(candidates.deletedAt))
    .limit(batch);

  const ids = rows.map((r) => r.id);
  return {
    total: totals?.n ?? 0,
    objectCount: await countCandidateObjects(ids),
    rows: rows.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      anchor: r.anchor ?? new Date(0),
    })),
  };
}

/**
 * Storage objects reachable from a set of candidates.
 *
 * Deleting a candidate row cascades all the way down to media_assets, so the
 * rows vanish and the objects in the bucket do not. Anything that deletes a
 * candidate has to remove these first or it leaks storage that nothing points
 * at any more, which is both a bill and a GDPR problem.
 */
async function candidateMediaKeys(
  candidateIds: string[],
): Promise<Array<{ id: string; candidateId: string; storageKey: string }>> {
  if (candidateIds.length === 0) return [];
  return db
    .select({
      id: mediaAssets.id,
      candidateId: assessments.candidateId,
      storageKey: mediaAssets.storageKey,
    })
    .from(mediaAssets)
    .innerJoin(stageRuns, eq(stageRuns.id, mediaAssets.stageRunId))
    .innerJoin(attempts, eq(attempts.id, stageRuns.attemptId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(inArray(assessments.candidateId, candidateIds));
}

async function countCandidateObjects(candidateIds: string[]): Promise<number> {
  if (candidateIds.length === 0) return 0;
  const [row] = await db
    .select({ n: count() })
    .from(mediaAssets)
    .innerJoin(stageRuns, eq(stageRuns.id, mediaAssets.stageRunId))
    .innerJoin(attempts, eq(attempts.id, stageRuns.attemptId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(inArray(assessments.candidateId, candidateIds));
  return row?.n ?? 0;
}

async function planOrg(
  clock: OrgClock,
  now: Date,
  batch: number,
): Promise<OrgPlan> {
  return {
    clock,
    softMedia: await planSoftMedia(clock, batch),
    softCandidates: await planSoftCandidates(clock, batch),
    hardMedia: await planHardMedia(now, clock, batch),
    hardCandidates: await planHardCandidates(clock, batch),
  };
}

/* -------------------------------------------------------------------------- */
/* Writing. Reached only when the caller passed apply: true.                   */
/* -------------------------------------------------------------------------- */

/**
 * Applies exactly the plan that was reported, nothing more. Every step is
 * idempotent: a marked row no longer matches the soft query, a deleted row no
 * longer matches anything, and a storage delete of a key that is already gone is
 * a no-op in both providers.
 *
 * Storage first, row second. If the object delete throws, the row stays and the
 * next run tries again; the alternative order would drop the only pointer to an
 * object we failed to remove.
 */
async function applyPlan(
  plan: OrgPlan,
  now: Date,
  graceDays: number,
): Promise<ApplyResult> {
  const storage = getStorage();
  const result: ApplyResult = {
    mediaMarked: 0,
    candidatesMarked: 0,
    mediaObjectsDeleted: 0,
    mediaKeysSkipped: 0,
    mediaRowsDeleted: 0,
    candidateObjectsDeleted: 0,
    candidateRowsDeleted: 0,
    storageFailures: [],
  };

  // Stage one: mark. Reversible for the length of the grace window.
  const purgeAfter = hardDeleteDueAt(now, graceDays);
  if (plan.softMedia.rows.length > 0) {
    const ids = plan.softMedia.rows.map((r) => r.id);
    await db
      .update(mediaAssets)
      .set({ purgeAfter })
      .where(and(inArray(mediaAssets.id, ids), isNull(mediaAssets.purgeAfter)));
    result.mediaMarked = ids.length;
    await writeAudit(
      plan.softMedia.rows.map((r) => ({
        orgId: r.orgId,
        action: "retention.media.soft_delete",
        subjectType: "media_asset",
        subjectId: r.id,
        meta: {
          storageKey: r.storageKey,
          anchor: r.anchor.toISOString(),
          retentionDays: plan.clock.mediaRetentionDays,
          purgeAfter: purgeAfter.toISOString(),
        },
      })),
    );
  }

  if (plan.softCandidates.rows.length > 0) {
    const ids = plan.softCandidates.rows.map((r) => r.id);
    await db
      .update(candidates)
      .set({ deletedAt: now })
      .where(and(inArray(candidates.id, ids), isNull(candidates.deletedAt)));
    result.candidatesMarked = ids.length;
    await writeAudit(
      plan.softCandidates.rows.map((r) => ({
        orgId: r.orgId,
        action: "retention.candidate.soft_delete",
        subjectType: "candidate",
        subjectId: r.id,
        meta: {
          anchor: r.anchor.toISOString(),
          retentionDays: plan.clock.candidateRetentionDays,
          purgeAfter: purgeAfter.toISOString(),
        },
      })),
    );
  }

  // Stage two: remove. From here nothing comes back.
  for (const row of plan.hardMedia.rows) {
    // `candidate-media.ts` inserts the row with a placeholder key and only
    // rewrites it once the upload starts, so a row can carry "pending" rather
    // than a real object path. Handing that to the storage provider would ask
    // it to delete something at the bucket root. Keys are server generated and
    // always start with `media/`; anything else is skipped and left for a human.
    if (!isRealStorageKey(row.storageKey)) {
      result.mediaKeysSkipped += 1;
      continue;
    }
    const removed = await deleteObject(storage, row.storageKey, result);
    if (!removed) continue;
    await db.delete(mediaAssets).where(eq(mediaAssets.id, row.id));
    result.mediaObjectsDeleted += 1;
    result.mediaRowsDeleted += 1;
    await writeAudit([
      {
        orgId: row.orgId,
        action: "retention.media.purge",
        subjectType: "media_asset",
        subjectId: row.id,
        meta: {
          storageKey: row.storageKey,
          bytes: row.bytes,
          markedAt: row.anchor.toISOString(),
        },
      },
    ]);
  }

  for (const row of plan.hardCandidates.rows) {
    // The cascade would orphan these objects, so they go first.
    const objects = await candidateMediaKeys([row.id]);
    let failed = false;
    for (const object of objects) {
      const removed = await deleteObject(storage, object.storageKey, result);
      if (removed) result.candidateObjectsDeleted += 1;
      else failed = true;
    }
    if (failed) {
      // Leave the row soft deleted and try again next run rather than losing
      // the only record of which objects still need removing.
      continue;
    }
    await db.delete(candidates).where(eq(candidates.id, row.id));
    result.candidateRowsDeleted += 1;
    await writeAudit([
      {
        orgId: row.orgId,
        action: "retention.candidate.purge",
        subjectType: "candidate",
        subjectId: row.id,
        meta: {
          softDeletedAt: row.anchor.toISOString(),
          objectsRemoved: objects.length,
          retentionDays: plan.clock.candidateRetentionDays,
        },
      },
    ]);
  }

  return result;
}

async function deleteObject(
  storage: ReturnType<typeof getStorage>,
  key: string,
  result: ApplyResult,
): Promise<boolean> {
  try {
    await storage.delete(key);
    return true;
  } catch (error) {
    result.storageFailures.push({
      key,
      reason: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * The job has no human actor, so `actorId` stays null and the action prefix says
 * who did it. Audit rows reference the organization, never the candidate, so
 * deleting a candidate does not cascade away the proof that they were deleted.
 */
async function writeAudit(
  rows: Array<{
    orgId: string;
    action: string;
    subjectType: string;
    subjectId: string;
    meta: Record<string, unknown>;
  }>,
): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(auditLogs).values(
    rows.map((r) => ({
      orgId: r.orgId,
      actorId: null,
      action: r.action,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      meta: r.meta,
    })),
  );
}

/* -------------------------------------------------------------------------- */
/* Report projection                                                           */
/* -------------------------------------------------------------------------- */

function mediaFinding(plan: MediaPlan, batch: number): Finding {
  const window = batchWindow(plan.total, batch);
  return {
    total: plan.total,
    inBatch: window.inBatch,
    remaining: window.remaining,
    oldest: plan.rows[0]?.anchor.toISOString() ?? null,
    sample: plan.rows.slice(0, SAMPLE_SIZE).map((r) => ({
      id: r.id,
      storageKey: r.storageKey,
      bytes: r.bytes,
      anchor: r.anchor.toISOString(),
    })),
  };
}

function candidateFinding(plan: CandidatePlan, batch: number): Finding {
  const window = batchWindow(plan.total, batch);
  return {
    total: plan.total,
    inBatch: window.inBatch,
    remaining: window.remaining,
    oldest: plan.rows[0]?.anchor.toISOString() ?? null,
    sample: plan.rows.slice(0, SAMPLE_SIZE).map((r) => ({
      id: r.id,
      anchor: r.anchor.toISOString(),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One pass over every organization.
 *
 * With no options this is a read. It opens no transaction that writes, calls no
 * storage delete, and returns a description of what a real run would do.
 */
/**
 * Storage keys are derived by `mediaKey()` and always start with `media/`. A
 * row carrying anything else never had an object behind it.
 */
function isRealStorageKey(key: string): boolean {
  return key.startsWith("media/");
}

export async function runRetention(
  options: RetentionOptions = {},
): Promise<RetentionReport> {
  const now = options.now ?? new Date();
  const batch = clampBatch(options.batch);
  const graceDays = options.graceDays ?? SOFT_DELETE_GRACE_DAYS;
  const apply = options.apply === true;

  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      mediaRetentionDays: organizations.mediaRetentionDays,
      candidateRetentionDays: organizations.candidateRetentionDays,
    })
    .from(organizations);

  const reports: OrgReport[] = [];

  for (const org of orgs) {
    const problem = settingsProblem(org);
    if (problem) {
      reports.push(misconfiguredReport(org, problem));
      continue;
    }
    const clock = orgClock(org, now, graceDays);
    const plan = await planOrg(clock, now, batch);
    const applied = apply ? await applyPlan(plan, now, graceDays) : null;

    reports.push({
      orgId: clock.orgId,
      orgName: clock.orgName,
      mediaRetentionDays: clock.mediaRetentionDays,
      candidateRetentionDays: clock.candidateRetentionDays,
      mediaCutoff: clock.mediaCutoff.toISOString(),
      candidateCutoff: clock.candidateCutoff.toISOString(),
      softDelete: {
        media: mediaFinding(plan.softMedia, batch),
        candidates: candidateFinding(plan.softCandidates, batch),
      },
      hardDelete: {
        media: mediaFinding(plan.hardMedia, batch),
        candidates: candidateFinding(plan.hardCandidates, batch),
      },
      mediaBytesDue: plan.softMedia.bytes,
      objectsToRemove: plan.hardMedia.rows.length + plan.hardCandidates.objectCount,
      applied,
    });
  }

  return {
    mode: apply ? "APPLY" : "REPORT",
    at: now.toISOString(),
    batch,
    graceDays,
    organizations: reports,
    totals: {
      mediaToMark: sum(reports, (r) => r.softDelete.media.total),
      candidatesToMark: sum(reports, (r) => r.softDelete.candidates.total),
      mediaToPurge: sum(reports, (r) => r.hardDelete.media.total),
      candidatesToPurge: sum(reports, (r) => r.hardDelete.candidates.total),
      objectsToRemove: sum(reports, (r) => r.objectsToRemove),
      bytesToRemove: sum(reports, (r) => r.mediaBytesDue),
    },
  };
}

const EMPTY_FINDING: Finding = {
  total: 0,
  inBatch: 0,
  remaining: 0,
  oldest: null,
  sample: [],
};

function misconfiguredReport(
  org: {
    id: string;
    name: string;
    mediaRetentionDays: number;
    candidateRetentionDays: number;
  },
  problem: string,
): OrgReport {
  return {
    orgId: org.id,
    orgName: org.name,
    error: problem,
    mediaRetentionDays: org.mediaRetentionDays,
    candidateRetentionDays: org.candidateRetentionDays,
    mediaCutoff: "",
    candidateCutoff: "",
    softDelete: { media: EMPTY_FINDING, candidates: EMPTY_FINDING },
    hardDelete: { media: EMPTY_FINDING, candidates: EMPTY_FINDING },
    mediaBytesDue: 0,
    objectsToRemove: 0,
    applied: null,
  };
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((acc, row) => acc + pick(row), 0);
}
