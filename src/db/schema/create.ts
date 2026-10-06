import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { CREATION_KINDS, CREATION_STATUSES, creationKind, creationStatus } from "./enums";
import { organizations, users } from "./org";
import type { I18nText } from "./types";

/**
 * One sentence typed into the Advanced box and everything that came of it
 * (spec 2026-10-06-advanced-ai-create-design 5.3). A row belongs to the user
 * who typed it; nobody else reads it. It survives a refresh and a second tab,
 * feeds "Recent drafts" and is the audit trail of what the router decided.
 * Rows that never reached APPLIED are deleted after 30 days by the retention cron.
 */
export type CreationKind = (typeof CREATION_KINDS)[number];
export type CreationStatus = (typeof CREATION_STATUSES)[number];
export type CreationQuestion = { id: string; text: string; choices: string[] };
/** One question round and its answers; a revision is a round with no questions and a `change`. */
export type CreationRound = { questions: CreationQuestion[]; answers: Record<string, string>; change?: string };
/** What `apply` produced: where to go, what to say, and the follow-up drafts it offers. */
export type CreationOutcome = {
  href: string;
  /** True: the screen goes to `href` right away. False: it shows the links, notes and follow-ups. */
  go: boolean;
  links: Array<{ label: I18nText; href: string }>;
  notes: I18nText[];
  followUps: Array<{ label: I18nText; kind: CreationKind; params: unknown }>;
};
export type CreationFailure = "AI_UNAVAILABLE" | "FAILED" | "UNSUPPORTED" | "STUCK" | "RATE_LIMITED";

export const CREATION_REQUEST_MAX = 4000;

export const creationDrafts = pgTable(
  "creation_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    request: text("request").notNull(),
    rounds: jsonb("rounds").$type<CreationRound[]>().notNull().default([]),
    kind: creationKind("kind"),
    /** The router's one-line summary in the user's language. */
    summary: text("summary"),
    params: jsonb("params").$type<unknown>(),
    draft: jsonb("draft").$type<unknown>(),
    status: creationStatus("status").notNull().default("ASKING"),
    failure: text("failure").$type<CreationFailure>(),
    result: jsonb("result").$type<CreationOutcome>(),
    resultHref: text("result_href"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("creation_drafts_owner_idx").on(t.orgId, t.userId, t.createdAt),
    index("creation_drafts_created_idx").on(t.createdAt),
    check("creation_request_length", sql`char_length(${t.request}) <= 4000`),
  ],
);
