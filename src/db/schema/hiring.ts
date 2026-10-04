import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./org";
import { consentTexts } from "./compliance";
import { competencies, positions } from "./library";
import {
  hiringActivityType,
  hiringMemberRole,
  hiringOpeningStatus,
  hiringProctorLevel,
  hiringStageTimeout,
  hiringVersionStatus,
  locale,
} from "./enums";
import type { I18nText } from "./types";

/**
 * Hiring solution tables (hiring solution design 2). Core tables never refer
 * to these; these refer to the core and to the organisation library.
 *
 * Tenancy: `org_id` lives on `hiring_openings` and `hiring_versions`, and a
 * version's opening must belong to the version's organisation (composite
 * foreign key, migration 0007). Every other foreign key is single-column, so
 * the database does not stop a row from pointing at another organisation's
 * parent. Every other table reaches its organisation through its parent chain
 * (stage -> version, activity -> stage, weight set -> version, member ->
 * opening). Every write must load the parent
 * through a query that filters by the caller's org_id, and a linked library row
 * (position, competency) or user must be checked to belong to the same
 * organisation in that query. The server code in src/solutions/hiring/server
 * owns this check and tests it.
 */

export type HiringLocale = "tr" | "en";

/** Per-question settings; only the keys of the question's type are set. */
export type HiringActivityConfig = {
  /** SINGLE_CHOICE / MULTI_CHOICE. `correct` never reaches a candidate. */
  choices?: Array<{ id: string; label: I18nText; correct?: boolean }>;
  /** LONG_TEXT / SHORT_TEXT */
  minChars?: number;
  maxChars?: number;
  /** FILE_UPLOAD */
  acceptedMimeTypes?: string[];
  maxFileBytes?: number;
  /** VIDEO / AUDIO: a written answer the candidate may choose instead (HIRING-UX A7). */
  textAlternativeEnabled?: boolean;
};

/** "İyi cevap örnekleri" for levels 1, 3 and 5 of this question (HIRING-UX 3.1), team language. */
export type AnswerExamples = { 1?: string; 3?: string; 5?: string };

/** Copied into the version at publish and never changed again (hiring solution design 2.3). */
export type ScorecardSnapshot = {
  scale: { min: number; max: number; levels: Array<{ value: number; label: I18nText }> };
  competencies: Array<{
    id: string;
    name: I18nText;
    anchors: Record<number, I18nText>;
    tags: Array<{ id: string; polarity: "POSITIVE" | "NEGATIVE"; label: I18nText }>;
    weight: number;
  }>;
  weightsEnabled: boolean;
};

const emptyText: I18nText = { tr: "", en: "" };

/** A hiring process for one position, with a start and an end (HIRING-UX 4.2). */
export const hiringOpenings = pgTable(
  "hiring_openings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    status: hiringOpeningStatus("status").notNull().default("DRAFT"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    decisionMakerId: uuid("decision_maker_id").references(() => users.id, { onDelete: "set null" }),
    backupDecisionMakerId: uuid("backup_decision_maker_id").references(() => users.id, { onDelete: "set null" }),
    blindMode: boolean("blind_mode").notNull().default(false),
    /** Submitted evaluations a decision needs without an override (HIRING-UX 3.10). */
    minEvaluations: integer("min_evaluations").notNull().default(2),
    /** The dated promise on the candidate's finish screen. */
    feedbackDays: integer("feedback_days").notNull().default(7),
    candidateContactEmail: text("candidate_contact_email"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("hiring_openings_org_status_idx").on(t.orgId, t.status),
    index("hiring_openings_position_idx").on(t.positionId),
    /**
     * Target of the composite (opening_id, org_id) foreign key on hiring_versions.
     * A UNIQUE constraint, not a unique index: drizzle-kit push creates foreign
     * keys before indexes, and a foreign key needs its target to exist.
     */
    unique("hiring_openings_id_org").on(t.id, t.orgId),
    check("hiring_min_evaluations", sql`${t.minEvaluations} BETWEEN 1 AND 5`),
    check("hiring_feedback_days", sql`${t.feedbackDays} BETWEEN 1 AND 60`),
  ],
);

