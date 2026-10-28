"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  assessments,
  attempts,
  auditLogs,
  examAssessments,
  examResultRevisions,
  examResults,
  itemResponses,
  responseGradingRevisions,
  responseGradings,
  sectionRuns,
} from "@/db/schema";
import { courseOutcomeOverrideEntry, courseOutcomeOverrideOf, COURSE_OUTCOME_OVERRIDE_KEY } from "@/components/panel/course/outcome";
import {
  COMMON_ERRORS_SENT,
  confirmCoursePoints,
  isDecidedStatus,
  isGradedSection,
  pointsTotal,
  proposalPoints,
  readCommonErrors,
  readCoursePoints,
  reasonOk,
  type GradedSection,
} from "@/components/panel/course/grading-model";
import type { CommonWritingError, CoursePoints } from "@/lib/exam/course/types";
import { recomputeResult } from "@/lib/exam-results";
import { withQuery } from "@/lib/redirect";
import { requireUser } from "@/server/session";

/**
 * Teacher decisions on a course test (spec 2026-10-28): the rubric points of a
 * writing or speaking answer, the ticked "Häufigste Fehler", and PASS or FAIL
 * for the whole test. Written the way the level decisions of actions.ts are:
 * the value itself, a revision row, an audit row, then the result is
 * recomputed. The AI only ever proposes (`course_proposal`); a grading counts
 * as decided once a teacher confirmed or changed it, and its points live in
 * `course_points`. Every lookup is scoped to the user's organisation, to the
 * language exam and to a course test, so a form can never reach another
 * solution's row or a level exam's grading (those have their own actions).
 *
 * A refusal comes back as `?error=CODE` on the same page (reason, points,
 * changed, open, errors), which the course result screen words.
 */

async function courseGradingInOrg(gradingId: string, orgId: string) {
  const [row] = await db
    .select({
      grading: responseGradings,
      section: sectionRuns.section,
      attemptId: sectionRuns.attemptId,
      assessmentId: assessments.id,
      mode: examAssessments.mode,
      ended: sql<boolean>`(${attempts.completedAt} is not null or ${attempts.terminatedAt} is not null)`,
      final: sql<boolean>`exists (select 1 from ${examResults} where ${examResults.attemptId} = ${attempts.id} and ${examResults.status} = 'FINAL')`,
    })
    .from(responseGradings)
    .innerJoin(itemResponses, eq(itemResponses.id, responseGradings.itemResponseId))
    .innerJoin(sectionRuns, eq(sectionRuns.id, itemResponses.sectionRunId))
    .innerJoin(attempts, eq(attempts.id, sectionRuns.attemptId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, assessments.id))
    .where(and(eq(responseGradings.id, gradingId), eq(assessments.orgId, orgId), eq(assessments.solution, "LANGUAGE_EXAM")));
  return row ?? null;
}

async function courseResultInOrg(assessmentId: string, orgId: string) {
  const [row] = await db
    .select({ result: examResults, attempt: attempts, mode: examAssessments.mode })
    .from(assessments)
    .innerJoin(attempts, eq(attempts.assessmentId, assessments.id))
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, assessments.id))
    .leftJoin(examResults, eq(examResults.attemptId, attempts.id))
    .where(and(eq(assessments.id, assessmentId), eq(assessments.orgId, orgId), eq(assessments.solution, "LANGUAGE_EXAM")));
  return row ?? null;
}

const back = (assessmentId: string, tab?: string) => `/exam/students/${assessmentId}${tab ? `?tab=${tab}` : ""}`;
const failBack = (assessmentId: string, tab: string, error: string): never => redirect(withQuery(back(assessmentId, tab), { error }));

type GradingRow = NonNullable<Awaited<ReturnType<typeof courseGradingInOrg>>>;

/** The grading a course form names, or a redirect: unknown id, another solution, not a course test, not a writing or speaking answer, final result or a running exam. */
async function openCourseGrading(formData: FormData, orgId: string, tab: string): Promise<GradingRow & { section: GradedSection }> {
  const row = await courseGradingInOrg(String(formData.get("gradingId")), orgId);
  if (!row) return redirect("/exam/students");
  if (row.mode !== "COURSE_TEST" || !isGradedSection(row.section)) return redirect(back(row.assessmentId, tab));
  // A final result is frozen; a running exam is not graded yet.
  if (row.final || !row.ended) return redirect(back(row.assessmentId, tab));
  return { ...row, section: row.section };
}

