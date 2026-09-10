import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./org";
import { templateVersions, stages, activities } from "./catalog";
import {
  linkStatus,
  attemptScope,
  runCompletion,
  mediaStatus,
  locale,
} from "./enums";
import type { ResponsePayload, TranscriptWord, UploadPart } from "./types";

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fullName: text("full_name"),
    email: text("email"),
    phone: text("phone"),
    location: text("location"),
    extra: jsonb("extra").$type<Record<string, string>>().default({}),
    /** Set by the retention job. Rows are soft deleted for 7 days first. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("candidates_org_idx").on(t.orgId),
    index("candidates_email_idx").on(t.email),
  ],
);

/** One candidate invited to one frozen template version. The invitation itself. */
export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .notNull()
      .references(() => templateVersions.id, { onDelete: "restrict" }),
    /** Which language the candidate is taking it in. */
    locale: locale("locale").notNull().default("tr"),
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("assessments_org_idx").on(t.orgId),
    index("assessments_candidate_idx").on(t.candidateId),
  ],
);

/**
 * The candidate's only credential. `tokenHash` is sha256 of a 32 byte random
 * value; the raw token exists only in the URL the manager copies. Rate limited
 * on lookup so the space cannot be probed.
 */
export const assessmentLinks = pgTable(
  "assessment_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    status: linkStatus("status").notNull().default("NOT_STARTED"),
    notBefore: timestamp("not_before", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attemptsAllowed: integer("attempts_allowed").notNull().default(1),
    /** First device we saw. A later mismatch is surfaced to the manager as a
     *  note, never used to block the candidate. */
    firstSeenIp: text("first_seen_ip"),
    firstSeenUserAgent: text("first_seen_user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("links_assessment_idx").on(t.assessmentId),
    /**
     * At most one usable link per assessment. Two live tokens would mean a link
     * the manager thinks they revoked still opens the assessment, and "which
     * link did they use" becomes unanswerable. A retake reuses this same link
     * (status moves to RETAKE_AVAILABLE), so this is the rule, not a limitation.
     * Superseded links stay as EXPIRED rows rather than being deleted.
     */
    uniqueIndex("one_active_link_per_assessment")
      .on(t.assessmentId)
      .where(sql`status <> 'EXPIRED'`),
  ],
);

/**
 * A retake never deletes anything. It opens a new attempt; stages outside the
 * retake scope get a stage_run that points back at the previous run through
 * carriedFromStageRunId rather than copying data.
 */
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    scope: attemptScope("scope").notNull().default("FULL"),
    /** Only one attempt per assessment drives the score and the comparison table. */
    isPrimary: boolean("is_primary").notNull().default(true),
    createdReason: text("created_reason"),
    /**
     * Device check is per attempt, not per candidate: a retake may happen on a
     * different machine, and a candidate invited to a second position must not
     * inherit a stale "camera already verified" flag from the first.
     */
    deviceCheckedAt: timestamp("device_checked_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("attempt_number_per_assessment").on(
      t.assessmentId,
      t.attemptNumber,
    ),
    index("attempts_assessment_idx").on(t.assessmentId),
  ],
);

/** One execution of one stage inside one attempt. Owns the authoritative clock. */
export const stageRuns = pgTable(
  "stage_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "restrict" }),
    /** Set on a PARTIAL retake: this stage was not redone, read the old run. */
    carriedFromStageRunId: uuid("carried_from_stage_run_id"),
    /** Written by the server when the stage is served. Never trusted from the client. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    completion: runCompletion("completion").notNull().default("PENDING"),
    wasLate: boolean("was_late").notNull().default(false),
  },
  (t) => [
    uniqueIndex("stage_run_per_attempt").on(t.attemptId, t.stageId),
    index("stage_runs_attempt_idx").on(t.attemptId),
    index("stage_runs_deadline_idx").on(t.deadlineAt),
  ],
);

export const responses = pgTable(
  "responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stageRunId: uuid("stage_run_id")
      .notNull()
      .references(() => stageRuns.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "restrict" }),
    payload: jsonb("payload").$type<ResponsePayload>().notNull().default({}),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("response_per_activity").on(t.stageRunId, t.activityId),
    index("responses_run_idx").on(t.stageRunId),
  ],
);

/**
 * Recorded media. Parts are uploaded straight to R2 while the candidate is still
 * talking, so a browser crash leaves a playable INCOMPLETE asset rather than
 * nothing. This is also what keeps iOS Safari from dying on long recordings.
 */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stageRunId: uuid("stage_run_id").references(() => stageRuns.id, {
      onDelete: "cascade",
    }),
    activityId: uuid("activity_id").references(() => activities.id, {
      onDelete: "set null",
    }),
    storageKey: text("storage_key").notNull(),
    mime: text("mime").notNull(),
    durationMs: integer("duration_ms"),
    bytes: bigint("bytes", { mode: "number" }),
    checksum: text("checksum"),
    status: mediaStatus("status").notNull().default("UPLOADING"),
    /** R2 / S3 multipart bookkeeping so an interrupted upload can resume. */
    uploadId: text("upload_id"),
    parts: jsonb("parts").$type<UploadPart[]>().default([]),
    /** Set by the retention job before the object itself is removed. */
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("media_run_idx").on(t.stageRunId),
    index("media_purge_idx").on(t.purgeAfter),
  ],
);

/** Lets the manager read instead of watch, and click a line to seek the video. */
export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" })
      .unique(),
    language: text("language"),
    text: text("text").notNull(),
    words: jsonb("words").$type<TranscriptWord[]>().default([]),
    provider: text("provider").notNull().default("elevenlabs-scribe"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);
