import { eq, asc, desc, inArray, and } from "drizzle-orm";
import { db } from "@/db";
import {
  candidates,
  assessments,
  attempts,
  stageRuns,
  responses,
  mediaAssets,
  transcripts,
  stages,
  activities,
  stageCompetencies,
  competencies,
  scaleLevels,
  evaluationOptions,
  evaluations,
  evaluationItems,
  templateVersions,
  templates,
  positions,
  technicalEvents,
  evaluationItemRevisions,
  users,
  weightSets,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth";

/**
 * The review route lives at /candidates/[id]/review, so `id` is a CANDIDATE id:
 * that is what the dashboard, the candidate table and the detail page all link
 * with. A candidate can hold more than one assessment (invited to two positions),
 * so the newest one wins unless the caller names one explicitly.
 *
 * An assessment id is still accepted, because a link built by hand or copied out
 * of the database should not dead end.
 */
export async function resolveAssessmentId(
  id: string,
  user: SessionUser,
  preferredAssessmentId?: string,
): Promise<string | null> {
  if (preferredAssessmentId) {
    const [direct] = await db
      .select({ id: assessments.id })
      .from(assessments)
      .where(
        and(
          eq(assessments.id, preferredAssessmentId),
          eq(assessments.orgId, user.orgId),
        ),
      )
      .limit(1);
    if (direct) return direct.id;
  }

  const [asAssessment] = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(and(eq(assessments.id, id), eq(assessments.orgId, user.orgId)))
    .limit(1);
  if (asAssessment) return asAssessment.id;

  const [latest] = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(
      and(eq(assessments.candidateId, id), eq(assessments.orgId, user.orgId)),
    )
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  return latest?.id ?? null;
}

/**
 * Everything the review screen needs, in one load. Takes an ASSESSMENT id;
 * callers holding a candidate id go through resolveAssessmentId first. The manager side deliberately
 * sees the internal fields (objective, expected behaviours, red flags) that the
 * candidate never gets: that asymmetry is the point of the product.
 */
export async function loadReview(
  assessmentId: string,
  user: SessionUser,
  attemptId?: string,
) {
  const [head] = await db
    .select({
      assessmentId: assessments.id,
      orgId: assessments.orgId,
      locale: assessments.locale,
      candidateName: candidates.fullName,
      candidateEmail: candidates.email,
      versionId: templateVersions.id,
      versionNumber: templateVersions.versionNumber,
      templateName: templates.name,
      positionId: positions.id,
      positionName: positions.name,
    })
    .from(assessments)
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .innerJoin(templateVersions, eq(templateVersions.id, assessments.versionId))
    .innerJoin(templates, eq(templates.id, templateVersions.templateId))
    .innerJoin(positions, eq(positions.id, templates.positionId))
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  // Org scoping is not decorative: it is what stops one tenant reading another.
  if (!head || head.orgId !== user.orgId) return null;

  const attemptRows = await db
    .select()
    .from(attempts)
    .where(eq(attempts.assessmentId, assessmentId))
    .orderBy(asc(attempts.attemptNumber));

  const active =
    attemptRows.find((a) => a.id === attemptId) ??
    attemptRows.find((a) => a.isPrimary) ??
    attemptRows.at(-1);

  /**
   * An invited candidate who has not started yet has no attempt. That is a
   * normal state, not a missing page: returning null here made every "İncele"
   * button on such a row answer with a 404 instead of saying so.
   */
  if (!active) {
    return {
      head,
      attempts: [],
      activeAttempt: null,
      evaluation: null,
      stages: [],
    };
  }

  const runs = await db
    .select()
    .from(stageRuns)
    .where(eq(stageRuns.attemptId, active.id));

  /**
   * On a partial retake the stages that were not redone carry a pointer to the
   * previous run rather than a copy of the data, so answers must be read from
   * whichever run actually holds them.
   */
  const sourceRunIds = runs.map((r) => r.carriedFromStageRunId ?? r.id);
  const runIdForStage = new Map(
    runs.map((r) => [r.stageId, r.carriedFromStageRunId ?? r.id]),
  );

  const stageRows = await db
    .select()
    .from(stages)
    .where(eq(stages.versionId, head.versionId))
    .orderBy(asc(stages.orderIndex));
  const stageIds = stageRows.map((s) => s.id);

  const [
    activityRows,
    responseRows,
    mediaRows,
    linkRows,
    competencyRows,
    eventRows,
  ] = await Promise.all([
    stageIds.length
      ? db
          .select()
          .from(activities)
          .where(inArray(activities.stageId, stageIds))
          .orderBy(asc(activities.orderIndex))
      : [],
    sourceRunIds.length
      ? db
          .select()
          .from(responses)
          .where(inArray(responses.stageRunId, sourceRunIds))
      : [],
    sourceRunIds.length
      ? db
          .select({ media: mediaAssets, transcript: transcripts })
          .from(mediaAssets)
          .leftJoin(
            transcripts,
            eq(transcripts.mediaAssetId, mediaAssets.id),
          )
          .where(inArray(mediaAssets.stageRunId, sourceRunIds))
      : [],
    stageIds.length
      ? db
          .select()
          .from(stageCompetencies)
          .where(inArray(stageCompetencies.stageId, stageIds))
          .orderBy(asc(stageCompetencies.orderIndex))
      : [],
    db.select().from(competencies).where(eq(competencies.orgId, user.orgId)),
    sourceRunIds.length
      ? db
          .select()
          .from(technicalEvents)
          .where(inArray(technicalEvents.stageRunId, sourceRunIds))
          .orderBy(asc(technicalEvents.at))
      : [],
  ]);

  const scaleIds = [...new Set(competencyRows.map((c) => c.scaleId))];
  const [levelRows, optionRows] = await Promise.all([
    scaleIds.length
      ? db
          .select()
          .from(scaleLevels)
          .where(inArray(scaleLevels.scaleId, scaleIds))
          .orderBy(asc(scaleLevels.value))
      : [],
    competencyRows.length
      ? db
          .select()
          .from(evaluationOptions)
          .where(
            inArray(
              evaluationOptions.competencyId,
              competencyRows.map((c) => c.id),
            ),
          )
          .orderBy(asc(evaluationOptions.orderIndex))
      : [],
  ]);

  // One evaluation row per evaluator. This loads the current user's own, which
  // is the one they are allowed to edit.
  let [evaluation] = await db
    .select()
    .from(evaluations)
    .where(
      and(
        eq(evaluations.attemptId, active.id),
        eq(evaluations.evaluatorId, user.id),
      ),
    )
    .limit(1);

  if (!evaluation) {
    // Pinned to the weight set in force when the evaluation is opened, so a
    // set saved next month does not silently move this score; the manager's
    // "recalculate" is what re-pins. Null when weighting is off, in which case
    // the row follows whatever is active once it is turned on (selectWeights
    // in lib/scoring.ts spells out the rule).
    const [activeSet] = await db
      .select({ id: weightSets.id })
      .from(weightSets)
      .where(
        and(eq(weightSets.versionId, head.versionId), eq(weightSets.isActive, 1)),
      )
      .limit(1);
    [evaluation] = await db
      .insert(evaluations)
      .values({
        attemptId: active.id,
        evaluatorId: user.id,
        weightSetId: activeSet?.id ?? null,
      })
      .returning();
  }

  const itemRows = await db
    .select()
    .from(evaluationItems)
    .where(eq(evaluationItems.evaluationId, evaluation.id));

  // The audit trail behind the silent autosave. Newest first, so "what did I
  // just change" is the first thing visible.
  const revisionRows = itemRows.length
    ? await db
        .select({
          revision: evaluationItemRevisions,
          byName: users.name,
        })
        .from(evaluationItemRevisions)
        .leftJoin(users, eq(users.id, evaluationItemRevisions.changedBy))
        .where(
          inArray(
            evaluationItemRevisions.evaluationItemId,
            itemRows.map((i) => i.id),
          ),
        )
        .orderBy(desc(evaluationItemRevisions.at))
    : [];

  /* ---- assemble ---- */

  const byCompetency = new Map(competencyRows.map((c) => [c.id, c]));
  const levelsByScale = new Map<string, typeof levelRows>();
  for (const l of levelRows) {
    const list = levelsByScale.get(l.scaleId) ?? [];
    list.push(l);
    levelsByScale.set(l.scaleId, list);
  }
  /**
   * Archived observations are kept, not dropped. A past evaluation may already
   * have selected one, and hiding it would make that evaluation read as if the
   * tag had never been chosen. The rail shows an archived tag only when it is
   * already selected, and never offers it as a new choice.
   */
  const optionsByCompetency = new Map<string, typeof optionRows>();
  for (const o of optionRows) {
    const list = optionsByCompetency.get(o.competencyId) ?? [];
    list.push(o);
    optionsByCompetency.set(o.competencyId, list);
  }

  const stagesOut = stageRows.map((stage) => {
    const run = runs.find((r) => r.stageId === stage.id) ?? null;
    const sourceRunId = runIdForStage.get(stage.id);

    const acts = activityRows
      .filter((a) => a.stageId === stage.id)
      .map((activity) => {
        const response =
          responseRows.find(
            (r) => r.activityId === activity.id && r.stageRunId === sourceRunId,
          ) ?? null;
        const media =
          mediaRows.find(
            (m) =>
              m.media.activityId === activity.id &&
              m.media.stageRunId === sourceRunId,
          ) ?? null;
        return {
          ...activity,
          response,
          media: media?.media ?? null,
          transcript: media?.transcript ?? null,
        };
      });

    const comps = competencyRows.length
      ? linkRows
          .filter((l) => l.stageId === stage.id)
          .map((link) => {
            const competency = byCompetency.get(link.competencyId);
            if (!competency) return null;
            const item =
              itemRows.find(
                (i) =>
                  i.competencyId === competency.id && i.stageId === stage.id,
              ) ?? null;
            const revisions = item
              ? revisionRows
                  .filter((r) => r.revision.evaluationItemId === item.id)
                  .map((r) => ({
                    at: r.revision.at,
                    score: r.revision.score,
                    optionCount: (r.revision.selectedOptionIds ?? []).length,
                    hasNote: Boolean(r.revision.note),
                    byName: r.byName,
                  }))
              : [];

            return {
              id: competency.id,
              name: competency.name,
              description: competency.description,
              revisions,
              levels: levelsByScale.get(competency.scaleId) ?? [],
              options: optionsByCompetency.get(competency.id) ?? [],
              score: item?.score ?? null,
              selectedOptionIds: item?.selectedOptionIds ?? [],
              note: item?.note ?? null,
            };
          })
          .filter((c) => c !== null)
      : [];

    return {
      id: stage.id,
      name: stage.name,
      description: stage.description,
      // Manager-only. Never sent to a candidate route.
      internalPurpose: stage.internalPurpose,
      internalObjective: stage.internalObjective,
      orderIndex: stage.orderIndex,
      run,
      isCarried: Boolean(run?.carriedFromStageRunId),
      activities: acts,
      competencies: comps,
      events: eventRows.filter((e) => e.stageRunId === sourceRunId),
    };
  });

  return {
    head,
    attempts: attemptRows,
    activeAttempt: active as typeof active | null,
    evaluation: evaluation as typeof evaluation | null,
    stages: stagesOut,
  };
}

export type ReviewData = NonNullable<Awaited<ReturnType<typeof loadReview>>>;
export type ReviewStage = ReviewData["stages"][number];


/**
 * Where this candidate sits in the review queue, and who is either side.
 *
 * Reviewing is a batch job: the manager sits down with four people waiting and
 * works through them. Sending them back to the list between each one loses the
 * thread and the position in the queue, so the queue travels with them.
 *
 * The order is the same one the dashboard queue shows, so "4 adaydan 2." means
 * the second of the four they were just looking at.
 */
export async function loadReviewQueue(assessmentId: string, orgId: string) {
  const { loadAssessmentRows } = await import("@/lib/manager-data");
  const rows = await loadAssessmentRows(orgId);

  // Only candidates who actually have something to review belong in the queue.
  const queue = rows.filter((row) => row.attemptId !== null);
  const index = queue.findIndex((row) => row.assessmentId === assessmentId);
  if (index === -1) return null;

  const link = (row: (typeof queue)[number]) =>
    `/candidates/${row.candidateId}/review?assessment=${row.assessmentId}`;

  return {
    position: index + 1,
    total: queue.length,
    previousHref: index > 0 ? link(queue[index - 1]) : null,
    nextHref: index < queue.length - 1 ? link(queue[index + 1]) : null,
  };
}
