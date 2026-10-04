import { and, asc, count, desc, eq, gt, gte, isNull, lt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { auditLogs, organizations, userSetupTokens, users } from "@/db/schema";
import { hashPassword, mintToken, sha256, type SessionUser } from "@/lib/auth";
import { ORG_TIMEZONE, zonedDayStart } from "@/lib/org-timezone";

/**
 * Reads for /settings and /settings/audit. Kept out of the pages for the same
 * reason as `@/lib/manager-data`: the screens stay layout, and a query that has
 * to be safe (a uuid coming from a query string, an org scope that must never
 * be optional) is written once here.
 */

export const RETENTION_MIN_DAYS = 1;
export const RETENTION_MAX_DAYS = 3650;

export const AUDIT_PAGE_SIZE = 50;

/** Roles in the order they are listed on screen, not alphabetical. */
export const ROLE_ORDER = ["OWNER", "MANAGER", "REVIEWER"] as const;
export type Role = (typeof ROLE_ORDER)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLE_ORDER as readonly string[]).includes(value);
}

/**
 * A uuid coming from a query string reaches Postgres as `uuid = $1` and an
 * invalid string is a 22P02 error, not an empty result. Every id filter goes
 * through here first.
 */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export type OrgSettings = {
  id: string;
  name: string;
  mediaRetentionDays: number;
  candidateRetentionDays: number;
};

export async function loadOrg(orgId: string): Promise<OrgSettings | null> {
  const [row] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      mediaRetentionDays: organizations.mediaRetentionDays,
      candidateRetentionDays: organizations.candidateRetentionDays,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return row ?? null;
}

export type PanelUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastLoginAt: Date | null;
  disabledAt: Date | null;
};

export async function loadPanelUsers(orgId: string): Promise<PanelUser[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      lastLoginAt: users.lastLoginAt,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .where(eq(users.orgId, orgId))
    .orderBy(asc(users.disabledAt), asc(users.name));

  // Disabled accounts sink to the bottom, then owners first. Sorting in JS
  // keeps the role order the screen uses rather than the enum's own order.
  return rows.sort((a, b) => {
    const disabled = Number(Boolean(a.disabledAt)) - Number(Boolean(b.disabledAt));
    if (disabled !== 0) return disabled;
    const rank = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
    if (rank !== 0) return rank;
    return a.name.localeCompare(b.name, "tr");
  });
}

/**
 * How many owners could still open this screen tomorrow. A disabled owner does
 * not count: the session resolver refuses them, so an org whose only owner is
 * disabled has nobody left who can change a setting.
 */
export async function countActiveOwners(orgId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(
      and(
        eq(users.orgId, orgId),
        eq(users.role, "OWNER"),
        isNull(users.disabledAt),
      ),
    );
  return row?.n ?? 0;
}

/** The one row the settings actions are allowed to touch, or null. */
export async function findPanelUser(
  orgId: string,
  userId: string,
): Promise<PanelUser | null> {
  if (!isUuid(userId)) return null;
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      lastLoginAt: users.lastLoginAt,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

/* ---------------------------- audit log ---------------------------- */

export type AuditFilters = {
  /** A user id, the literal "system" for rows with no actor, or "". */
  actor: string;
  action: string;
  subject: string;
  /** ISO dates as an <input type="date"> writes them, or "". */
  from: string;
  to: string;
};

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  actor: "",
  action: "",
  subject: "",
  from: "",
  to: "",
};

export type AuditRow = {
  id: string;
  at: Date;
  action: string;
  subjectType: string;
  subjectId: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  actorId: string | null;
  actorName: string | null;
};

export type AuditPage = {
  rows: AuditRow[];
  total: number;
  page: number;
  pageCount: number;
};

/**
 * The operator picks "8 September" meaning their own day. That day is counted
 * in the organisation's zone (lib/org-timezone.ts), not the process zone: the
 * server runs in UTC in production and this used to shift every export by the
 * three hour difference.
 */
function dayStart(value: string): Date | null {
  return zonedDayStart(value, ORG_TIMEZONE);
}

function nextDayStart(value: string): Date | null {
  return zonedDayStart(value, ORG_TIMEZONE, 1);
}

function auditWhere(orgId: string, filters: AuditFilters) {
  const clauses = [eq(auditLogs.orgId, orgId)];

  if (filters.actor === "system") clauses.push(isNull(auditLogs.actorId));
  else if (isUuid(filters.actor)) clauses.push(eq(auditLogs.actorId, filters.actor));

  if (filters.action) clauses.push(eq(auditLogs.action, filters.action));
  if (isUuid(filters.subject)) clauses.push(eq(auditLogs.subjectId, filters.subject));

  const from = dayStart(filters.from);
  if (from) clauses.push(gte(auditLogs.at, from));
  // Inclusive end date: "to 8 September" has to contain 8 September.
  const to = nextDayStart(filters.to);
  if (to) clauses.push(lt(auditLogs.at, to));

  return and(...clauses);
}

