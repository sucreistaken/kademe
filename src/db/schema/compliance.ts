import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  numeric,
  index,
  check,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./org";
import { candidates, assessments } from "./assessment";
import { aiPurpose, locale, solution } from "./enums";
import type { I18nText } from "./types";

/**
 * Consent copy is versioned so that a year later we can prove exactly what the
 * student agreed to. Editing consent copy always creates a new row.
 */
export const consentTexts = pgTable("consent_texts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  /** Which solution's candidates read this text: the exam's and hiring's consent copy differ. */
  solution: solution("solution").notNull().default("LANGUAGE_EXAM"),
  version: integer("version").notNull(),
  body: jsonb("body").$type<I18nText>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    consentTextId: uuid("consent_text_id")
      .notNull()
      .references(() => consentTexts.id, { onDelete: "restrict" }),
    locale: locale("locale").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("consents_assessment_idx").on(t.assessmentId)],
);

/**
 * Traceability for every model call. Required reading if the AI Act scope ever
 * gets questioned, and useful for cost tracking either way.
 */
export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    purpose: aiPurpose("purpose").notNull(),
    model: text("model").notNull(),
    promptHash: text("prompt_hash"),
    inputRef: text("input_ref"),
    outputRef: text("output_ref"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    requestedBy: uuid("requested_by").references(() => users.id, {
      onDelete: "set null",
    }),
    error: text("error"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_runs_org_at_idx").on(t.orgId, t.at)],
);

/**
 * Mail abstraction. In the MVP nothing is actually sent: the row is written and
 * the manager copies the link out of the UI. Switching to a real provider later
 * means writing a different Mailer, not changing any caller.
 */
export const messageOutbox = pgTable(
  "message_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("outbox_org_idx").on(t.orgId)],
);

/** A candidate asking to see or delete their data. Lands in the manager queue. */
export const deletionRequests = pgTable(
  "deletion_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    message: text("message"),
    handledBy: uuid("handled_by").references(() => users.id, {
      onDelete: "set null",
    }),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("deletion_requests_candidate_idx").on(t.candidateId)],
);

/**
 * A candidate asking for something about their invitation that a person must
 * answer: an accommodation, or a new link. Core (any solution may write it),
 * and it carries org_id itself so the manager queue filters by organisation
 * without a join. `kind` is a CHECKed text, not a pg enum, so a solution can
 * add a kind with a reviewed constraint change instead of a type rebuild.
 * handled_by is RESTRICT: users are disabled, never deleted.
 */
export const candidateRequests = pgTable(
  "candidate_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    message: text("message"),
    handledBy: uuid("handled_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("candidate_requests_org_created_idx").on(t.orgId, t.createdAt),
    index("candidate_requests_assessment_idx").on(t.assessmentId),
    check("candidate_request_kind", sql`${t.kind} IN ('ACCOMMODATION', 'NEW_LINK')`),
  ],
);
