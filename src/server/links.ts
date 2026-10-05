import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { assessmentLinks, assessments, candidates } from "@/db/schema";

/**
 * Links nobody opened that lapse within 48 hours, for Today's "48 saat içinde
 * dolacak linkler" with the exam's "7 gün uzat". Exam invitations only (ruling
 * C5): a hiring invitation carries a candidate's name that every user of the
 * organisation would see here, blind mode and opening membership aside, and
 * the exam's extend is not the hiring one. Hiring rows on Today come with
 * plan 3.
 */
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
        eq(assessments.solution, "LANGUAGE_EXAM"),
        eq(assessmentLinks.status, "NOT_STARTED"),
        lt(assessmentLinks.expiresAt, soon),
        gt(assessmentLinks.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(assessmentLinks.expiresAt));
}