/** The decision as it stood before, for the revision row. */
function stateOf(row: GradingRow, section: GradedSection) {
  const decided = row.grading.coursePoints;
  const points = decided?.points ?? proposalPoints(row.grading.courseProposal, section).points;
  return {
    status: row.grading.status,
    points,
    total: pointsTotal(points),
    commonErrors: decided?.commonErrors ?? row.grading.courseProposal?.commonErrors ?? [],
  };
}

async function writeDecision(input: {
  row: GradingRow;
  section: GradedSection;
  userId: string;
  orgId: string;
  status: "CONFIRMED" | "OVERRIDDEN";
  points: CoursePoints;
  commonErrors: CommonWritingError[];
  reason: string | null;
  revisionReason: string;
  auditAction: string;
  auditMeta: Record<string, unknown>;
}) {
  const { row, section } = input;
  const now = new Date();
  // Speaking has no common-error boxes; only writing keeps them.
  const coursePoints = section === "WRITING" ? { points: input.points, commonErrors: input.commonErrors } : { points: input.points };
  await db
    .update(responseGradings)
    .set({ status: input.status, coursePoints, decider: "TEACHER", decidedBy: input.userId, decidedAt: now, reason: input.reason, updatedAt: now })
    .where(eq(responseGradings.id, row.grading.id));
  await db.insert(responseGradingRevisions).values({
    gradingId: row.grading.id,
    before: stateOf(row, section),
    after: { status: input.status, points: input.points, total: pointsTotal(input.points), commonErrors: section === "WRITING" ? input.commonErrors : [] },
    reason: input.revisionReason,
    changedBy: input.userId,
  });
  await db.insert(auditLogs).values({
    orgId: input.orgId,
    actorId: input.userId,
    action: input.auditAction,
    subjectType: "response_grading",
    subjectId: row.grading.id,
    meta: { section, points: input.points, total: pointsTotal(input.points), ...input.auditMeta },
  });
  await recomputeResult(row.attemptId);
}

/** The boxes of the form when it carried them, else what stands now (the teacher's, or the AI's before any decision). */
function errorsOf(row: GradingRow, formData: FormData): CommonWritingError[] | null {
  if (formData.get(COMMON_ERRORS_SENT) === null) return row.grading.coursePoints?.commonErrors ?? row.grading.courseProposal?.commonErrors ?? [];
  const read = readCommonErrors(formData);
  return read.ok ? read.errors : null;
}

/**
 * Confirms the AI's rubric proposal as it stands: its points go into
 * `course_points`, the status becomes CONFIRMED and the teacher is the decider.
 * A criterion the AI left open (AUSSPRACHE from a transcript) takes the value
 * the teacher sends. A form that sends another value for a criterion the AI
 * judged is a change and must use `setCourseGradingPoints`.
 */
export async function confirmCourseGrading(formData: FormData) {
  const user = await requireUser("result:grade");
  const tab = String(formData.get("tab") ?? "");
  const row = await openCourseGrading(formData, user.orgId, tab);
  const proposal = row.grading.courseProposal;
  if (row.grading.status !== "AI_PROPOSED" || !proposal) redirect(back(row.assessmentId, tab));
  const confirmed = confirmCoursePoints(row.section, proposal, formData);
  if (!confirmed.ok) return failBack(row.assessmentId, tab, confirmed.code === "CHANGED" ? "changed" : "open");
  const commonErrors = errorsOf(row, formData);
  if (commonErrors === null) return failBack(row.assessmentId, tab, "errors");
  await writeDecision({
    row,
    section: row.section,
    userId: user.id,
    orgId: user.orgId,
    status: "CONFIRMED",
    points: confirmed.points,
    commonErrors,
    reason: null,
    revisionReason: confirmed.filled.length ? `AI proposal confirmed; set by teacher: ${confirmed.filled.join(", ")}` : "AI proposal confirmed",
    auditAction: "grading.course_confirm",
    auditMeta: { filled: confirmed.filled },
  });
  revalidatePath(back(row.assessmentId));
  redirect(back(row.assessmentId, tab));
}

/**
 * The teacher's own points for a writing or speaking answer: every criterion,
 * whole numbers within its maximum, and a reason of at least three characters.
 * The status becomes OVERRIDDEN.
 */
