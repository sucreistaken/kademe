import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { assessments, attempts, candidates, itemResponses, items, sectionRuns } from "@/db/schema";
import type { Avoid } from "@/lib/exam/blueprint";

/**
 * Everything the same student was served in their other exams: the items of
 * every item_responses row under the organisation's candidates with this
 * email (any case), in any assessment but `excludeAssessmentId`, and the
 * stimuli of those items. A new form draws around it (blueprint.ts: Avoid),
 * so a returning student does not meet the same questions again.
 *
 * One query; the candidate lookup uses candidates_org_email_lower_idx. No
 * email means no way to recognise the student: empty sets, today's draw.
 */
export async function seenBy(
  orgId: string,
  email: string | null | undefined,
  excludeAssessmentId: string,
): Promise<Avoid> {
  const avoid: Avoid = { itemIds: new Set(), stimulusIds: new Set() };
  if (!email?.trim()) return avoid;
  const rows = await db
    .selectDistinct({ itemId: itemResponses.itemId, stimulusId: items.stimulusId })
    .from(candidates)
    .innerJoin(assessments, eq(assessments.candidateId, candidates.id))
    .innerJoin(attempts, eq(attempts.assessmentId, assessments.id))
    .innerJoin(sectionRuns, eq(sectionRuns.attemptId, attempts.id))
    .innerJoin(itemResponses, eq(itemResponses.sectionRunId, sectionRuns.id))
    .innerJoin(items, eq(items.id, itemResponses.itemId))
    .where(
      and(
        eq(candidates.orgId, orgId),
        sql`lower(${candidates.email}) = lower(${email})`,
        eq(assessments.orgId, orgId),
        ne(assessments.id, excludeAssessmentId),
      ),
    );
  for (const r of rows) {
    avoid.itemIds.add(r.itemId);
    if (r.stimulusId) avoid.stimulusIds.add(r.stimulusId);
  }
  return avoid;
}
