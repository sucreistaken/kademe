import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./org";
import { observationPolarity } from "./enums";
import type { I18nText } from "./types";

/**
 * The organisation's library (hiring solution design 1). Positions,
 * competencies and rating scales belong to the organisation, not to a
 * solution: hiring reads them today, position analysis and performance reviews
 * will read them later. Nothing here knows a solution table. A solution copies
 * what it needs when it publishes, so editing the library never changes a
 * published assessment.
 *
 * Nothing is deleted: rows are archived and stay readable.
 */
export const ratingScales = pgTable(
  "rating_scales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    minValue: integer("min_value").notNull().default(1),
    maxValue: integer("max_value").notNull().default(5),
    /** One default per organisation; new competencies use it. */
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rating_scales_org_idx").on(t.orgId),
    uniqueIndex("one_default_scale_per_org").on(t.orgId).where(sql`is_default`),
    check("rating_scale_range", sql`${t.minValue} < ${t.maxValue}`),
  ],
);

/** The general name of each level (HIRING-UX 3.3); competency anchors fill it in. */
export const scaleLevels = pgTable(
  "scale_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scaleId: uuid("scale_id")
      .notNull()
      .references(() => ratingScales.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
    label: jsonb("label").$type<I18nText>().notNull(),
  },
  (t) => [uniqueIndex("scale_level_value").on(t.scaleId, t.value)],
);

export const competencies = pgTable(
  "competencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: jsonb("name").$type<I18nText>().notNull(),
    /** For the team; never shown to a candidate. */
    description: jsonb("description").$type<I18nText>().notNull().default({ tr: "", en: "" }),
    scaleId: uuid("scale_id")
      .notNull()
      .references(() => ratingScales.id, { onDelete: "restrict" }),
    /** Set on Kademe starter content only; makes seeding idempotent. */
    seedKey: text("seed_key"),
    /**
     * When the team confirmed the definition. Null on starter content until
     * someone ticks "İncelendi" (HIRING-UX 5.10); set at creation otherwise.
     */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("competencies_org_idx").on(t.orgId),
    uniqueIndex("competency_seed_key_per_org").on(t.orgId, t.seedKey),
  ],
);

/**
 * The competency's own behavioural anchor for one level. Levels 1, 3 and 5 are
 * required before anything that measures the competency can be published; 2
 * and 4 are optional (HIRING-UX 3.3).
 */
export const competencyAnchors = pgTable(
  "competency_anchors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
    body: jsonb("body").$type<I18nText>().notNull(),
  },
  (t) => [uniqueIndex("competency_anchor_value").on(t.competencyId, t.value)],
);

/**
 * Clickable evidence chips under a competency. Ids are stable: a removed tag is
 * archived, never deleted, because published scorecards copy tag ids.
 */
export const observationTags = pgTable(
  "observation_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "cascade" }),
    polarity: observationPolarity("polarity").notNull(),
    label: jsonb("label").$type<I18nText>().notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("observation_tags_competency_idx").on(t.competencyId)],
);

/** A role's lasting definition (HIRING-UX 4.2). An opening is a hiring process for it. */
export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    team: text("team"),
    shortDescription: text("short_description"),
    /** The job ad. The AI draft reads it. */
    jobDescription: text("job_description"),
    skills: jsonb("skills").$type<string[]>().notNull().default([]),
    languages: jsonb("languages").$type<string[]>().notNull().default([]),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("positions_org_idx").on(t.orgId)],
);

/**
 * The position's competency profile: which competencies the role needs, how
 * much each matters (0-100, any sum; an opening scales them to 100) and,
 * optionally, the level expected.
 */
export const positionCompetencies = pgTable(
  "position_competencies",
  {
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "restrict" }),
    weight: integer("weight").notNull().default(50),
    expectedLevel: integer("expected_level"),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.positionId, t.competencyId] }),
    index("position_competencies_competency_idx").on(t.competencyId),
    check("position_competency_weight", sql`${t.weight} BETWEEN 0 AND 100`),
    check(
      "position_competency_expected_level",
      sql`${t.expectedLevel} IS NULL OR ${t.expectedLevel} BETWEEN 1 AND 5`,
    ),
  ],
);
