"use server";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  assessments,
  attempts,
  stageRuns,
  assessmentLinks,
  stages,
  retakeRequests,
  decisions,
  auditLogs,
} from "@/db/schema";
import { requireUser } from "@/server/session";

/**
 * Codes, not sentences. The panel renders them in the language the manager is
 * reading; this module used to answer in Turkish, which reached an English
 * panel unchanged.
 */
export type RetakeErrorCode =
  | "ASSESSMENT_NOT_FOUND"
  | "NEVER_STARTED"
  | "NO_STAGES"
  | "STAGES_NOT_IN_TEMPLATE"
  | "ATTEMPT_NOT_FOUND";

export type RetakeResult =
  | { ok: true; attemptId: string; attemptNumber: number }
  | { ok: false; code: RetakeErrorCode };

/**
 * Opens a new attempt without destroying the old one.
 *
 * Two rules make this different from "reset the assessment":
 *
 *  1. Stages the manager did NOT ask to be redone are carried, not copied. The
 *     new run points at the previous one through `carried_from_stage_run_id`, so
 *     there is exactly one copy of every answer and the old attempt stays
 *     readable exactly as it was.
 *  2. The same link is reused. A second live link would mean the one the manager
 *     already sent still works alongside a new one, which the database refuses
 *     anyway (`one_active_link_per_assessment`).
 *
 * The new attempt does NOT become primary. Scores already given stay in force
 * until the manager looks at the retake and says otherwise: a retake should
 * never silently change a candidate's standing.
 */
