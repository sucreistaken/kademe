import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { userRole } from "./enums";

/**
 * Single tenant for now: exactly one row is expected here. The column is carried
 * on every other table anyway so that turning this into a SaaS later is a
 * migration rather than a rewrite.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Retention policy, in days. Nightly job reads these. */
  mediaRetentionDays: integer("media_retention_days").notNull().default(180),
  candidateRetentionDays: integer("candidate_retention_days")
    .notNull()
    .default(730),
  /** Proctoring frames and clips. Shorter than answers: they are evidence, not work. */
  evidenceRetentionDays: integer("evidence_retention_days").notNull().default(90),
  /** Shown to students on the finish screen as the next step. */
  contactEmail: text("contact_email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("TEACHER"),
    /** TOTP secret, encrypted at rest. Mandatory for OWNER. */
    totpSecret: text("totp_secret"),
    totpConfirmedAt: timestamp("totp_confirmed_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("users_org_idx").on(t.orgId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** sha256 of the cookie value. The raw token never touches the database. */
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/**
 * Written for anything that touches candidate data: watching a video, exporting,
 * deleting, changing a decision, minting a link.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ip: text("ip"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_org_at_idx").on(t.orgId, t.at),
    index("audit_subject_idx").on(t.subjectType, t.subjectId),
  ],
);

/**
 * A one-time link that lets an invited person set their own password.
 *
 * The owner never types a password for somebody else, exactly like the
 * candidate side: `tokenHash` is sha256 of a 32 byte random value and the raw
 * token exists only in the URL the owner copies once. A row is spent by
 * stamping `usedAt` rather than by being deleted, so "when did this account
 * actually open" stays answerable months later.
 */
export const userSetupTokens = pgTable(
  "user_setup_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** sha256 of the link value. The raw token never touches the database. */
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    /** The owner who invited. Kept as null if that account is ever removed. */
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("user_setup_tokens_user_idx").on(t.userId),
    index("user_setup_tokens_org_idx").on(t.orgId),
  ],
);
