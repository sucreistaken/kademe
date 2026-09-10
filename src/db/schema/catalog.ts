import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./org";
import {
  versionStatus,
  activityType,
  timeoutBehaviour,
  locale,
} from "./enums";
import type { I18nText, ActivityConfig } from "./types";

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    shortDescription: text("short_description"),
    /** The full job ad. This is what the AI builder reads. */
    jobDescription: text("job_description"),
    requiredSkills: jsonb("required_skills").$type<string[]>().default([]),
    preferredSkills: jsonb("preferred_skills").$type<string[]>().default([]),
    languages: jsonb("languages").$type<string[]>().default([]),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("positions_org_idx").on(t.orgId)],
);

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /**
     * Archiving is at the template level, not the version level, because that
     * is the thing the manager names and thinks about. The versions keep their
     * own status untouched, so restoring does not have to guess what each one
     * was, and the immutability trigger is never involved. Same shape as
     * `positions.archived_at`.
     */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("templates_position_idx").on(t.positionId)],
);

/**
 * The versioning boundary. Once `status` flips to PUBLISHED this row and
 * everything hanging off it must never change again: a candidate who took v1
 * keeps seeing v1 forever. Enforced by a trigger in 0001_immutability.sql, not
 * just by convention.
 */
export const templateVersions = pgTable(
  "template_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    status: versionStatus("status").notNull().default("DRAFT"),
    defaultLocale: locale("default_locale").notNull().default("tr"),
    /** Which languages this version is authored in. */
    localeSet: jsonb("locale_set").$type<Array<"tr" | "en">>().default(["tr"]),
    /** Candidate-facing intro copy shown before anything else. */
    introTitle: jsonb("intro_title").$type<I18nText>(),
    introBody: jsonb("intro_body").$type<I18nText>(),
    /** Which consent text version the candidate must accept. */
    consentTextId: uuid("consent_text_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: uuid("published_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("version_number_per_template").on(
      t.templateId,
      t.versionNumber,
    ),
    index("versions_template_idx").on(t.templateId),
  ],
);

export const stages = pgTable(
  "stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => templateVersions.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),

    /** Candidate-facing */
    name: jsonb("name").$type<I18nText>().notNull(),
    description: jsonb("description").$type<I18nText>(),

    /** Manager-only. Never selected by any candidate query. */
    internalPurpose: text("internal_purpose"),
    internalObjective: text("internal_objective"),

    /** Total budget for the stage, a ceiling over the per-activity timers. */
    durationSeconds: integer("duration_seconds").notNull(),
    graceSeconds: integer("grace_seconds").notNull().default(0),
    onTimeout: timeoutBehaviour("on_timeout").notNull().default("AUTO_SUBMIT"),
    /** Default is off: once a stage is done the candidate cannot go back. */
    backNavigation: boolean("back_navigation").notNull().default(false),
    allowedAttempts: integer("allowed_attempts").notNull().default(1),
  },
  (t) => [
    index("stages_version_idx").on(t.versionId),
    uniqueIndex("stage_order_per_version").on(t.versionId, t.orderIndex),
  ],
);

/**
 * The heart of the product: every activity carries two separate content groups.
 * `candidatePrompt` / `candidateNote` are shown to the candidate verbatim.
 * `internal*` is for the manager only and is stripped by candidateSafe() before
 * anything leaves the server on a candidate route.
 */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    type: activityType("type").notNull(),
    isRequired: boolean("is_required").notNull().default(true),

    /* ---- shown to the candidate ---- */
    candidatePrompt: jsonb("candidate_prompt").$type<I18nText>().notNull(),
    candidateNote: jsonb("candidate_note").$type<I18nText>(),

    /* ---- manager only, never rendered in a candidate link ---- */
    internalQuestion: text("internal_question"),
    internalObjective: text("internal_objective"),
    expectedBehaviours: jsonb("expected_behaviours").$type<string[]>().default(
      [],
    ),
    redFlags: jsonb("red_flags").$type<string[]>().default([]),
    managerNotes: text("manager_notes"),

    /* ---- timing, per the industry pattern: think time then answer time ---- */
    thinkSeconds: integer("think_seconds").notNull().default(0),
    answerSeconds: integer("answer_seconds"),
    maxTakes: integer("max_takes").notNull().default(1),

    config: jsonb("config").$type<ActivityConfig>().default({}),
  },
  (t) => [
    index("activities_stage_idx").on(t.stageId),
    uniqueIndex("activity_order_per_stage").on(t.stageId, t.orderIndex),
  ],
);

/** Which competencies this stage is meant to measure. */
export const stageCompetencies = pgTable(
  "stage_competencies",
  {
    stageId: uuid("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "cascade" }),
    competencyId: uuid("competency_id").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [
    uniqueIndex("stage_competency_pk").on(t.stageId, t.competencyId),
  ],
);
