import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, jsonb, numeric, pgTable, primaryKey, real, text, timestamp, unique, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { organizations, users } from "./org";
import { consentTexts } from "./compliance";
import { competencies, positions } from "./library";
import { assessments, attempts, mediaAssets } from "./assessment";
import {
  hiringActivityType,
  hiringMemberRole,
  hiringOpeningStatus,
  hiringProctorLevel,
  hiringStageTimeout,
  hiringVersionStatus,
  locale,
  runCompletion,
  solution,
} from "./enums";
import type { I18nText } from "./types";

/**
 * Hiring solution tables (hiring solution design 2). Core tables never refer
 * to these; these refer to the core and to the organisation library.
 *
 * Tenancy: `org_id` lives on `hiring_openings`, `hiring_versions` and
 * `hiring_assessments`. A version's opening must belong to the version's
 * organisation (composite foreign key, migration 0007), and an invitation's
 * version must belong to its opening and both to the invitation's
 * organisation (composite foreign keys, migration 0010). Every other table
 * reaches its organisation through its parent chain: stage -> version,
 * activity -> stage, weight set -> version, member -> opening, assignment ->
 * invitation, stage run -> attempt -> core invitation (org_id), response ->
 * stage run, survey answer -> invitation. Every write must load the parent
 * through a query that filters by the caller's org_id (or, on the candidate
 * side, by the token's own invitation), and a linked library row or user must
 * be checked to belong to the same organisation in that query. The server code
 * in src/solutions/hiring/server owns this check and tests it.
 *
 * `hiring_assessments.org_id` equals its core invitation's org_id and
 * `candidate_requests.org_id` equals theirs: the database enforces both
 * (composite foreign keys to assessments(id, org_id), migration 0011).
 *
 * Same-version invariants the database does NOT enforce, so every writer
 * derives and tests them: a stage run's `stage_id` and a response's
 * `activity_id` come from the invitation's frozen version (the server derives
 * them, the client never names them), and an invitation's `consent_text_id` is
 * a HIRING consent text of the same organisation.
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

/** A candidate's answer to one question, as stored. Recordings and files are attached by the server, never named by the client. */
export type HiringResponsePayload = {
  text?: string;
  choiceIds?: string[];
  /** A video or audio question answered in writing (HIRING-UX A7), shown to reviewers as the penalty-free alternative. */
  usedTextAlternative?: boolean;
  /** FILE_UPLOAD: the attached file as the candidate named it (one file per question). */
  file?: { name: string; bytes: number; mime: string };
  /** FILE_UPLOAD: an upload that was opened and has not completed yet. */
  pendingFile?: { assetId: string; name: string; bytes: number; mime: string };
};

