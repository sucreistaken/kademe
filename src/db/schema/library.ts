import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  numeric,
} from "drizzle-orm/pg-core";
import { organizations } from "./org";
import { templateVersions } from "./catalog";
import { optionPolarity } from "./enums";
import type { I18nText } from "./types";

/**
 * Org-wide competency library, reused across positions. Ships pre-seeded with
 * eight competencies so a new manager never faces an empty library: that empty
 * state was the biggest abandonment risk in the whole product.
 */
export const competencies = pgTable(
  "competencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: jsonb("name").$type<I18nText>().notNull(),
    description: jsonb("description").$type<I18nText>(),
    scaleId: uuid("scale_id").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("competencies_org_idx").on(t.orgId)],
);

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
  },
  (t) => [index("scales_org_idx").on(t.orgId)],
);

/**
 * The behavioural anchor for one point on the scale. Research on structured
 * interviewing is clear that a bare 1-5 is weak; a written definition per level
 * is what lifts predictive validity. So this table is not optional decoration.
 */
export const scaleLevels = pgTable(
  "scale_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scaleId: uuid("scale_id")
      .notNull()
      .references(() => ratingScales.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
    /** Short label shown next to the stars, e.g. "beklentinin üstünde". */
    label: jsonb("label").$type<I18nText>().notNull(),
    /** The full anchor, shown when the manager expands "Beklenen davranış". */
    anchor: jsonb("anchor").$type<I18nText>(),
  },
  (t) => [uniqueIndex("scale_level_value").on(t.scaleId, t.value)],
);

/**
 * The clickable observation chips under each competency. Clicking beats typing:
 * this is what makes evaluation fast enough to do four stages in five minutes.
 */
export const evaluationOptions = pgTable(
  "evaluation_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "cascade" }),
    polarity: optionPolarity("polarity").notNull(),
    label: jsonb("label").$type<I18nText>().notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("options_competency_idx").on(t.competencyId)],
);

/**
 * Weights are snapshotted onto a published version. Changing weights later
 * creates a NEW set; scores already computed keep pointing at the old one, so a
 * candidate scored last month never silently changes.
 */
export const weightSets = pgTable(
  "weight_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => templateVersions.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("default"),
    /** Off by default. A plain average is enough for most managers. */
    isActive: integer("is_active").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("weight_sets_version_idx").on(t.versionId)],
);

export const weights = pgTable(
  "weights",
  {
    weightSetId: uuid("weight_set_id")
      .notNull()
      .references(() => weightSets.id, { onDelete: "cascade" }),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "cascade" }),
    /** Percentage. The UI enforces that a set sums to 100. */
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  },
  (t) => [uniqueIndex("weight_pk").on(t.weightSetId, t.competencyId)],
);