export async function setCourseGradingPoints(formData: FormData) {
  const user = await requireUser("result:grade");
  const tab = String(formData.get("tab") ?? "");
  const row = await openCourseGrading(formData, user.orgId, tab);
  const reason = String(formData.get("reason") ?? "").trim();
  const read = readCoursePoints(row.section, formData);
  if (!read.ok) return failBack(row.assessmentId, tab, "points");
  if (!reasonOk(reason)) return failBack(row.assessmentId, tab, "reason");
  const commonErrors = errorsOf(row, formData);
  if (commonErrors === null) return failBack(row.assessmentId, tab, "errors");
  const before = stateOf(row, row.section);
  await writeDecision({
    row,
    section: row.section,
    userId: user.id,
    orgId: user.orgId,
    status: "OVERRIDDEN",
    points: read.points,
    commonErrors,
    reason,
    revisionReason: reason,
    auditAction: "grading.course_override",
    auditMeta: { from: before.points, fromTotal: before.total, reason },
  });
  revalidatePath(back(row.assessmentId));
  redirect(back(row.assessmentId, tab));
}

/**
 * Sets the ticked "Häufigste Fehler" of a writing answer the teacher has
 * already decided, without touching its points or its status. The boxes
 * decide no points, so no reason is asked; the change is still written to the
 * revision and audit rows.
 */
export async function setCourseCommonErrors(formData: FormData) {
  const user = await requireUser("result:grade");
  const tab = String(formData.get("tab") ?? "");
  const row = await openCourseGrading(formData, user.orgId, tab);
  const decided = row.grading.coursePoints;
  if (row.section !== "WRITING") redirect(back(row.assessmentId, tab));
  // The boxes belong to a decision; before one exists they travel with the confirm or the change.
  if (!isDecidedStatus(row.grading.status) || !decided) return failBack(row.assessmentId, tab, "undecided");
  const read = readCommonErrors(formData);
  if (!read.ok) return failBack(row.assessmentId, tab, "errors");
  const now = new Date();
  await db
    .update(responseGradings)
    .set({ coursePoints: { ...decided, commonErrors: read.errors }, updatedAt: now })
    .where(eq(responseGradings.id, row.grading.id));
  await db.insert(responseGradingRevisions).values({
    gradingId: row.grading.id,
    before: { commonErrors: decided.commonErrors ?? [] },
    after: { commonErrors: read.errors },
    reason: "Common errors updated",
    changedBy: user.id,
  });
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "grading.course_common_errors",
    subjectType: "response_grading",
    subjectId: row.grading.id,
    meta: { from: decided.commonErrors ?? [], to: read.errors },
  });
  await recomputeResult(row.attemptId);
  revalidatePath(back(row.assessmentId));
  redirect(back(row.assessmentId, tab));
}

/**
 * The teacher's PASS or FAIL for the whole course test, with a reason of at
 * least three characters, until the result is final (as overrideOverall does
 * for a level). Stored with the other teacher overrides on the result
 * (`skill_overrides`, see components/panel/course/outcome.ts), with a revision
 * row (field "course_outcome") and an audit row.
 */
export async function overrideCourseOutcome(formData: FormData) {
  const user = await requireUser("result:finalize");
  const assessmentId = String(formData.get("assessmentId"));
  const outcome = String(formData.get("outcome") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const row = await courseResultInOrg(assessmentId, user.orgId);
  if (!row?.result) redirect("/exam/students");
  if (row.mode !== "COURSE_TEST" || row.result.status === "FINAL") redirect(back(assessmentId));
  if ((outcome !== "PASS" && outcome !== "FAIL") || !reasonOk(reason)) redirect(withQuery(back(assessmentId), { error: "reason" }));
  const before = courseOutcomeOverrideOf(row.result.skillOverrides)?.outcome ?? row.result.computed?.course?.outcome ?? null;
  const now = new Date();
  await db
    .update(examResults)
    .set({ skillOverrides: { ...row.result.skillOverrides, [COURSE_OUTCOME_OVERRIDE_KEY]: courseOutcomeOverrideEntry(outcome, user.id, reason, now) }, updatedAt: now })
    .where(eq(examResults.id, row.result.id));
  await db.insert(examResultRevisions).values({ resultId: row.result.id, field: "course_outcome", before, after: outcome, reason, changedBy: user.id });
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "result.override_course_outcome",
    subjectType: "exam_result",
    subjectId: row.result.id,
    meta: { from: before, to: outcome, reason },
  });
  await recomputeResult(row.attempt.id);
  revalidatePath(back(assessmentId));
  redirect(back(assessmentId));
}
