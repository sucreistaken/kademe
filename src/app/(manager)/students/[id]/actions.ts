"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  assessments,
  attempts,
  auditLogs,
  examResultRevisions,
  examResults,
  itemResponses,
  proctorEvents,
  responseGradingRevisions,
  responseGradings,
  sectionRuns,
} from "@/db/schema";
import { isCefr } from "@/lib/exam/cefr";
import { finalizeResult, recomputeResult } from "@/lib/exam-results";
import { withQuery } from "@/lib/redirect";
import { recomputeIntegrity } from "@/server/proctoring";
import { requireUser } from "@/server/session";

/**
 * Teacher decisions on one result. Every change is written three times on
 * purpose: the value itself, a revision row with the reason, and an audit row.
 * A level the AI proposed never becomes final without one of these actions.
 */

async function gradingInOrg(gradingId: string, orgId: string) {
  const [row] = await db
    .select({
      grading: responseGradings,
      attemptId: sectionRuns.attemptId,
      assessmentId: assessments.id,
      ended: sql<boolean>`(${attempts.completedAt} is not null or ${attempts.terminatedAt} is not null)`,
      final: sql<boolean>`exists (select 1 from ${examResults} where ${examResults.attemptId} = ${attempts.id} and ${examResults.status} = 'FINAL')`,
    })
    .from(responseGradings)
    .innerJoin(itemResponses, eq(itemResponses.id, responseGradings.itemResponseId))
    .innerJoin(sectionRuns, eq(sectionRuns.id, itemResponses.sectionRunId))
    .innerJoin(attempts, eq(attempts.id, sectionRuns.attemptId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(and(eq(responseGradings.id, gradingId), eq(assessments.orgId, orgId)));
  return row ?? null;
}

async function resultInOrg(assessmentId: string, orgId: string) {
  const [row] = await db
    .select({ result: examResults, attempt: attempts, assessment: assessments })
    .from(assessments)
    .innerJoin(attempts, eq(attempts.assessmentId, assessments.id))
    .leftJoin(examResults, eq(examResults.attemptId, attempts.id))
    .where(and(eq(assessments.id, assessmentId), eq(assessments.orgId, orgId)));
  return row ?? null;
}

const back = (assessmentId: string, tab?: string) => `/students/${assessmentId}${tab ? `?tab=${tab}` : ""}`;

export async function confirmGrading(formData: FormData) {
  const user = await requireUser("result:grade");
  const row = await gradingInOrg(String(formData.get("gradingId")), user.orgId);
  const tab = String(formData.get("tab") ?? "");
  if (!row || row.grading.status !== "AI_PROPOSED" || !row.grading.aiLevel) redirect("/students");
  // A final result is frozen; a running exam is not graded yet.
  if (row.final || !row.ended) redirect(back(row.assessmentId, tab));
  const now = new Date();
  await db
    .update(responseGradings)
    .set({ status: "CONFIRMED", finalLevel: row.grading.aiLevel, decider: "TEACHER", decidedBy: user.id, decidedAt: now, reason: null, updatedAt: now })
    .where(eq(responseGradings.id, row.grading.id));
  await db.insert(responseGradingRevisions).values({
    gradingId: row.grading.id,
    before: { status: row.grading.status, level: row.grading.aiLevel },
    after: { status: "CONFIRMED", level: row.grading.aiLevel },
    reason: "AI proposal confirmed",
    changedBy: user.id,
  });
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "grading.confirm",
    subjectType: "response_grading",
    subjectId: row.grading.id,
    meta: { level: row.grading.aiLevel },
  });
  await recomputeResult(row.attemptId);
  revalidatePath(back(row.assessmentId));
  redirect(back(row.assessmentId, tab));
}

export async function overrideGrading(formData: FormData) {
  const user = await requireUser("result:grade");
  const row = await gradingInOrg(String(formData.get("gradingId")), user.orgId);
  const tab = String(formData.get("tab") ?? "");
  const level = String(formData.get("level") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!row) redirect("/students");
  if (row.final || !row.ended) redirect(back(row.assessmentId, tab));
  if (!isCefr(level) || reason.length < 3) redirect(withQuery(back(row.assessmentId, tab), { error: "reason" }));
  const now = new Date();
  await db
    .update(responseGradings)
    .set({ status: "OVERRIDDEN", finalLevel: level, decider: "TEACHER", decidedBy: user.id, decidedAt: now, reason, updatedAt: now })
    .where(eq(responseGradings.id, row.grading.id));
  await db.insert(responseGradingRevisions).values({
    gradingId: row.grading.id,
    before: { status: row.grading.status, level: row.grading.finalLevel ?? row.grading.aiLevel },
    after: { status: "OVERRIDDEN", level },
    reason,
    changedBy: user.id,
  });
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "grading.override",
    subjectType: "response_grading",
    subjectId: row.grading.id,
    meta: { from: row.grading.finalLevel ?? row.grading.aiLevel, to: level, reason },
  });
  await recomputeResult(row.attemptId);
  revalidatePath(back(row.assessmentId));
  redirect(back(row.assessmentId, tab));
}

