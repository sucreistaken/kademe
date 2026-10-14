import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { assessments, attempts, proctorEvents } from "@/db/schema";
import { NOISE_TYPES } from "./groups";

export type IntegrityBrief = {
  /** Flag types (not events) with at least one HIGH event the teacher has not dismissed, technical types left out. */
  serious: number;
  outcome: "VALID" | "RETAKE" | "INVALID" | null;
};

/**
 * One query for the whole student list: per exam invitation, the number of
 * serious flag groups and the teacher's integrity decision. The count is a
 * correlated subquery over `proctor_events_attempt_idx`, so it costs one index
 * range per attempt and no event rows travel to the server. The rule is the
 * same as `summarizeFlags(...).serious`.
 */
export async function loadIntegrityBriefs(orgId: string): Promise<Map<string, IntegrityBrief>> {
  const rows = await db
    .select({
      assessmentId: attempts.assessmentId,
      outcome: attempts.integrityOutcome,
      serious: sql<number>`(
        select count(distinct ${proctorEvents.type})::int
        from ${proctorEvents}
        where ${proctorEvents.attemptId} = ${attempts.id}
          and ${proctorEvents.severity} = 'HIGH'
          and ${proctorEvents.teacherStatus} <> 'DISMISSED'
          and ${notInArray(proctorEvents.type, [...NOISE_TYPES])}
      )`,
    })
    .from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(and(eq(assessments.orgId, orgId), eq(assessments.solution, "LANGUAGE_EXAM")));
  return new Map(rows.map((r) => [r.assessmentId, { serious: r.serious, outcome: r.outcome }]));
}