/** Copied into the version at publish and never changed again (hiring solution design 2.3). */
export type ScorecardSnapshot = {
  /** Shape version of this JSON; bump it (and keep a reader for the old one) when the shape changes. */
  schemaVersion: 1;
  scale: { min: number; max: number; levels: Array<{ value: number; label: I18nText }> };
  competencies: Array<{
    id: string;
    name: I18nText;
    /** The library description at publish; may be empty. */
    description: I18nText;
    anchors: Record<number, I18nText>;
    /** In the library's order (order_index, then id). */
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
    /** HIRING-UX 5.18 / 6.13: the short experience survey on the candidate's finish screen. */
    finishSurveyEnabled: boolean("finish_survey_enabled").notNull().default(true),
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
    /** Target of the invitation's composite key: a version, its opening and its organisation together. */
    unique("hiring_versions_id_opening_org").on(t.id, t.openingId, t.orgId),
    check("hiring_published_has_scorecard", sql`${t.status} <> 'PUBLISHED' OR ${t.scorecard} IS NOT NULL`),
    check(
      "hiring_published_has_publisher",
      sql`${t.status} <> 'PUBLISHED' OR (${t.publishedAt} IS NOT NULL AND ${t.publishedBy} IS NOT NULL)`,
    ),
    check("hiring_version_number_positive", sql`${t.versionNumber} >= 1`),
    /** locale_set is a jsonb array of locale strings; `?` tests array membership. */
    check("hiring_default_locale_in_set", sql`${t.localeSet} ? ${t.defaultLocale}::text`),
    /** `?` also matches a bare JSON string, so locale_set must be an array. */
    check("hiring_locale_set_is_array", sql`jsonb_typeof(${t.localeSet}) = 'array'`),
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

/**
 * One person invited to one opening's published version (hiring solution
 * design 2.4). The version, the consent text and the proctoring level are
 * frozen here at invite, so a later version or setting never changes what
 * this candidate was promised.
 */
export const hiringAssessments = pgTable(
  "hiring_assessments",
  {
    assessmentId: uuid("assessment_id").primaryKey(),
    /** Always HIRING: with assessment_id it references assessments(id, solution). */
    solution: solution("solution").notNull().default("HIRING"),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    openingId: uuid("opening_id").notNull(),
    versionId: uuid("version_id").notNull(),
    /** 0, 25 or 50; chosen by the candidate without a reason (HIRING-UX 6.1). Never read for reviewers. */
    extraTimePct: integer("extra_time_pct").notNull().default(0),
    extraTimeChosenAt: timestamp("extra_time_chosen_at", { withTimezone: true }),
    consentTextId: uuid("consent_text_id")
      .notNull()
      .references(() => consentTexts.id, { onDelete: "restrict" }),
    /** Plan 2 freezes OFF; plan 4 copies the version's level onto new invitations. */
    proctorLevel: hiringProctorLevel("proctor_level").notNull().default("OFF"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("hiring_assessments_opening_idx").on(t.openingId),
    check("hiring_assessment_is_hiring", sql`${t.solution} = 'HIRING'`),
    check("hiring_extra_time_pct", sql`${t.extraTimePct} IN (0, 25, 50)`),
    /** The invitation's organisation is the core invitation's (migration 0011). */
    foreignKey({
      name: "hiring_assessments_org_fk",
      columns: [t.assessmentId, t.orgId],
      foreignColumns: [assessments.id, assessments.orgId],
    }).onDelete("cascade"),
    foreignKey({
      name: "hiring_assessments_assessment_fk",
      columns: [t.assessmentId, t.solution],
      foreignColumns: [assessments.id, assessments.solution],
    }).onDelete("cascade"),
    /** NO ACTION (checked at the end of the statement), so deleting an organisation still cascades through both parents. */
    foreignKey({
      name: "hiring_assessments_opening_fk",
      columns: [t.openingId, t.orgId],
      foreignColumns: [hiringOpenings.id, hiringOpenings.orgId],
    }),
    foreignKey({
      name: "hiring_assessments_version_fk",
      columns: [t.versionId, t.openingId, t.orgId],
      foreignColumns: [hiringVersions.id, hiringVersions.openingId, hiringVersions.orgId],
    }),
  ],
);

/** Who evaluates this candidate: the opening's active panel, copied at invite (spec 2.1). */
export const hiringAssignments = pgTable(
  "hiring_assignments",
  {
    assessmentId: uuid("assessment_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.assessmentId, t.userId] }),
    index("hiring_assignments_user_idx").on(t.userId),
    foreignKey({
      name: "hiring_assignments_assessment_fk",
      columns: [t.assessmentId],
      foreignColumns: [hiringAssessments.assessmentId],
    }).onDelete("cascade"),
  ],
);

/** One stage inside one attempt. Owns the authoritative clock (written once at start). */
export const hiringStageRuns = pgTable(
  "hiring_stage_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    /** NO ACTION: a stage with runs belongs to a published version, which the triggers never let go. */
    stageId: uuid("stage_id")
      .notNull()
      .references(() => hiringStages.id),
    orderIndex: integer("order_index").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    completion: runCompletion("completion").notNull().default("PENDING"),
    wasLate: boolean("was_late").notNull().default(false),
    /** Retakes (plan 3): a stage outside the retake scope points at the run it carries over. */
    carriedFromStageRunId: uuid("carried_from_stage_run_id"),
  },
  (t) => [
    uniqueIndex("hiring_stage_run_per_attempt").on(t.attemptId, t.stageId),
    index("hiring_stage_runs_deadline_idx").on(t.deadlineAt),
    index("hiring_stage_runs_stage_idx").on(t.stageId),
    index("hiring_stage_runs_carried_from_idx").on(t.carriedFromStageRunId).where(sql`carried_from_stage_run_id IS NOT NULL`),
    check("hiring_stage_run_order", sql`${t.orderIndex} >= 0`),
    foreignKey({
      name: "hiring_stage_runs_carried_from_fk",
      columns: [t.carriedFromStageRunId],
      foreignColumns: [t.id as AnyPgColumn],
    }).onDelete("set null"),
  ],
);

/** The candidate's answer to one question in one stage run (hiring solution design 2.4). */
export const hiringResponses = pgTable(
  "hiring_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stageRunId: uuid("stage_run_id")
      .notNull()
      .references(() => hiringStageRuns.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => hiringActivities.id),
    payload: jsonb("payload").$type<HiringResponsePayload>().notNull().default({}),
    /** The take that is the answer (the newest one). Purging media leaves the response. */
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    /** Every take opened for this question, oldest first. `takes_used` (at most 5) is authoritative for the limit; this lists the takes. */
    takeAssetIds: jsonb("take_asset_ids").$type<string[]>().notNull().default([]),
    fileAssetIds: jsonb("file_asset_ids").$type<string[]>().notNull().default([]),
    takesUsed: integer("takes_used").notNull().default(0),
    usedTextAlternative: boolean("used_text_alternative").notNull().default(false),
    /** Choice questions only, 0..1, for the separate knowledge score; never sent to the candidate. */
    autoScore: real("auto_score"),
    /** When the candidate closed this question (moved on, submitted, or the stage closed). */
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("hiring_response_per_activity").on(t.stageRunId, t.activityId),
    index("hiring_responses_media_idx").on(t.mediaAssetId),
    index("hiring_responses_activity_idx").on(t.activityId),
    check("hiring_response_takes", sql`${t.takesUsed} >= 0`),
    check("hiring_response_takes_max", sql`${t.takesUsed} <= 5`),
    check("hiring_response_auto_score", sql`${t.autoScore} IS NULL OR (${t.autoScore} >= 0 AND ${t.autoScore} <= 1)`),
  ],
);

/** HIRING-UX 6.13: the optional experience survey, one answer per invitation. */
export const hiringSurveyResponses = pgTable(
  "hiring_survey_responses",
  {
    assessmentId: uuid("assessment_id").primaryKey(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("hiring_survey_rating", sql`${t.rating} BETWEEN 1 AND 5`),
    check("hiring_survey_comment_length", sql`char_length(${t.comment}) <= 2000`),
    foreignKey({
      name: "hiring_survey_assessment_fk",
      columns: [t.assessmentId],
      foreignColumns: [hiringAssessments.assessmentId],
    }).onDelete("cascade"),
  ],
);
