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

/** `gapIds` lists the accepted gaps of a gap item; it is empty when a whole short answer was accepted. */
export type Acceptance = { originalScore: number | null; originalCorrect: boolean | null; gapIds: string[]; at: Date; by: string | null };

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
    const meta = r.meta ?? {};
    const gapId = typeof meta.gapId === "string" ? meta.gapId : null;
    const current = out[r.subjectId];
    if (r.action === UNDO_ACCEPT_ACTION) {
      // An undo with a gap id takes back that gap only; without one it takes back the whole acceptance.
      if (!current || !gapId) delete out[r.subjectId];
      else {
        current.gapIds = current.gapIds.filter((g) => g !== gapId);
        if (current.gapIds.length === 0) delete out[r.subjectId];
      }
      continue;
    }
    // The original score is the one before the first acceptance still standing.
    out[r.subjectId] = {
      originalScore: current ? current.originalScore : typeof meta.originalScore === "number" ? meta.originalScore : null,
      originalCorrect: current ? current.originalCorrect : typeof meta.originalCorrect === "boolean" ? meta.originalCorrect : null,
      gapIds: gapId ? [...new Set([...(current?.gapIds ?? []), gapId])] : (current?.gapIds ?? []),
      at: r.at,
      by: r.actorId,
    };
  }
  return out;
}
