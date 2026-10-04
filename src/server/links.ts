import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { assessmentLinks, assessments, candidates } from "@/db/schema";

/** Links nobody opened that lapse within 48 hours. Core: any solution's invitations. */
export async function expiringLinks(orgId: string) {
  const soon = new Date(Date.now() + 48 * 3600_000);
  return db
    .select({ link: assessmentLinks, name: candidates.fullName, assessmentId: assessments.id })
    .from(assessmentLinks)
    .innerJoin(assessments, eq(assessments.id, assessmentLinks.assessmentId))
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .where(
      and(
        eq(assessments.orgId, orgId),
        eq(assessmentLinks.status, "NOT_STARTED"),
        lt(assessmentLinks.expiresAt, soon),
        gt(assessmentLinks.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(assessmentLinks.expiresAt));
}