export async function loadAuditPage(
  orgId: string,
  filters: AuditFilters,
  page: number,
): Promise<AuditPage> {
  const where = auditWhere(orgId, filters);

  const [totals] = await db
    .select({ n: count() })
    .from(auditLogs)
    .where(where);
  const total = totals?.n ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const current = Math.min(Math.max(page, 1), pageCount);

  const rows = await db
    .select({
      id: auditLogs.id,
      at: auditLogs.at,
      action: auditLogs.action,
      subjectType: auditLogs.subjectType,
      subjectId: auditLogs.subjectId,
      meta: auditLogs.meta,
      ip: auditLogs.ip,
      actorId: auditLogs.actorId,
      actorName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(where)
    // id as the tiebreaker: two rows written in the same millisecond would
    // otherwise be free to swap places between two pages of the same listing.
    .orderBy(desc(auditLogs.at), desc(auditLogs.id))
    .limit(AUDIT_PAGE_SIZE)
    .offset((current - 1) * AUDIT_PAGE_SIZE);

  return { rows, total, page: current, pageCount };
}

/**
 * The most rows one export may carry.
 *
 * A cap rather than a stream of everything, because the response is built in
 * one query and an org with a million rows would take the process down with it.
 * When it bites, the export says so instead of quietly handing over a prefix.
 */
export const AUDIT_EXPORT_LIMIT = 10_000;

export type AuditExport = {
  rows: AuditRow[];
  /** Rows the filter matches, before the cap. The number the screen shows. */
  total: number;
  truncated: boolean;
};

/**
 * The same rows as `loadAuditPage`, unpaginated and capped.
 *
 * It shares `auditWhere` and the ordering with the screen on purpose: a second
 * query written for the export is a second definition of "these filters", and
 * the two drift the first time somebody changes one of them.
 */
export async function loadAuditExport(
  orgId: string,
  filters: AuditFilters,
  limit: number = AUDIT_EXPORT_LIMIT,
): Promise<AuditExport> {
  const where = auditWhere(orgId, filters);

  const [totals] = await db.select({ n: count() }).from(auditLogs).where(where);
  const total = totals?.n ?? 0;

  const rows = await db
    .select({
      id: auditLogs.id,
      at: auditLogs.at,
      action: auditLogs.action,
      subjectType: auditLogs.subjectType,
      subjectId: auditLogs.subjectId,
      meta: auditLogs.meta,
      ip: auditLogs.ip,
      actorId: auditLogs.actorId,
      actorName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(where)
    .orderBy(desc(auditLogs.at), desc(auditLogs.id))
    .limit(limit);

  return { rows, total, truncated: total > rows.length };
}

/** How many rows the org has in total, ignoring every filter. */
export async function countAuditRows(orgId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId));
  return row?.n ?? 0;
}

/**
 * The action filter offers what this org has actually done, not the list of
 * codes the source happens to contain. A dropdown full of options that return
 * nothing is a dead end with extra steps.
 */
export async function loadAuditActions(orgId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ action: auditLogs.action })
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId));
  return rows.map((row) => row.action);
}

/** True when at least one row was written by nobody (a job, or a deleted user). */
export async function hasSystemAuditRows(orgId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(auditLogs)
    .where(and(eq(auditLogs.orgId, orgId), isNull(auditLogs.actorId)))
    .limit(1);
  return (row?.n ?? 0) > 0;
}

/**
 * Writes an audit row for something that happened on the settings screen. The
 * screen that reads the log also has to feed it, or a role change becomes the
 * one privileged act with no trace.
 */
export async function writeSettingsAudit(
  user: Pick<SessionUser, "id" | "orgId">,
  action: string,
  subjectType: "organization" | "user",
  subjectId: string,
  meta: Record<string, unknown> = {},
) {
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action,
    subjectType,
    subjectId,
    meta,
  });
}

/** Renders a jsonb meta blob as one short line. Never a wall of JSON. */
export function summarizeMeta(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(meta)) {
    if (value === null || value === undefined || value === "") continue;
    const text =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    parts.push(`${key}: ${text.length > 40 ? `${text.slice(0, 40)}…` : text}`);
    if (parts.length === 3) break;
  }
  return parts.join(" · ");
}

/* ------------------------- panel invitations ------------------------- */

