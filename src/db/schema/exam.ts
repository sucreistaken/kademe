import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { BlueprintConfig } from "@/lib/exam/blueprint";
import type { GradingProposal } from "@/lib/exam/grading";
import type { ComputedResult } from "@/lib/exam/result";
import type { ItemContent, ItemKey, ItemRubric } from "@/lib/exam/types";
import { assessments, attempts, itemResponses } from "./assessment";
import { aiRuns } from "./compliance";
import {
  blueprintStatus,
  cefrLevel,
  decider,
  examMode,
  gradingStatus,
  itemOrigin,
  itemStatus,
  itemType,
  resultStatus,
  section,
  verificationOutcome,
} from "./enums";
import { organizations, users } from "./org";

/**
 * An exam a school can send: which sections, how long, adaptive or fixed, who
 * sees what, how strict the proctoring is. Invites copy the config onto the
 * assessment, so editing a blueprint never touches a running exam.
 */
export const examBlueprints = pgTable(
  "exam_blueprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    mode: examMode("mode").notNull(),
    status: blueprintStatus("status").notNull().default("DRAFT"),
    config: jsonb("config").$type<BlueprintConfig>().notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /**
     * The ready template (src/lib/exam/templates) this exam was published from
     * by the invite form, unchanged. Null for every exam a manager built or
     * edited. At most one published exam per organisation and template.
     */
    templateKey: text("template_key"),
  },
  (t) => [
    index("blueprints_org_idx").on(t.orgId),
    uniqueIndex("blueprints_one_published_template").on(t.orgId, t.templateKey).where(sql`status = 'PUBLISHED' AND template_key IS NOT NULL`),
  ],
);

/**
 * The language exam's half of an invitation. The blueprint is copied here at
 * invite time, so the exam this student takes never changes under them. The
 * core `assessments` row knows nothing about this table.
 */
export const examAssessments = pgTable(
  "exam_assessments",
  {
    assessmentId: uuid("assessment_id")
      .primaryKey()
      .references(() => assessments.id, { onDelete: "cascade" }),
    blueprintId: uuid("blueprint_id")
      .notNull()
      .references(() => examBlueprints.id, { onDelete: "restrict" }),
    blueprintName: text("blueprint_name").notNull(),
    blueprintSnapshot: jsonb("blueprint_snapshot").$type<BlueprintConfig>().notNull(),
    mode: examMode("mode").notNull(),
    /** The level the student says they hold. Required for a verification exam. */
    claimedLevel: cefrLevel("claimed_level"),
  },
  (t) => [
    index("exam_assessments_blueprint_idx").on(t.blueprintId),
    check(
      "claimed_for_verification",
      sql`${t.mode} <> 'LEVEL_VERIFICATION' OR ${t.claimedLevel} IS NOT NULL`,
    ),
  ],
);