export async function requestRetake(input: {
  assessmentId: string;
  scopeStageIds: string[];
  reason?: string;
  extendDays?: number;
}): Promise<RetakeResult> {
  const user = await requireUser("candidate:invite");

  const [assessment] = await db
    .select({ id: assessments.id, versionId: assessments.versionId })
    .from(assessments)
    .where(
      and(
        eq(assessments.id, input.assessmentId),
        eq(assessments.orgId, user.orgId),
      ),
    )
    .limit(1);
  if (!assessment) return { ok: false, code: "ASSESSMENT_NOT_FOUND" };

  const previous = await db
    .select()
    .from(attempts)
    .where(eq(attempts.assessmentId, assessment.id))
    .orderBy(desc(attempts.attemptNumber));
  const source = previous[0];
  if (!source) {
    return {
      ok: false,
      code: "NEVER_STARTED",
    };
  }

  const versionStages = await db
    .select({ id: stages.id })
    .from(stages)
    .where(eq(stages.versionId, assessment.versionId))
    .orderBy(asc(stages.orderIndex));
  if (versionStages.length === 0) {
    return { ok: false, code: "NO_STAGES" };
  }

  const allIds = new Set(versionStages.map((s) => s.id));
  const scope = input.scopeStageIds.filter((id) => allIds.has(id));
  if (input.scopeStageIds.length > 0 && scope.length === 0) {
    return { ok: false, code: "STAGES_NOT_IN_TEMPLATE" };
  }
  // An empty scope means the whole assessment is redone.
  const redoAll = scope.length === 0 || scope.length === versionStages.length;
  const redo = new Set(redoAll ? versionStages.map((s) => s.id) : scope);

  const sourceRuns = await db
    .select()
    .from(stageRuns)
    .where(eq(stageRuns.attemptId, source.id));

  const created = await db.transaction(async (tx) => {
    const [attempt] = await tx
      .insert(attempts)
      .values({
        assessmentId: assessment.id,
        attemptNumber: source.attemptNumber + 1,
        scope: redoAll ? "FULL" : "PARTIAL",
        isPrimary: false,
        // Whatever the manager typed, verbatim, or null. It used to fall back
        // to a Turkish sentence, which then rendered as data on an English
        // panel; the column is nullable and the screen already has a word for
        // an attempt with no reason.
        createdReason: input.reason?.trim() || null,
      })
      .returning();

    for (const stage of versionStages) {
      if (redo.has(stage.id)) {
        // Fresh run. No timer yet: the server writes started_at when the
        // candidate actually opens the stage.
        await tx.insert(stageRuns).values({
          attemptId: attempt.id,
          stageId: stage.id,
          completion: "PENDING",
        });
        continue;
      }
      const prior = sourceRuns.find((r) => r.stageId === stage.id);

      // A stage the candidate never reached is not "carried", it is still
      // outstanding. Copying a missing or unfinished run forward as SKIPPED
      // would quietly close a stage nobody has done, and the candidate would
      // never get the chance.
      const settled =
        prior && prior.completion !== "PENDING" ? prior : null;
      if (!settled) {
        await tx.insert(stageRuns).values({
          attemptId: attempt.id,
          stageId: stage.id,
          completion: "PENDING",
        });
        continue;
      }

      await tx.insert(stageRuns).values({
        attemptId: attempt.id,
        stageId: stage.id,
        // Follow the chain to the run that actually holds the answers, so a
        // third attempt does not point at a pointer.
        carriedFromStageRunId: settled.carriedFromStageRunId ?? settled.id,
        completion: settled.completion,
        startedAt: settled.startedAt,
        deadlineAt: settled.deadlineAt,
        submittedAt: settled.submittedAt,
        wasLate: settled.wasLate,
      });
    }

    await tx.insert(retakeRequests).values({
      assessmentId: assessment.id,
      scopeStageIds: redoAll ? [] : scope,
      reason: input.reason?.trim() || null,
      requestedBy: user.id,
      resultingAttemptId: attempt.id,
    });

    // Same link, new permission. Extending the expiry is the common case: a
    // link that is already dead cannot carry a retake.
    const extendMs = (input.extendDays ?? 7) * 24 * 60 * 60 * 1000;
    await tx
      .update(assessmentLinks)
      .set({
        status: "RETAKE_AVAILABLE",
        attemptsAllowed: sql`${assessmentLinks.attemptsAllowed} + 1`,
        expiresAt: new Date(Date.now() + extendMs),
      })
      .where(
        and(
          eq(assessmentLinks.assessmentId, assessment.id),
          sql`${assessmentLinks.status} <> 'EXPIRED'`,
        ),
      );

    // The decision history records that the manager asked for more, so the
    // candidate does not sit in "Accepted" or "Rejected" while redoing a stage.
    await tx.insert(decisions).values({
      assessmentId: assessment.id,
      status: "RETAKE_REQUESTED",
      note: input.reason?.trim() || null,
      decidedBy: user.id,
    });

    return attempt;
  });

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "retake.request",
    subjectType: "assessment",
    subjectId: assessment.id,
    meta: {
      attemptId: created.id,
      scope: redoAll ? "FULL" : scope,
      reason: input.reason ?? null,
    },
  });

  revalidatePath(`/candidates/${assessment.id}`);
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  return { ok: true, attemptId: created.id, attemptNumber: created.attemptNumber };
}

/**
 * Which attempt counts. Exactly one per assessment, because the comparison
 * table and the overall score read only the primary one.
 */
export async function setPrimaryAttempt(
  attemptId: string,
): Promise<{ ok: true } | { ok: false; code: RetakeErrorCode }> {
  const user = await requireUser("evaluation:write");

  const [row] = await db
    .select({ assessmentId: attempts.assessmentId, orgId: assessments.orgId })
    .from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (!row || row.orgId !== user.orgId) {
    return { ok: false, code: "ATTEMPT_NOT_FOUND" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(attempts)
      .set({ isPrimary: false })
      .where(eq(attempts.assessmentId, row.assessmentId));
    await tx
      .update(attempts)
      .set({ isPrimary: true })
      .where(eq(attempts.id, attemptId));
  });

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "attempt.set_primary",
    subjectType: "attempt",
    subjectId: attemptId,
  });

  revalidatePath(`/candidates/${row.assessmentId}`);
  revalidatePath("/compare");
  return { ok: true };
}
