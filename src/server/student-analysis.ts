import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assessments, attempts, itemResponses, sectionRuns } from "@/db/schema";
import { buildStudentAnalysis, type StudentAnalysis } from "@/lib/exam/student-analysis";
import { loadAcceptances } from "@/server/result-review";
import type { CandidateLocale } from "@/i18n/locale";

/**
 * Loads what the student analysis needs for one attempt and builds it. The
 * org is part of the query (the attempt must belong to an assessment of that
 * org), so a caller can never read another school's rows. Only the analysis
 * (counts and topic labels) leaves this module, never the items.
 */
export async function loadStudentAnalysis(
  orgId: string,
  attemptId: string,
  sections: string[],
  locale: CandidateLocale,
): Promise<StudentAnalysis | null> {
  const [own] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(and(eq(attempts.id, attemptId), eq(assessments.orgId, orgId)));
  if (!own) return null;
  const runs = await db.select().from(sectionRuns).where(eq(sectionRuns.attemptId, attemptId)).orderBy(asc(sectionRuns.orderIndex));
  const responses = runs.length
    ? await db
        .select()
        .from(itemResponses)
        .where(inArray(itemResponses.sectionRunId, runs.map((r) => r.id)))
        .orderBy(asc(itemResponses.sequence))
    : [];
  const acceptances = await loadAcceptances(orgId, responses.map((r) => r.id));
  return buildStudentAnalysis(
    {
      sections,
      runs: runs.map((r) => ({ id: r.id, section: r.section, navigable: r.navigable })),
      responses,
      acceptances,
    },
    locale,
  );
}
