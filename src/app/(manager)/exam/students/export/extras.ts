import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessments, attempts, examAssessments, examResults, organizations } from "@/db/schema";
import { enabledSections } from "@/lib/exam/blueprint";
import { SECTIONS, type Cefr, type Section } from "@/lib/exam/types";

/**
 * What the student list rows do not carry: each skill's level, the recommended
 * class and the exam's length. Org-scoped like the list itself. A skill shows
 * its confirmed level once the result is final, the engine's current estimate
 * before that.
 */
export type StudentExtras = {
  skills: Partial<Record<Section, string>>;
  recommended: Cefr | null;
  minutes: number;
};

export async function loadStudentExtras(orgId: string): Promise<Map<string, StudentExtras>> {
  const rows = await db
    .select({ id: assessments.id, exam: examAssessments.blueprintSnapshot, result: examResults })
    .from(assessments)
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, assessments.id))
    .leftJoin(attempts, eq(attempts.assessmentId, assessments.id))
    .leftJoin(examResults, eq(examResults.attemptId, attempts.id))
    .where(and(eq(assessments.orgId, orgId), eq(assessments.solution, "LANGUAGE_EXAM")));
  const out = new Map<string, StudentExtras>();
  for (const { id, exam, result } of rows) {
    const final = result?.status === "FINAL";
    const skills: Partial<Record<Section, string>> = {};
    for (const s of SECTIONS) {
      const level = final ? result?.finalSkills?.[s]?.level : result?.computed?.skills?.[s]?.level;
      if (level) skills[s] = level;
    }
    out.set(id, {
      skills,
      recommended: result?.computed?.placement?.recommended ?? null,
      minutes: enabledSections(exam).reduce((m, s) => m + s.durationMinutes, 0),
    });
  }
  return out;
}

export async function schoolName(orgId: string): Promise<string> {
  const [row] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return row?.name ?? "";
}
