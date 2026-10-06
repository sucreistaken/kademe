import { and, count, desc, eq, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, CREATION_REQUEST_MAX, creationDrafts } from "@/db/schema";
import { isUuid } from "@/server/settings";

/**
 * The Advanced box's drafts (spec 2026-10-06-advanced-ai-create-design 5.3).
 * Every read is scoped by organisation and user: a draft is only ever its
 * author's. Writes are scoped by organisation.
 */

export type CreationDraftRow = typeof creationDrafts.$inferSelect;
export type DraftPatch = Partial<
  Pick<CreationDraftRow, "rounds" | "kind" | "summary" | "params" | "draft" | "status" | "failure" | "result" | "resultHref">
>;
export type CreateAuditAction = "create.route" | "create.draft" | "create.apply" | "create.discard";

export const STALE_DRAFT_DAYS = 30;
export const RECENT_DRAFTS = 5;

export async function insertDraft(input: { orgId: string; userId: string; request: string }): Promise<CreationDraftRow> {
  const [row] = await db
    .insert(creationDrafts)
    .values({ orgId: input.orgId, userId: input.userId, request: input.request.slice(0, CREATION_REQUEST_MAX) })
    .returning();
  return row;
}

export async function loadOwnDraft(orgId: string, userId: string, id: string): Promise<CreationDraftRow | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(creationDrafts)
    .where(and(eq(creationDrafts.id, id), eq(creationDrafts.orgId, orgId), eq(creationDrafts.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function updateDraft(orgId: string, id: string, patch: DraftPatch): Promise<void> {
  await db
    .update(creationDrafts)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(creationDrafts.id, id), eq(creationDrafts.orgId, orgId)));
}

export async function recentDrafts(orgId: string, userId: string, limit: number = RECENT_DRAFTS): Promise<CreationDraftRow[]> {
  return db
    .select()
    .from(creationDrafts)
    .where(and(eq(creationDrafts.orgId, orgId), eq(creationDrafts.userId, userId)))
    .orderBy(desc(creationDrafts.createdAt))
    .limit(limit);
}

export async function auditDraft(
  orgId: string,
  actorId: string,
  action: CreateAuditAction,
  draftId: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLogs).values({ orgId, actorId, action, subjectType: "creation_draft", subjectId: draftId, meta: meta ?? null });
}

export function staleDraftCutoff(now: Date): Date {
  return new Date(now.getTime() - STALE_DRAFT_DAYS * 24 * 60 * 60_000);
}

/**
 * Drafts older than 30 days that never reached APPLIED. Report mode counts;
 * only `apply` deletes (the retention cron's two switches decide that).
 */
export async function purgeStaleDrafts(options: { now: Date; apply: boolean }): Promise<{ total: number; deleted: number }> {
  const stale = and(ne(creationDrafts.status, "APPLIED"), lt(creationDrafts.createdAt, staleDraftCutoff(options.now)));
  const [row] = await db.select({ n: count() }).from(creationDrafts).where(stale);
  const total = row?.n ?? 0;
  if (!options.apply || total === 0) return { total, deleted: 0 };
  const gone = await db.delete(creationDrafts).where(stale).returning({ id: creationDrafts.id });
  return { total, deleted: gone.length };
}