/** The opening's default panel; copied onto each invitation in plan 2. */
export const hiringOpeningMembers = pgTable(
  "hiring_opening_members",
  {
    openingId: uuid("opening_id")
      .notNull()
      .references(() => hiringOpenings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: hiringMemberRole("role").notNull().default("EVALUATOR"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.openingId, t.userId] }), index("hiring_opening_members_user_idx").on(t.userId)],
);

/** One assessment per opening, versioned automatically: publish = lock, edit = new draft. */
export const hiringVersions = pgTable(
  "hiring_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** With org_id, references hiring_openings(id, org_id): see hiring_versions_opening_org_fk. */
    openingId: uuid("opening_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    status: hiringVersionStatus("status").notNull().default("DRAFT"),
    defaultLocale: locale("default_locale").notNull().default("tr"),
    localeSet: jsonb("locale_set").$type<HiringLocale[]>().notNull().default(["tr"]),
    introTitle: jsonb("intro_title").$type<I18nText>(),
    introBody: jsonb("intro_body").$type<I18nText>(),
    consentTextId: uuid("consent_text_id").references(() => consentTexts.id, { onDelete: "restrict" }),
    proctorLevel: hiringProctorLevel("proctor_level").notNull().default("BASIC"),
    practiceEnabled: boolean("practice_enabled").notNull().default(true),
    scorecard: jsonb("scorecard").$type<ScorecardSnapshot>(),
    /** Draft only: weighting on or off, and the percentages per competency id. */
    weightsEnabled: boolean("weights_enabled").notNull().default(false),
    draftWeights: jsonb("draft_weights").$type<Record<string, number>>(),
    previewedAt: timestamp("previewed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /**
     * RESTRICT, not SET NULL: a published row is frozen by triggers (migration
     * 0006), so a SET NULL caused by deleting the user would be an UPDATE of a
     * frozen row and be refused. Users are disabled, never deleted.
     */
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("hiring_version_number").on(t.openingId, t.versionNumber),
    uniqueIndex("one_draft_per_opening").on(t.openingId).where(sql`status = 'DRAFT'`),
    check("hiring_published_has_scorecard", sql`${t.status} <> 'PUBLISHED' OR ${t.scorecard} IS NOT NULL`),
    check(
      "hiring_published_has_publisher",
      sql`${t.status} <> 'PUBLISHED' OR (${t.publishedAt} IS NOT NULL AND ${t.publishedBy} IS NOT NULL)`,
    ),
    check("hiring_version_number_positive", sql`${t.versionNumber} >= 1`),
    /** locale_set is a jsonb array of locale strings; `?` tests array membership. */
    check("hiring_default_locale_in_set", sql`${t.localeSet} ? ${t.defaultLocale}::text`),
    /** The opening belongs to the same organisation as the version. */
    foreignKey({
      name: "hiring_versions_opening_org_fk",
      columns: [t.openingId, t.orgId],
      foreignColumns: [hiringOpenings.id, hiringOpenings.orgId],
    }).onDelete("cascade"),
  ],
);

export const hiringStages = pgTable(
  "hiring_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => hiringVersions.id, { onDelete: "cascade" }),
    /** Plain index, renumbered 0..n-1 by the server after every change. */
    orderIndex: integer("order_index").notNull(),
    name: jsonb("name").$type<I18nText>().notNull(),
    description: jsonb("description").$type<I18nText>().notNull().default(emptyText),
    /** Team only. */
    internalPurpose: text("internal_purpose"),
    durationSeconds: integer("duration_seconds").notNull().default(600),
    graceSeconds: integer("grace_seconds").notNull().default(0),
    onTimeout: hiringStageTimeout("on_timeout").notNull().default("AUTO_SUBMIT"),
    backNavigation: boolean("back_navigation").notNull().default(false),
  },
  (t) => [
    index("hiring_stages_version_idx").on(t.versionId, t.orderIndex),
    check("hiring_stage_duration", sql`${t.durationSeconds} BETWEEN 60 AND 7200`),
    check("hiring_stage_grace", sql`${t.graceSeconds} >= 0`),
    check("hiring_stage_order", sql`${t.orderIndex} >= 0`),
  ],
);

