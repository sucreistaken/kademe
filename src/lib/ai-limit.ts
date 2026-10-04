import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { aiRuns } from "@/db/schema";
import type { AiPurpose } from "@/lib/ai-runs";

/**
 * A cap on paid model calls, counted from ai_runs (index ai_runs_org_at_idx):
 * one person may ask for a purpose at most 10 times in 10 minutes, and an
 * organisation at most 200 times in 24 hours for that purpose. The org cap is
 * per purpose on purpose: the exam side grades every submission through the
 * same table, and a busy exam day must not lock the hiring library out.
 * Every row counts, a logged retry included, because each one was a request.
 */
export const AI_USER_LIMIT = { max: 10, windowMs: 10 * 60_000 };
export const AI_ORG_LIMIT = { max: 200, windowMs: 24 * 60 * 60_000 };

export function overAiLimit(counts: { user: number; org: number }): boolean {
  return counts.user >= AI_USER_LIMIT.max || counts.org >= AI_ORG_LIMIT.max;
}

export async function aiLimitReached(orgId: string, userId: string, purpose: AiPurpose, now: Date = new Date()): Promise<boolean> {
  const since = (windowMs: number) => new Date(now.getTime() - windowMs);
  const recent = (windowMs: number) => [eq(aiRuns.orgId, orgId), gt(aiRuns.at, since(windowMs)), eq(aiRuns.purpose, purpose)];
  const [[user], [org]] = await Promise.all([
    db.select({ n: count() }).from(aiRuns).where(and(...recent(AI_USER_LIMIT.windowMs), eq(aiRuns.requestedBy, userId))),
    db.select({ n: count() }).from(aiRuns).where(and(...recent(AI_ORG_LIMIT.windowMs))),
  ]);
  return overAiLimit({ user: user?.n ?? 0, org: org?.n ?? 0 });
}
