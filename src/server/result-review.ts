import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/**
 * Teacher acceptances of typed objective answers ("Doğru kabul et"). The item
 * response keeps only its current score, so the original score lives in the
 * audit row written by the accept action, and an undo row cancels it. The
 * newest of the two decides.
 */

export const ACCEPT_ACTION = "response.accept_correct";
export const UNDO_ACCEPT_ACTION = "response.accept_undo";
export const RESPONSE_SUBJECT = "item_response";

export type Acceptance = { originalScore: number | null; originalCorrect: boolean | null; at: Date; by: string | null };

export async function loadAcceptances(orgId: string, responseIds: string[]): Promise<Record<string, Acceptance>> {
  if (responseIds.length === 0) return {};
  const rows = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.orgId, orgId),
        eq(auditLogs.subjectType, RESPONSE_SUBJECT),
        inArray(auditLogs.action, [ACCEPT_ACTION, UNDO_ACCEPT_ACTION]),
        inArray(auditLogs.subjectId, responseIds),
      ),
    )
    .orderBy(asc(auditLogs.at));
  const out: Record<string, Acceptance> = {};
  for (const r of rows) {
    if (!r.subjectId) continue;
    if (r.action === UNDO_ACCEPT_ACTION) {
      delete out[r.subjectId];
      continue;
    }
    const meta = r.meta ?? {};
    out[r.subjectId] = {
      originalScore: typeof meta.originalScore === "number" ? meta.originalScore : null,
      originalCorrect: typeof meta.originalCorrect === "boolean" ? meta.originalCorrect : null,
      at: r.at,
      by: r.actorId,
    };
  }
  return out;
}