export const hiringActivities = pgTable(
  "hiring_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => hiringStages.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    type: hiringActivityType("type").notNull(),
    required: boolean("required").notNull().default(true),
    /* shown to the candidate */
    prompt: jsonb("prompt").$type<I18nText>().notNull(),
    note: jsonb("note").$type<I18nText>().notNull().default(emptyText),
    /* team only: never selected for a candidate (candidate view whitelist) */
    internalQuestion: text("internal_question"),
    expectedBehaviours: jsonb("expected_behaviours").$type<string[]>().notNull().default([]),
    redFlags: jsonb("red_flags").$type<string[]>().notNull().default([]),
    managerNotes: text("manager_notes"),
    answerExamples: jsonb("answer_examples").$type<AnswerExamples>().notNull().default({}),
    /* timing */
    thinkSeconds: integer("think_seconds").notNull().default(60),
    /** True: when think time ends, recording does not start by itself (HIRING-UX A5). */
    flexibleThink: boolean("flexible_think").notNull().default(true),
    answerSeconds: integer("answer_seconds"),
    /** 2 = one retake (HIRING-UX 0 #10). */
    maxTakes: integer("max_takes").notNull().default(2),
    config: jsonb("config").$type<HiringActivityConfig>().notNull().default({}),
  },
  (t) => [
    index("hiring_activities_stage_idx").on(t.stageId, t.orderIndex),
    check("hiring_activity_takes", sql`${t.maxTakes} BETWEEN 1 AND 5`),
    check("hiring_activity_think", sql`${t.thinkSeconds} BETWEEN 0 AND 600`),
    check("hiring_activity_answer", sql`${t.answerSeconds} IS NULL OR ${t.answerSeconds} > 0`),
    check("hiring_activity_order", sql`${t.orderIndex} >= 0`),
  ],
);

/** The 1-2 competencies a question measures. Choice questions measure none. */
export const hiringActivityCompetencies = pgTable(
  "hiring_activity_competencies",
  {
    /** FK named explicitly: the default name is 64 characters and Postgres cuts it to 63. */
    activityId: uuid("activity_id").notNull(),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "restrict" }),
    orderIndex: integer("order_index").notNull(),
  },
  (t) => [
    foreignKey({
      name: "hiring_activity_competencies_activity_fk",
      columns: [t.activityId],
      foreignColumns: [hiringActivities.id],
    }).onDelete("cascade"),
    primaryKey({ columns: [t.activityId, t.competencyId] }),
    uniqueIndex("hiring_activity_competency_slot").on(t.activityId, t.orderIndex),
    index("hiring_activity_competencies_competency_idx").on(t.competencyId),
    check("hiring_at_most_two_competencies", sql`${t.orderIndex} IN (0, 1)`),
  ],
);

/**
 * Weights after publishing (old rule kept): a change is a new set with a
 * reason; scores keep the set they were computed with (HIRING-UX R10). The
 * first set is written at publish from the scorecard.
 */
export const hiringWeightSets = pgTable(
  "hiring_weight_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => hiringVersions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    /** Active = weighting is on with this set. No active set = plain average. */
    isActive: boolean("is_active").notNull().default(false),
    reason: text("reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("hiring_weight_sets_version_idx").on(t.versionId),
    uniqueIndex("one_active_weight_set").on(t.versionId).where(sql`is_active`),
  ],
);

export const hiringWeights = pgTable(
  "hiring_weights",
  {
    weightSetId: uuid("weight_set_id")
      .notNull()
      .references(() => hiringWeightSets.id, { onDelete: "cascade" }),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "restrict" }),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.weightSetId, t.competencyId] }),
    check("hiring_weight_percentage", sql`${t.percentage} BETWEEN 0 AND 100`),
  ],
);
