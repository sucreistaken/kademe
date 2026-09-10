import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./org";
import { attempts, assessments, stageRuns } from "./assessment";
import { competencies, weightSets } from "./library";
import { stages } from "./catalog";
import { decisionStatus } from "./enums";

/**
 * One row per evaluator per attempt. Two managers scoring the same candidate
 * produce two rows; they are shown side by side and never silently averaged.
 */
export const evaluations = pgTable(
  "evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    evaluatorId: uuid("evaluator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Which weight set the stored overall score was computed against. */
    weightSetId: uuid("weight_set_id").references(() => weightSets.id, {
      onDelete: "set null",
    }),
    /** Competency average, frozen at the time it was computed. */
    overallScore: numeric("overall_score", { precision: 4, scale: 2 }),
    /** Auto-scored questions live here, deliberately apart from the average. */
    knowledgeScore: numeric("knowledge_score", { precision: 5, scale: 2 }),
    /** AI paragraph built ONLY from this evaluator's own scores and notes. */
    aiSummary: text("ai_summary"),
    aiSummaryAt: timestamp("ai_summary_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("evaluation_per_evaluator").on(t.attemptId, t.evaluatorId),
    index("evaluations_attempt_idx").on(t.attemptId),
  ],
);

export const evaluationItems = pgTable(
  "evaluation_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "restrict" }),
    /** Scored per stage, so the rail on the review screen maps 1:1 to a stage. */
    stageId: uuid("stage_id").references(() => stages.id, {
      onDelete: "set null",
    }),
    score: integer("score"),
    selectedOptionIds: jsonb("selected_option_ids")
      .$type<string[]>()
      .default([]),
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("item_per_competency_stage").on(
      t.evaluationId,
      t.competencyId,
      t.stageId,
    ),
    index("items_evaluation_idx").on(t.evaluationId),
  ],
);

/**
 * Every change to a score, a set of observation chips or a note.
 *
 * The review screen saves silently as the manager works, which is what makes it
 * fast, but it also means a score can change without anyone noticing. A hiring
 * decision has to be defensible months later, so the trail of what was given
 * when, and by whom, is kept rather than overwritten.
 */
export const evaluationItemRevisions = pgTable(
  "evaluation_item_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evaluationItemId: uuid("evaluation_item_id")
      .notNull()
      .references(() => evaluationItems.id, { onDelete: "cascade" }),
    score: integer("score"),
    selectedOptionIds: jsonb("selected_option_ids")
      .$type<string[]>()
      .default([]),
    note: text("note"),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("item_revisions_item_at_idx").on(t.evaluationItemId, t.at)],
);

/** Free note attached to a whole stage rather than a single competency. */
export const stageNotes = pgTable(
  "stage_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    stageRunId: uuid("stage_run_id")
      .notNull()
      .references(() => stageRuns.id, { onDelete: "cascade" }),
    body: text("body"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("stage_note_pk").on(t.evaluationId, t.stageRunId)],
);

/**
 * The final call. Always a human. History is kept: a new row per change, the
 * latest by `at` is the current decision.
 */
export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    status: decisionStatus("status").notNull(),
    note: text("note"),
    decidedBy: uuid("decided_by").references(() => users.id, {
      onDelete: "set null",
    }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("decisions_assessment_at_idx").on(t.assessmentId, t.at)],
);

export const retakeRequests = pgTable(
  "retake_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    /** Empty means the whole assessment. Otherwise just these stages. */
    scopeStageIds: jsonb("scope_stage_ids").$type<string[]>().default([]),
    reason: text("reason"),
    requestedBy: uuid("requested_by").references(() => users.id, {
      onDelete: "set null",
    }),
    resultingAttemptId: uuid("resulting_attempt_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("retakes_assessment_idx").on(t.assessmentId)],
);