/**
 * A setup link is a credential, so it is short lived. A week covers somebody
 * starting on a Monday after the offer went out on a Friday.
 */
export const SETUP_TOKEN_TTL_DAYS = 7;

/** Long enough to matter, short enough that nobody writes it on a note. */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * The password hash an invited account carries until its owner sets a real one.
 *
 * It is a genuine argon2 digest of a random value that is thrown away rather
 * than a sentinel string, and both halves of that matter. Nobody knows the
 * plaintext, so it can never be matched. And it still parses, so the login
 * screen keeps answering "wrong email or password" instead of throwing on a
 * digest it cannot decode, which would both crash the request and tell an
 * attacker that this particular address exists and is waiting for setup.
 */
export function unusablePasswordHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString("base64url"));
}

/** Users whose setup link is still open: invited, not yet arrived. */
export async function loadPendingSetupUserIds(orgId: string): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ userId: userSetupTokens.userId })
    .from(userSetupTokens)
    .where(
      and(
        eq(userSetupTokens.orgId, orgId),
        isNull(userSetupTokens.usedAt),
        gt(userSetupTokens.expiresAt, new Date()),
      ),
    );
  return new Set(rows.map((row) => row.userId));
}

/** True when this account has never been opened and still has a live link. */
export async function hasPendingSetup(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userSetupTokens.id })
    .from(userSetupTokens)
    .where(
      and(
        eq(userSetupTokens.userId, userId),
        isNull(userSetupTokens.usedAt),
        gt(userSetupTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export type PanelUserAccount = PanelUser & { orgId: string };

/** Looks an address up across the whole table, because the column is unique. */
export async function findUserByEmail(email: string): Promise<PanelUserAccount | null> {
  const [row] = await db
    .select({
      id: users.id,
      orgId: users.orgId,
      name: users.name,
      email: users.email,
      role: users.role,
      lastLoginAt: users.lastLoginAt,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row ?? null;
}

/**
 * Mints the one-time link. Any earlier link for the same person is pushed to
 * its expiry first, so re-inviting somebody who lost theirs leaves exactly one
 * usable link, the newest. Expiring rather than deleting keeps the history.
 *
 * Only the sha256 is written. The raw value is returned once and is never
 * stored, logged or put in an audit meta.
 */
export async function createSetupToken(
  orgId: string,
  userId: string,
  createdBy: string,
): Promise<{ token: string; expiresAt: Date }> {
  const now = new Date();
  await db
    .update(userSetupTokens)
    .set({ expiresAt: now })
    .where(
      and(
        eq(userSetupTokens.userId, userId),
        isNull(userSetupTokens.usedAt),
        gt(userSetupTokens.expiresAt, now),
      ),
    );

  const minted = mintToken();
  const expiresAt = new Date(
    now.getTime() + SETUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  await db.insert(userSetupTokens).values({
    orgId,
    userId,
    tokenHash: minted.hash,
    expiresAt,
    createdBy,
  });
  return { token: minted.raw, expiresAt };
}

export type SetupTarget = {
  tokenId: string;
  userId: string;
  orgId: string;
  name: string;
  email: string;
};

/**
 * Resolves a raw setup token to the person it belongs to, or null.
 *
 * Expired, already used, unknown and belonging-to-a-disabled-account all
 * collapse into the same null on purpose. The screen must not tell a stranger
 * which of the four they are holding.
 */
export async function resolveSetupToken(
  rawToken: string,
): Promise<SetupTarget | null> {
  if (!rawToken) return null;
  const [row] = await db
    .select({
      tokenId: userSetupTokens.id,
      userId: users.id,
      orgId: users.orgId,
      name: users.name,
      email: users.email,
      disabledAt: users.disabledAt,
    })
    .from(userSetupTokens)
    .innerJoin(users, eq(users.id, userSetupTokens.userId))
    .where(
      and(
        eq(userSetupTokens.tokenHash, sha256(rawToken)),
        isNull(userSetupTokens.usedAt),
        gt(userSetupTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row || row.disabledAt) return null;
  return {
    tokenId: row.tokenId,
    userId: row.userId,
    orgId: row.orgId,
    name: row.name,
    email: row.email,
  };
}

/**
 * Spends the token. The `usedAt is null` clause is the whole point: two tabs
 * submitting the same link race here, and exactly one of them gets a row back.
 */
export async function consumeSetupToken(tokenId: string): Promise<boolean> {
  const rows = await db
    .update(userSetupTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(userSetupTokens.id, tokenId), isNull(userSetupTokens.usedAt)))
    .returning({ id: userSetupTokens.id });
  return rows.length > 0;
}
