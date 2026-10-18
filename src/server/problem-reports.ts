import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { assessments, candidateRequests, candidates } from "@/db/schema";

/**
 * Problem reports (candidate_requests of kind PROBLEM, filed by the exam's
 * problem route), read for the teacher's panel. Always scoped by the caller's
 * organisation. Newest first. A soft-deleted student (candidates.deleted_at) is
 * left out, as in the other panel queries.
 */
export type ProblemReport = { id: string; assessmentId: string; createdAt: Date; message: string | null };

/** Every report of one student (all of their invitations), for the student page. */
export async function listProblemReports(orgId: string, candidateId: string): Promise<ProblemReport[]> {
  return db
    .select({ id: candidateRequests.id, assessmentId: candidateRequests.assessmentId, createdAt: candidateRequests.createdAt, message: candidateRequests.message })
    .from(candidateRequests)
    .innerJoin(assessments, and(eq(assessments.id, candidateRequests.assessmentId), eq(assessments.orgId, candidateRequests.orgId)))
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .where(and(eq(candidateRequests.orgId, orgId), eq(candidateRequests.kind, "PROBLEM"), eq(assessments.candidateId, candidateId), isNull(candidates.deletedAt)))
    .orderBy(desc(candidateRequests.createdAt));
}

/** The reports filed since `since`, newest first, each with the student's name, for the dashboard. */
export async function recentProblemReports(orgId: string, since: Date) {
  return db
    .select({ id: candidateRequests.id, assessmentId: candidateRequests.assessmentId, createdAt: candidateRequests.createdAt, name: candidates.fullName })
    .from(candidateRequests)
    .innerJoin(assessments, and(eq(assessments.id, candidateRequests.assessmentId), eq(assessments.orgId, candidateRequests.orgId)))
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .where(and(eq(candidateRequests.orgId, orgId), eq(candidateRequests.kind, "PROBLEM"), gte(candidateRequests.createdAt, since), isNull(candidates.deletedAt)))
    .orderBy(desc(candidateRequests.createdAt));
}
