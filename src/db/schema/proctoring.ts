import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { attempts, sectionRuns } from "./assessment";
import { aiRuns } from "./compliance";
import {
  aiReviewStatus,
  aiVerdict,
  evidenceKind,
  evidenceTrigger,
  proctorEventType,
  proctorSeverity,
  proctorSource,
  teacherFlagStatus,
} from "./enums";
import { organizations, users } from "./org";

/**
 * Proctoring records. They hang off the attempt, not off a section, because a
 * lot happens outside a section: the system check, the pause between sections,
 * a reload.
 *
 * What this can and cannot see is written down in docs/PROCTORING.md. Nothing
 * here fails a student on its own; every flag is for a teacher to look at.
 */

/** One browser tab that ran the exam. Two live at once is itself a flag. */
export const proctorSessions = pgTable(
  "proctor_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    clientSessionId: text("client_session_id").notNull(),
    /** Browser, screen, share surface, model state, detection rate. */
    env: jsonb("env").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last state the heartbeat reported: share, fullscreen, camera, mic, model. */
    lastState: jsonb("last_state").$type<Record<string, unknown>>(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("proctor_session_per_client").on(t.attemptId, t.clientSessionId),
    index("proctor_sessions_attempt_idx").on(t.attemptId),
  ],
);

export const proctorEvents = pgTable(
  "proctor_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    /** DEPRECATED: replaced by segment_kind + segment_run_id. Dropped by migration 0003. */
    sectionRunId: uuid("section_run_id").references(() => sectionRuns.id, { onDelete: "set null" }),
    /**
     * Which part of the attempt was running, as the solution names it
     * ("section_run" for the exam). No foreign key: proctoring records, it does
     * not need to know the solution's tables.
     */
    segmentKind: text("segment_kind"),
    segmentRunId: uuid("segment_run_id"),
    sessionId: uuid("session_id").references(() => proctorSessions.id, { onDelete: "set null" }),
    /** Idempotency and interval closing. Server events get a generated one. */
    clientEventId: text("client_event_id").notNull(),
    type: proctorEventType("type").notNull(),
    severity: proctorSeverity("severity").notNull(),
    source: proctorSource("source").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    teacherStatus: teacherFlagStatus("teacher_status").notNull().default("OPEN"),
    teacherNote: text("teacher_note"),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("proctor_event_client_id").on(t.attemptId, t.clientEventId),
    index("proctor_events_attempt_idx").on(t.attemptId, t.startedAt),
    check("proctor_events_segment_pair", sql`(${t.segmentKind} IS NULL) = (${t.segmentRunId} IS NULL)`),
  ],
);

/** Frames and short clips. Small, attempt-scoped, uploaded in one request each. */
export const proctorEvidence = pgTable(
  "proctor_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => proctorEvents.id, { onDelete: "set null" }),
    kind: evidenceKind("kind").notNull(),
    trigger: evidenceTrigger("trigger").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    storageKey: text("storage_key").notNull(),
    mime: text("mime").notNull(),
    bytes: bigint("bytes", { mode: "number" }),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    /** What the browser model saw in this frame, if it ran. */
    browserSignals: jsonb("browser_signals").$type<Record<string, unknown>>(),
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
  },
  (t) => [
    index("proctor_evidence_attempt_idx").on(t.attemptId, t.capturedAt),
    index("proctor_evidence_event_idx").on(t.eventId),
    index("proctor_evidence_purge_idx").on(t.purgeAfter),
  ],
);

/** The Gemini second look at the frames behind one event. Facts only, never intent. */
export const proctorAiReviews = pgTable(
  "proctor_ai_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => proctorEvents.id, { onDelete: "cascade" })
      .unique(),
    status: aiReviewStatus("status").notNull().default("QUEUED"),
    verdict: aiVerdict("verdict"),
    observations: jsonb("observations").$type<Record<string, unknown>>(),
    summary: text("summary"),
    confidence: real("confidence"),
    model: text("model"),
    aiRunId: uuid("ai_run_id").references(() => aiRuns.id, { onDelete: "set null" }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
);

export type ProctorEventRowType = typeof proctorEvents.$inferInsert.type;
