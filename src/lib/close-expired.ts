import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  stageRuns,
  stages,
  activities,
  responses,
  attempts,
  assessmentLinks,
} from "@/db/schema";
import type { TimeoutBehaviour } from "./timer";
import { decideClose, hasAnswer } from "./stage-timeout";

export { decideClose, hasAnswer };

/**
 * Closes stage runs whose deadline has passed.
 *
 * Without this a candidate who closes the tab leaves the stage open forever:
 * the clock is server-side so the deadline is correct, but nothing ever acts on
 * it. The run stays PENDING, the manager sees "in progress" indefinitely, and
 * whatever the candidate did type is never marked as submitted.
 */

export type CloseResult = {
  scanned: number;
  closed: number;
  leftOpen: number;
  attemptsCompleted: number;
  details: Array<{ stageRunId: string; outcome: string }>;
};

/**
 * One pass. Bounded by `limit` so a scheduled call stays predictable, and
 * idempotent: a run already closed no longer matches the query.
 */
export async function closeExpiredRuns(
  now: Date = new Date(),
  limit = 50,
): Promise<CloseResult> {
  const due = await db
    .select({
      run: stageRuns,
      onTimeout: stages.onTimeout,
      stageId: stages.id,
    })
    .from(stageRuns)
    .innerJoin(stages, eq(stages.id, stageRuns.stageId))
    .where(
      and(
        eq(stageRuns.completion, "PENDING"),
        isNull(stageRuns.submittedAt),
        lt(stageRuns.deadlineAt, now),
      ),
    )
    .limit(limit);

  const result: CloseResult = {
    scanned: due.length,
    closed: 0,
    leftOpen: 0,
    attemptsCompleted: 0,
    details: [],
  };
  if (due.length === 0) return result;

  const stageIds = [...new Set(due.map((d) => d.stageId))];
  const runIds = due.map((d) => d.run.id);

  const [activityRows, responseRows] = await Promise.all([
    db
      .select({
        id: activities.id,
        stageId: activities.stageId,
        isRequired: activities.isRequired,
      })
      .from(activities)
      .where(inArray(activities.stageId, stageIds)),
    db
      .select()
      .from(responses)
      .where(inArray(responses.stageRunId, runIds)),
  ]);

  const touchedAttempts = new Set<string>();

  for (const row of due) {
    const stageActivities = activityRows.filter((a) => a.stageId === row.stageId);
    const mine = responseRows.filter((r) => r.stageRunId === row.run.id);
    const answeredIds = new Set(
      mine.filter((r) => hasAnswer(r.payload)).map((r) => r.activityId),
    );

    const decision = decideClose({
      behaviour: row.onTimeout as TimeoutBehaviour,
      requiredCount: stageActivities.filter((a) => a.isRequired).length,
      answeredRequired: stageActivities.filter(
        (a) => a.isRequired && answeredIds.has(a.id),
      ).length,
      answeredAny: answeredIds.size,
    });

    if (decision.action === "LEAVE_OPEN") {
      result.leftOpen += 1;
      result.details.push({ stageRunId: row.run.id, outcome: decision.reason });
      continue;
    }

    await db
      .update(stageRuns)
      .set({
        completion: decision.completion,
        submittedAt: now,
        wasLate: decision.late,
      })
      .where(eq(stageRuns.id, row.run.id));

    result.closed += 1;
    result.details.push({ stageRunId: row.run.id, outcome: decision.completion });
    touchedAttempts.add(row.run.attemptId);
  }

  // An attempt whose every stage run is settled is finished, and the link that
  // led to it should stop saying "in progress".
  for (const attemptId of touchedAttempts) {
    const siblings = await db
      .select({ completion: stageRuns.completion })
      .from(stageRuns)
      .where(eq(stageRuns.attemptId, attemptId));
    if (siblings.some((s) => s.completion === "PENDING")) continue;

    await db
      .update(attempts)
      .set({ completedAt: now })
      .where(and(eq(attempts.id, attemptId), isNull(attempts.completedAt)));

    const [row] = await db
      .select({ assessmentId: attempts.assessmentId })
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);
    if (row) {
      await db
        .update(assessmentLinks)
        .set({ status: "COMPLETED" })
        .where(
          and(
            eq(assessmentLinks.assessmentId, row.assessmentId),
            inArray(assessmentLinks.status, ["IN_PROGRESS", "NOT_STARTED"]),
          ),
        );
    }
    result.attemptsCompleted += 1;
  }

  return result;
}

/** Marks links whose expiry has passed. Separate from stage timing on purpose. */
export async function expireLinks(now: Date = new Date()) {
  const rows = await db
    .update(assessmentLinks)
    .set({ status: "EXPIRED" })
    .where(
      and(
        lt(assessmentLinks.expiresAt, now),
        inArray(assessmentLinks.status, [
          "NOT_STARTED",
          "IN_PROGRESS",
          "RETAKE_AVAILABLE",
          "RETAKE_REQUESTED",
        ]),
      ),
    )
    .returning({ id: assessmentLinks.id });
  return { expired: rows.length };
}

