import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessments, attempts, examAssessments, examResults, organizations } from "@/db/schema";
import { enabledSections } from "@/lib/exam/blueprint";
import { recommendedClassOf } from "@/lib/exam/placement";
import { SECTIONS, type Section } from "@/lib/exam/types";
import { verificationSkillStates, type VerificationOutcome } from "@/lib/exam/verification-view";

/**
 * What the student list rows do not carry: each skill's level, the recommended
 * class and the exam's length. Org-scoped like the list itself. A skill shows
 * its confirmed level once the result is final, the engine's current estimate
 * before that.
 */
export type StudentExtras = {
  skills: Partial<Record<Section, string>>;
  /** A level verification: what each skill shows (reached, not reached, teacher review) in place of a level. */
  verification?: Partial<Record<Section, "REACHED" | "NOT_REACHED" | "REVIEW">>;
  /**
   * The lower level a borderline placement recommends, as before; for an A0
   * (Pre-A1) result the first course, "A1.1" (`recommendedClassOf`).
   */
  recommended: string | null;
  minutes: number;
};

export async function loadStudentExtras(orgId: string): Promise<Map<string, StudentExtras>> {
  const rows = await db
    .select({ id: assessments.id, exam: examAssessments.blueprintSnapshot, mode: examAssessments.mode, claimed: examAssessments.claimedLevel, result: examResults })
    .from(assessments)
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, assessments.id))
    .leftJoin(attempts, eq(attempts.assessmentId, assessments.id))
    .leftJoin(examResults, eq(examResults.attemptId, attempts.id))
    .where(and(eq(assessments.orgId, orgId), eq(assessments.solution, "LANGUAGE_EXAM")));
  const out = new Map<string, StudentExtras>();
  for (const { id, exam, mode, claimed, result } of rows) {
    const final = result?.status === "FINAL";
    const skills: Partial<Record<Section, string>> = {};
    for (const s of SECTIONS) {
      const level = final ? result?.finalSkills?.[s]?.level : result?.computed?.skills?.[s]?.level;
      if (level) skills[s] = level;
    }
    const overall = final ? result?.finalOverall : result?.computed?.overall;
    let verification: StudentExtras["verification"];
    if (mode === "LEVEL_VERIFICATION" && claimed) {
      const outcome = (final ? result?.finalOutcome : result?.computed?.verification?.outcome) as VerificationOutcome | null | undefined;
      verification = Object.fromEntries(
        verificationSkillStates({ claimed, computed: result?.computed, finalSkills: final ? result?.finalSkills : null, outcome }).map((s) => [s.section, s.shown]),
      );
    }
    const placement = result?.computed?.placement;
    const preA1Class = placement && overall ? recommendedClassOf(overall, placement) : null;
    out.set(id, {
      skills: verification ? {} : skills,
      verification,
      recommended: preA1Class?.preA1 ? preA1Class.sublevel : (placement?.recommended ?? null),
      minutes: enabledSections(exam).reduce((m, s) => m + s.durationMinutes, 0),
    });
  }
  return out;
}

export async function schoolName(orgId: string): Promise<string> {
  const [row] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return row?.name ?? "";
}
