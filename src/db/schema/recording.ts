import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { attempts } from "./assessment";
import { organizations } from "./org";
import { proctorSessions } from "./proctoring";

/**
 * The continuous recording of a proctored attempt: the webcam (with the
 * microphone) and, when the policy shares the screen, the screen. Each row is
 * one short, independently playable file. The panel plays them back in order;
 * see docs/PROCTORING.md for the sizes and src/lib/client/proctor/recording.ts
 * for how the browser cuts them.
 */
export const proctorRecordingKind = pgEnum("proctor_recording_kind", ["CAMERA", "SCREEN"]);

export const proctorRecordings = pgTable(
  "proctor_recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => proctorSessions.id, { onDelete: "set null" }),
    kind: proctorRecordingKind("kind").notNull(),
    /**
     * One uninterrupted recorder run in one tab. A reload, or a camera that was
     * lost and came back, starts a new run whose sequence starts at 0 again.
     */
    runId: text("run_id").notNull(),
    sequence: integer("sequence").notNull(),
    /** Server clock (the browser corrects its own by the session offset). */
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    bytes: bigint("bytes", { mode: "number" }).notNull(),
    mime: text("mime").notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** startedAt plus the organisation's evidence retention; the purge job deletes from here on. */
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
  },
  (t) => [
    // A retried upload of the same segment lands on the same row.
    uniqueIndex("proctor_recording_segment").on(t.attemptId, t.kind, t.runId, t.sequence),
    index("proctor_recordings_attempt_idx").on(t.attemptId, t.startedAt),
    index("proctor_recordings_purge_idx").on(t.purgeAfter),
    check("proctor_recordings_positive", sql`${t.durationMs} > 0 AND ${t.bytes} > 0 AND ${t.sequence} >= 0`),
  ],
);

export type ProctorRecordingRow = typeof proctorRecordings.$inferSelect;