export async function overrideOverall(formData: FormData) {
  const user = await requireUser("result:finalize");
  const assessmentId = String(formData.get("assessmentId"));
  const level = String(formData.get("level") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const row = await resultInOrg(assessmentId, user.orgId);
  if (!row?.result) redirect("/students");
  if (row.result.status === "FINAL") redirect(back(assessmentId));
  if (!isCefr(level) || reason.length < 3) redirect(withQuery(back(assessmentId), { error: "reason" }));
  await db
    .update(examResults)
    .set({ overallOverride: level, overallOverrideReason: reason, updatedAt: new Date() })
    .where(eq(examResults.id, row.result.id));
  await db.insert(examResultRevisions).values({
    resultId: row.result.id,
    field: "overall",
    before: row.result.overallOverride ?? row.result.computed?.overall ?? null,
    after: level,
    reason,
    changedBy: user.id,
  });
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "result.override_overall",
    subjectType: "exam_result",
    subjectId: row.result.id,
    meta: { to: level, reason },
  });
  await recomputeResult(row.attempt.id);
  revalidatePath(back(assessmentId));
  redirect(back(assessmentId));
}

export async function finalize(formData: FormData) {
  const user = await requireUser("result:finalize");
  const assessmentId = String(formData.get("assessmentId"));
  const row = await resultInOrg(assessmentId, user.orgId);
  if (!row?.result) redirect("/students");
  if (!row.attempt.completedAt && !row.attempt.terminatedAt) redirect(withQuery(back(assessmentId), { error: "running" }));
  await recomputeResult(row.attempt.id);
  const done = await finalizeResult(row.attempt.id, user.id, null);
  if (!done.ok) redirect(withQuery(back(assessmentId), { error: done.code }));
  await db.insert(examResultRevisions).values({ resultId: row.result.id, field: "finalize", after: true, changedBy: user.id });
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "result.finalize",
    subjectType: "exam_result",
    subjectId: row.result.id,
  });
  revalidatePath(back(assessmentId));
  redirect(back(assessmentId));
}

export async function release(formData: FormData) {
  const user = await requireUser("result:finalize");
  const assessmentId = String(formData.get("assessmentId"));
  const row = await resultInOrg(assessmentId, user.orgId);
  if (!row?.result || row.result.status !== "FINAL") redirect(back(assessmentId));
  // An attempt the teacher judged invalid is not released.
  if (row.attempt.integrityOutcome === "INVALID") redirect(withQuery(back(assessmentId), { error: "invalid" }));
  const now = new Date();
  await db.update(examResults).set({ releasedAt: now, releasedBy: user.id, updatedAt: now }).where(eq(examResults.id, row.result.id));
  await db.insert(examResultRevisions).values({ resultId: row.result.id, field: "release", after: now.toISOString(), changedBy: user.id });
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "result.release",
    subjectType: "exam_result",
    subjectId: row.result.id,
  });
  revalidatePath(back(assessmentId));
  redirect(back(assessmentId));
}

export async function decideFlag(formData: FormData) {
  const user = await requireUser("integrity:decide");
  const eventId = String(formData.get("eventId"));
  const status = String(formData.get("status"));
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!["OPEN", "CONFIRMED", "DISMISSED"].includes(status)) redirect("/students");
  const [row] = await db
    .select({ event: proctorEvents, assessmentId: assessments.id })
    .from(proctorEvents)
    .innerJoin(attempts, eq(attempts.id, proctorEvents.attemptId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(and(eq(proctorEvents.id, eventId), eq(assessments.orgId, user.orgId)));
  if (!row) redirect("/students");
  await db
    .update(proctorEvents)
    .set({ teacherStatus: status as "OPEN" | "CONFIRMED" | "DISMISSED", teacherNote: note, decidedBy: user.id, decidedAt: new Date() })
    .where(eq(proctorEvents.id, eventId));
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: `integrity.flag_${status.toLowerCase()}`,
    subjectType: "proctor_event",
    subjectId: eventId,
    meta: { type: row.event.type, note },
  });
  await recomputeIntegrity(row.event.attemptId);
  revalidatePath(back(row.assessmentId, "integrity"));
  redirect(withQuery(back(row.assessmentId, "integrity"), { flag: eventId, flagStatus: status, show: String(formData.get("show") ?? "") }));
}

export async function setIntegrityOutcome(formData: FormData) {
  const user = await requireUser("integrity:decide");
  const assessmentId = String(formData.get("assessmentId"));
  const outcome = String(formData.get("outcome"));
  if (!["VALID", "RETAKE", "INVALID"].includes(outcome)) redirect(back(assessmentId, "integrity"));
  const row = await resultInOrg(assessmentId, user.orgId);
  if (!row) redirect("/students");
  await db
    .update(attempts)
    .set({ integrityOutcome: outcome as "VALID" | "RETAKE" | "INVALID", integrityDecidedBy: user.id, integrityDecidedAt: new Date() })
    .where(eq(attempts.id, row.attempt.id));
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "integrity.outcome",
    subjectType: "attempt",
    subjectId: row.attempt.id,
    meta: { outcome },
  });
  revalidatePath(back(assessmentId, "integrity"));
  redirect(back(assessmentId, "integrity"));
}
