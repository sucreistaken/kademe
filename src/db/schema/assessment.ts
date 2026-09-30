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
  real,
  check,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { BlueprintConfig } from "@/lib/exam/blueprint";
import type { IntegrityResult } from "@/lib/proctor/integrity";
import type { ItemAnswer, ItemSnapshot, Presentation } from "@/lib/exam/types";
import { organizations, users } from "./org";
import { examBlueprints, items } from "./exam";
import {
  linkStatus,
  runCompletion,
  mediaStatus,
  locale,
  examMode,
  cefrLevel,
  section,
  integrityOutcome,
} from "./enums";
import type { TranscriptWord, UploadPart } from "./types";

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

/**
 * One student invited to one exam. The blueprint config is copied here at
 * invite time, so the exam this student takes never changes under them.
 */
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
    blueprintId: uuid("blueprint_id")
      .notNull()
      .references(() => examBlueprints.id, { onDelete: "restrict" }),
    blueprintName: text("blueprint_name").notNull(),
    blueprintSnapshot: jsonb("blueprint_snapshot").$type<BlueprintConfig>().notNull(),
    mode: examMode("mode").notNull(),
    /** The level the student says they hold. Required for a verification exam. */
    claimedLevel: cefrLevel("claimed_level"),
    /** Interface language. The exam content itself is German. */
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
    check(
      "claimed_for_verification",
      sql`${t.mode} <> 'LEVEL_VERIFICATION' OR ${t.claimedLevel} IS NOT NULL`,
    ),
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
     * the teacher thinks they revoked still opens the exam, and "which link did
     * they use" becomes unanswerable. A retake is a new invitation with its own
     * link. Superseded links stay as EXPIRED rows rather than being deleted.
     */
    uniqueIndex("one_active_link_per_assessment")
      .on(t.assessmentId)
      .where(sql`status <> 'EXPIRED'`),
  ],
);

/**
 * The single sitting of an exam. One per assessment: a second try is a new
 * invitation, so every attempt has exactly one result and one evidence trail.
 */
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull().default(1),
    isPrimary: boolean("is_primary").notNull().default(true),
    createdReason: text("created_reason"),
    /** Set when every required system check passed (camera, screen, ...). */
    deviceCheckedAt: timestamp("device_checked_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Proctoring summary, recomputed when events, AI reviews or teacher flags change. */
    integritySummary: jsonb("integrity_summary").$type<IntegrityResult>(),
    integrityComputedAt: timestamp("integrity_computed_at", { withTimezone: true }),
    integrityOutcome: integrityOutcome("integrity_outcome"),
    integrityNote: text("integrity_note"),
    integrityDecidedBy: uuid("integrity_decided_by").references(() => users.id, { onDelete: "set null" }),
    integrityDecidedAt: timestamp("integrity_decided_at", { withTimezone: true }),
    /** Only when the school enabled termination rules. Never set by AI flags. */
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),
    terminationReason: text("termination_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("one_attempt_per_assessment").on(t.assessmentId),
    index("attempts_assessment_idx").on(t.assessmentId),
  ],
);

/** One section inside one attempt. Owns the authoritative clock. */
export const sectionRuns = pgTable(
  "section_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    section: section("section").notNull(),
    orderIndex: integer("order_index").notNull(),
    /** Written by the server when the section starts. Never trusted from the client. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    completion: runCompletion("completion").notNull().default("PENDING"),
    wasLate: boolean("was_late").notNull().default(false),
    /** Fixed forms: the planned item ids in order. Null for adaptive sections. */
    itemPlan: jsonb("item_plan").$type<string[]>(),
    /** Writing / speaking: the level each task is drawn at. */
    taskLevels: jsonb("task_levels").$type<string[]>(),
    /** Listening: how often each clip was started, keyed by stimulus id. */
    stimulusPlays: jsonb("stimulus_plays").$type<Record<string, number>>().notNull().default({}),
    /** Adaptive: why the section stopped serving. */
    stopReason: text("stop_reason"),
    /** Final posterior for objective sections, cached for lists. */
    thetaMean: real("theta_mean"),
    thetaSd: real("theta_sd"),
  },
  (t) => [
    uniqueIndex("section_run_per_attempt").on(t.attemptId, t.section),
    index("section_runs_attempt_idx").on(t.attemptId),
    index("section_runs_deadline_idx").on(t.deadlineAt),
  ],
);

/**
 * One served item. The whole item, key included, is frozen into
 * `itemSnapshot` when it is served, so the report stays right even if the bank
 * item is edited or retired later.
 */
export const itemResponses = pgTable(
  "item_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionRunId: uuid("section_run_id")
      .notNull()
      .references(() => sectionRuns.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    itemSnapshot: jsonb("item_snapshot").$type<ItemSnapshot>().notNull(),
    presentation: jsonb("presentation").$type<Presentation>().notNull().default({}),
    answer: jsonb("answer").$type<ItemAnswer>(),
    servedAt: timestamp("served_at", { withTimezone: true }).notNull().defaultNow(),
    /** Set when the student moves on. Until then the answer is a draft. */
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    /** 0..1 for objective items; null for writing and speaking. */
    score: real("score"),
    isCorrect: boolean("is_correct"),
    thetaAfter: real("theta_after"),
    seAfter: real("se_after"),
    /** Planned but never reached before the section closed. Scored 0. */
    notReached: boolean("not_reached").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("item_response_sequence").on(t.sectionRunId, t.sequence),
    uniqueIndex("item_response_item").on(t.sectionRunId, t.itemId),
    index("item_responses_run_idx").on(t.sectionRunId),
  ],
);

/**
 * Recorded media. Parts are uploaded straight to R2 while the candidate is still
 * talking, so a browser crash leaves a playable INCOMPLETE asset rather than
 * nothing.
 */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sectionRunId: uuid("section_run_id").references(() => sectionRuns.id, {
      onDelete: "cascade",
    }),
    itemResponseId: uuid("item_response_id").references(() => itemResponses.id, {
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
    index("media_run_idx").on(t.sectionRunId),
    index("media_purge_idx").on(t.purgeAfter),
  ],
);

/** Lets the teacher read instead of watch, click a line to seek, and feeds speaking grading. */
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