/** A reading passage or a listening clip that several items share. */
export const stimuli = pgTable(
  "stimuli",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    section: section("section").notNull(),
    level: cefrLevel("level").notNull(),
    title: text("title").notNull(),
    /** Reading: the passage. Listening: the script, which never reaches the student. */
    body: text("body").notNull(),
    topic: text("topic").notNull().default(""),
    speakers: jsonb("speakers").$type<Array<{ label: string; voice: "A" | "B" }>>(),
    audioKey: text("audio_key"),
    audioMime: text("audio_mime"),
    audioDurationMs: integer("audio_duration_ms"),
    /** Hash of script + voices the audio was made from, so a script edit is noticed. */
    audioSourceHash: text("audio_source_hash"),
    origin: itemOrigin("origin").notNull().default("TEACHER"),
    aiRunId: uuid("ai_run_id").references(() => aiRuns.id, { onDelete: "set null" }),
    /** Seed key, so re-seeding and the TTS script can find the row. */
    seedKey: text("seed_key"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stimuli_org_section_level_idx").on(t.orgId, t.section, t.level)],
);

/** One question in the bank. `content` is what a student may see; the rest is not. */
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    section: section("section").notNull(),
    level: cefrLevel("level").notNull(),
    /** Rasch difficulty in logits, set from the level band until real data calibrates it. */
    difficulty: real("difficulty").notNull(),
    type: itemType("type").notNull(),
    skillTag: text("skill_tag").notNull(),
    stimulusId: uuid("stimulus_id").references(() => stimuli.id, { onDelete: "restrict" }),
    orderInStimulus: integer("order_in_stimulus").notNull().default(0),
    prompt: text("prompt").notNull(),
    content: jsonb("content").$type<ItemContent>().notNull(),
    answerKey: jsonb("answer_key").$type<ItemKey>().notNull(),
    rubric: jsonb("rubric").$type<ItemRubric>(),
    explanation: text("explanation"),
    points: integer("points").notNull().default(1),
    status: itemStatus("status").notNull().default("DRAFT"),
    origin: itemOrigin("origin").notNull().default("TEACHER"),
    aiRunId: uuid("ai_run_id").references(() => aiRuns.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    exposureCount: integer("exposure_count").notNull().default(0),
    /** Seed key (see seed-bank/seed-key.ts), so the bank top-up knows which starter items an org has. */
    seedKey: text("seed_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("items_pool_idx").on(t.orgId, t.section, t.level, t.status),
    index("items_stimulus_idx").on(t.stimulusId),
    uniqueIndex("items_seed_key_per_org").on(t.orgId, t.seedKey),
  ],
);

/**
 * A grader's view of one writing or speaking answer: the AI proposal as it
 * came back, and the teacher's decision next to it. Both stay, so the report
 * can say "AI proposed B1, confirmed by X" or "changed to A2 by X because ...".
 */
export const responseGradings = pgTable(
  "response_gradings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemResponseId: uuid("item_response_id")
      .notNull()
      .references(() => itemResponses.id, { onDelete: "cascade" })
      .unique(),
    status: gradingStatus("status").notNull().default("PENDING"),
    /** Level the task was written for. An answer can show at most one level above. */
    taskLevel: cefrLevel("task_level").notNull(),
    aiProposal: jsonb("ai_proposal").$type<GradingProposal>(),
    aiLevel: cefrLevel("ai_level"),
    aiRunId: uuid("ai_run_id").references(() => aiRuns.id, { onDelete: "set null" }),
    aiModel: text("ai_model"),
    aiError: text("ai_error"),
    proposedAt: timestamp("proposed_at", { withTimezone: true }),
    finalLevel: cefrLevel("final_level"),
    /** Per-criterion teacher levels, when the teacher changed them individually. */
    finalCriteria: jsonb("final_criteria").$type<Record<string, string>>(),
    decider: decider("decider"),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    reason: text("reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gradings_status_idx").on(t.status)],
);

export const responseGradingRevisions = pgTable(
  "response_grading_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gradingId: uuid("grading_id")
      .notNull()
      .references(() => responseGradings.id, { onDelete: "cascade" }),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>().notNull(),
    reason: text("reason").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("grading_revisions_idx").on(t.gradingId, t.at)],
);

export type FinalSkill = {
  level: string;
  decider: "ENGINE" | "AI" | "TEACHER";
  userId: string | null;
  reason: string | null;
  at: string;
};

/** One result per attempt, recomputed whenever evidence or a decision changes. */
export const examResults = pgTable("exam_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => attempts.id, { onDelete: "cascade" })
    .unique(),
  status: resultStatus("status").notNull().default("IN_PROGRESS"),
  /** What the engine and graders say right now. Recomputed, never edited. */
  computed: jsonb("computed").$type<ComputedResult>(),
  /** Teacher overrides of skill levels; the reason is required. */
  skillOverrides: jsonb("skill_overrides").$type<Record<string, FinalSkill>>().notNull().default({}),
  overallOverride: cefrLevel("overall_override"),
  overallOverrideReason: text("overall_override_reason"),
  finalOverall: cefrLevel("final_overall"),
  finalSkills: jsonb("final_skills").$type<Record<string, FinalSkill>>(),
  finalOutcome: verificationOutcome("final_outcome"),
  finalizedBy: uuid("finalized_by").references(() => users.id, { onDelete: "set null" }),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  releasedBy: uuid("released_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const examResultRevisions = pgTable(
  "exam_result_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => examResults.id, { onDelete: "cascade" }),
    /** "overall", "skill:WRITING", "finalize", "release", "reopen". */
    field: text("field").notNull(),
    before: jsonb("before").$type<unknown>(),
    after: jsonb("after").$type<unknown>(),
    reason: text("reason"),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("result_revisions_idx").on(t.resultId, t.at)],
);

