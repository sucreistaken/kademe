/**
 * Read model for the manager screens.
 *
 * The four screens (dashboard, candidate table, comparison, candidate detail)
 * all answer the same underlying question: where is each candidate and what is
 * the next concrete action. So they share one loader rather than each growing
 * its own slightly different joins, which is how two screens start disagreeing
 * about whether someone has been scored.
 *
 * Volumes here are small by design: one organisation, one hiring pipeline. The
 * loader fetches a handful of narrow result sets and assembles them in memory
 * instead of building one wide join that nobody can read.
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  assessmentLinks,
  assessments,
  attempts,
  candidates,
  competencies,
  decisions,
  evaluationItems,
  evaluations,
  mediaAssets,
  positions,
  responses,
  stageRuns,
  stages,
  technicalEvents,
  templateVersions,
  templates,
  transcripts,
} from "@/db/schema";
import type {
  I18nText,
  ResponsePayload,
  decisionStatus,
  linkStatus,
  activityType,
  runCompletion,
  technicalEventType,
} from "@/db/schema";
import { averageScore, overallScore, type CompetencyScore } from "./scoring";

type LinkStatus = (typeof linkStatus.enumValues)[number];
type DecisionStatus = (typeof decisionStatus.enumValues)[number];
type ActivityType = (typeof activityType.enumValues)[number];
type RunCompletion = (typeof runCompletion.enumValues)[number];
type EventType = (typeof technicalEventType.enumValues)[number];

export type CompetencyScoreView = {
  competencyId: string;
  name: I18nText;
  /** null is "not scored", which is not the same as a low score. */
  score: number | null;
};

export type AssessmentRow = {
  assessmentId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  positionId: string;
  positionName: string;
  templateId: string;
  versionId: string;
  invitedAt: Date;
  linkId: string | null;
  linkStatus: LinkStatus | null;
  linkExpiresAt: Date | null;
  attemptId: string | null;
  attemptNumber: number;
  attemptCount: number;
  attemptCompletedAt: Date | null;
  stagesTotal: number;
  stagesCompleted: number;
  /** A stage is open right now: the candidate is mid-assessment. */
  isRecording: boolean;
  /** Latest thing that happened on the candidate side. Drives "2 gün bekliyor". */
  lastActivityAt: Date | null;
  evaluationId: string | null;
  evaluationSubmittedAt: Date | null;
  competencyScores: CompetencyScoreView[];
  overall: number | null;
  decisionStatus: DecisionStatus | null;
  decidedAt: Date | null;
};

/**
 * One label per candidate, used by both the dashboard queue and the table so
 * the two screens can never disagree.
 */
export type PipelineState =
  | "NOT_STARTED"
  | "EXPIRED"
  | "IN_PROGRESS"
  | "NOT_WATCHED"
  | "PARTIALLY_SCORED"
  | "SCORED"
  | "DECIDED";

export function pipelineState(row: AssessmentRow, now = new Date()): PipelineState {
  if (row.decisionStatus && row.decisionStatus !== "NEW" && row.decisionStatus !== "IN_REVIEW") {
    return "DECIDED";
  }
  if (!row.attemptId) {
    if (row.linkExpiresAt && row.linkExpiresAt.getTime() < now.getTime()) return "EXPIRED";
    return "NOT_STARTED";
  }
  if (row.isRecording) return "IN_PROGRESS";
  if (!row.evaluationId) return "NOT_WATCHED";
  if (!row.evaluationSubmittedAt) return "PARTIALLY_SCORED";
  return "SCORED";
}

export const PIPELINE_LABEL: Record<PipelineState, string> = {
  NOT_STARTED: "Başlamadı",
  EXPIRED: "Süresi doldu",
  IN_PROGRESS: "Şu anda kayıtta",
  NOT_WATCHED: "İzlenmedi",
  PARTIALLY_SCORED: "Yarım puanlandı",
  SCORED: "Puanlandı",
  DECIDED: "Karar verildi",
};

export const DECISION_LABEL: Record<DecisionStatus, string> = {
  NEW: "Karar bekliyor",
  IN_REVIEW: "İncelemede",
  SHORTLISTED: "Sonraki tura",
  INTERVIEW: "Görüşmeye çağrıldı",
  RETAKE_REQUESTED: "Tekrar istendi",
  ACCEPTED: "Teklif verildi",
  REJECTED: "Bu turda değil",
  ON_HOLD: "Beklemede",
};

/** Waiting for the manager to do something. Drives the dashboard queue. */
export function needsReview(state: PipelineState): boolean {
  return state === "NOT_WATCHED" || state === "PARTIALLY_SCORED";
}

/* ------------------------------------------------------------------ */
/* Loader                                                              */
/* ------------------------------------------------------------------ */

export async function loadAssessmentRows(orgId: string): Promise<AssessmentRow[]> {
  const base = await db
    .select({
      assessmentId: assessments.id,
      createdAt: assessments.createdAt,
      candidateId: candidates.id,
      candidateName: candidates.fullName,
      candidateEmail: candidates.email,
      versionId: templateVersions.id,
      templateId: templates.id,
      positionId: positions.id,
      positionName: positions.name,
    })
    .from(assessments)
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .innerJoin(templateVersions, eq(templateVersions.id, assessments.versionId))
    .innerJoin(templates, eq(templates.id, templateVersions.templateId))
    .innerJoin(positions, eq(positions.id, templates.positionId))
    .where(and(eq(assessments.orgId, orgId), isNull(candidates.deletedAt)));

  if (base.length === 0) return [];

  const assessmentIds = base.map((r) => r.assessmentId);
  const versionIds = [...new Set(base.map((r) => r.versionId))];

  const [linkRows, attemptRows, stageRows, decisionRows, competencyRows] =
    await Promise.all([
      db
        .select({
          id: assessmentLinks.id,
          assessmentId: assessmentLinks.assessmentId,
          status: assessmentLinks.status,
          expiresAt: assessmentLinks.expiresAt,
          createdAt: assessmentLinks.createdAt,
        })
        .from(assessmentLinks)
        .where(inArray(assessmentLinks.assessmentId, assessmentIds)),
      db
        .select({
          id: attempts.id,
          assessmentId: attempts.assessmentId,
          attemptNumber: attempts.attemptNumber,
          isPrimary: attempts.isPrimary,
          completedAt: attempts.completedAt,
        })
        .from(attempts)
        .where(inArray(attempts.assessmentId, assessmentIds)),
      db
        .select({ id: stages.id, versionId: stages.versionId })
        .from(stages)
        .where(inArray(stages.versionId, versionIds)),
      db
        .select({
          assessmentId: decisions.assessmentId,
          status: decisions.status,
          at: decisions.at,
        })
        .from(decisions)
        .where(inArray(decisions.assessmentId, assessmentIds)),
      db
        .select({ id: competencies.id, name: competencies.name })
        .from(competencies)
        .where(eq(competencies.orgId, orgId)),
    ]);

  const primaryAttempts = attemptRows.filter((a) => a.isPrimary);
  const attemptIds = primaryAttempts.map((a) => a.id);

  const [runRows, evaluationRows] = await Promise.all([
    attemptIds.length
      ? db
          .select({
            id: stageRuns.id,
            attemptId: stageRuns.attemptId,
            completion: stageRuns.completion,
            startedAt: stageRuns.startedAt,
            submittedAt: stageRuns.submittedAt,
            lastHeartbeatAt: stageRuns.lastHeartbeatAt,
          })
          .from(stageRuns)
          .where(inArray(stageRuns.attemptId, attemptIds))
      : Promise.resolve([]),
    attemptIds.length
      ? db
          .select({
            id: evaluations.id,
            attemptId: evaluations.attemptId,
            submittedAt: evaluations.submittedAt,
          })
          .from(evaluations)
          .where(inArray(evaluations.attemptId, attemptIds))
      : Promise.resolve([]),
  ]);

  const evaluationIds = evaluationRows.map((e) => e.id);
  const itemRows = evaluationIds.length
    ? await db
        .select({
          evaluationId: evaluationItems.evaluationId,
          competencyId: evaluationItems.competencyId,
          score: evaluationItems.score,
        })
        .from(evaluationItems)
        .where(inArray(evaluationItems.evaluationId, evaluationIds))
    : [];

  /* ---- index everything once ---- */
  const competencyName = new Map(competencyRows.map((c) => [c.id, c.name]));

  const stagesPerVersion = new Map<string, number>();
  for (const stage of stageRows) {
    stagesPerVersion.set(stage.versionId, (stagesPerVersion.get(stage.versionId) ?? 0) + 1);
  }

  // A partial unique index (drizzle/sql/0002_single_active_link.sql) guarantees
  // at most one non-EXPIRED link per assessment, so the live one is always the
  // authoritative one. Superseded links stay as EXPIRED rows for the audit
  // trail; we fall back to the newest of those so a lapsed invitation still
  // renders as "süresi doldu" instead of silently reading as never sent.
  const authoritativeLink = new Map<string, (typeof linkRows)[number]>();
  for (const link of linkRows) {
    const current = authoritativeLink.get(link.assessmentId);
    if (!current) {
      authoritativeLink.set(link.assessmentId, link);
      continue;
    }
    const currentIsLive = current.status !== "EXPIRED";
    const candidateIsLive = link.status !== "EXPIRED";
    if (candidateIsLive && !currentIsLive) {
      authoritativeLink.set(link.assessmentId, link);
    } else if (candidateIsLive === currentIsLive && link.createdAt > current.createdAt) {
      authoritativeLink.set(link.assessmentId, link);
    }
  }

  const attemptsByAssessment = new Map<string, typeof attemptRows>();
  for (const attempt of attemptRows) {
    const list = attemptsByAssessment.get(attempt.assessmentId) ?? [];
    list.push(attempt);
    attemptsByAssessment.set(attempt.assessmentId, list);
  }

  const runsByAttempt = new Map<string, typeof runRows>();
  for (const run of runRows) {
    const list = runsByAttempt.get(run.attemptId) ?? [];
    list.push(run);
    runsByAttempt.set(run.attemptId, list);
  }

  const evaluationByAttempt = new Map(evaluationRows.map((e) => [e.attemptId, e]));

  const itemsByEvaluation = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const list = itemsByEvaluation.get(item.evaluationId) ?? [];
    list.push(item);
    itemsByEvaluation.set(item.evaluationId, list);
  }

  const latestDecision = new Map<string, (typeof decisionRows)[number]>();
  for (const decision of decisionRows) {
    const current = latestDecision.get(decision.assessmentId);
    if (!current || decision.at > current.at) latestDecision.set(decision.assessmentId, decision);
  }

  /* ---- assemble ---- */
  return base.map((row) => {
    const link = authoritativeLink.get(row.assessmentId) ?? null;
    const allAttempts = attemptsByAssessment.get(row.assessmentId) ?? [];
    const attempt = allAttempts.find((a) => a.isPrimary) ?? null;
    const runs = attempt ? (runsByAttempt.get(attempt.id) ?? []) : [];
    const evaluation = attempt ? (evaluationByAttempt.get(attempt.id) ?? null) : null;
    const items = evaluation ? (itemsByEvaluation.get(evaluation.id) ?? []) : [];
    const decision = latestDecision.get(row.assessmentId) ?? null;

    const competencyScores = summariseCompetencies(items, competencyName);

    const timestamps = runs
      .map((r) => r.submittedAt ?? r.lastHeartbeatAt ?? r.startedAt)
      .filter((d): d is Date => d !== null);

    return {
      assessmentId: row.assessmentId,
      candidateId: row.candidateId,
      candidateName: row.candidateName ?? "İsimsiz aday",
      candidateEmail: row.candidateEmail,
      positionId: row.positionId,
      positionName: row.positionName,
      templateId: row.templateId,
      versionId: row.versionId,
      invitedAt: row.createdAt,
      linkId: link?.id ?? null,
      linkStatus: link?.status ?? null,
      linkExpiresAt: link?.expiresAt ?? null,
      attemptId: attempt?.id ?? null,
      attemptNumber: attempt?.attemptNumber ?? 0,
      attemptCount: allAttempts.length,
      attemptCompletedAt: attempt?.completedAt ?? null,
      stagesTotal: stagesPerVersion.get(row.versionId) ?? 0,
      stagesCompleted: runs.filter((r) => r.completion === "COMPLETE").length,
      isRecording: runs.some((r) => r.startedAt !== null && r.submittedAt === null && r.completion === "PENDING"),
      lastActivityAt: timestamps.length
        ? new Date(Math.max(...timestamps.map((d) => d.getTime())))
        : null,
      evaluationId: evaluation?.id ?? null,
      evaluationSubmittedAt: evaluation?.submittedAt ?? null,
      competencyScores,
      overall: overallScore(
        competencyScores.map<CompetencyScore>((c) => ({
          competencyId: c.competencyId,
          score: c.score,
        })),
        null,
      ),
      decisionStatus: decision?.status ?? null,
      decidedAt: decision?.at ?? null,
    };
  });
}

/**
 * A competency can be scored in more than one stage. The competency level score
 * is the average of those, and the overall is the average of the competencies,
 * so a competency measured in three stages does not outvote one measured once.
 */
function summariseCompetencies(
  items: Array<{ competencyId: string; score: number | null }>,
  names: Map<string, I18nText>,
): CompetencyScoreView[] {
  const grouped = new Map<string, CompetencyScore[]>();
  for (const item of items) {
    const list = grouped.get(item.competencyId) ?? [];
    list.push({ competencyId: item.competencyId, score: item.score });
    grouped.set(item.competencyId, list);
  }
  return [...grouped.entries()].map(([competencyId, scores]) => ({
    competencyId,
    name: names.get(competencyId) ?? { tr: "Bilinmeyen yetkinlik", en: "Unknown competency" },
    score: averageScore(scores),
  }));
}

/* ------------------------------------------------------------------ */
/* Position list, for the dashboard sidebar and the table header       */
/* ------------------------------------------------------------------ */

export type PositionRow = {
  id: string;
  name: string;
  candidateCount: number;
  hasPublishedVersion: boolean;
};

export async function loadPositions(
  orgId: string,
  rows: AssessmentRow[],
): Promise<PositionRow[]> {
  const positionRows = await db
    .select({
      id: positions.id,
      name: positions.name,
      versionStatus: templateVersions.status,
    })
    .from(positions)
    .leftJoin(templates, eq(templates.positionId, positions.id))
    .leftJoin(templateVersions, eq(templateVersions.templateId, templates.id))
    .where(and(eq(positions.orgId, orgId), isNull(positions.archivedAt)));

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.positionId, (counts.get(row.positionId) ?? 0) + 1);
  }

  const merged = new Map<string, PositionRow>();
  for (const row of positionRows) {
    const existing = merged.get(row.id);
    const published = row.versionStatus === "PUBLISHED";
    if (existing) {
      existing.hasPublishedVersion = existing.hasPublishedVersion || published;
      continue;
    }
    merged.set(row.id, {
      id: row.id,
      name: row.name,
      candidateCount: counts.get(row.id) ?? 0,
      hasPublishedVersion: published,
    });
  }
  return [...merged.values()];
}

/* ------------------------------------------------------------------ */
/* Candidate detail (Y7)                                               */
/* ------------------------------------------------------------------ */

export type DetailActivity = {
  activityId: string;
  type: ActivityType;
  prompt: I18nText;
  /** Present for VIDEO and AUDIO answers. */
  media: { id: string; durationMs: number | null; hasTranscript: boolean } | null;
  transcriptExcerpt: string | null;
  text: string | null;
};

export type DetailStage = {
  stageRunId: string | null;
  stageId: string;
  orderIndex: number;
  name: I18nText;
  completion: RunCompletion | null;
  activities: DetailActivity[];
  /** Average of this stage's competency scores, or null if it is unscored. */
  average: number | null;
};

export type DetailAttempt = {
  id: string;
  attemptNumber: number;
  isPrimary: boolean;
  createdReason: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

export type CandidateDetail = {
  row: AssessmentRow;
  attempts: DetailAttempt[];
  stages: DetailStage[];
  events: Array<{ id: string; type: EventType; at: Date; meta: Record<string, unknown> | null }>;
  decisions: Array<{ status: DecisionStatus; note: string | null; at: Date }>;
};

export async function loadCandidateDetail(
  orgId: string,
  candidateId: string,
): Promise<CandidateDetail | null> {
  const rows = await loadAssessmentRows(orgId);
  const row = rows.find((r) => r.candidateId === candidateId);
  if (!row) return null;

  const [attemptRows, stageRows] = await Promise.all([
    db
      .select({
        id: attempts.id,
        attemptNumber: attempts.attemptNumber,
        isPrimary: attempts.isPrimary,
        createdReason: attempts.createdReason,
        startedAt: attempts.startedAt,
        completedAt: attempts.completedAt,
      })
      .from(attempts)
      .where(eq(attempts.assessmentId, row.assessmentId)),
    db
      .select({
        id: stages.id,
        orderIndex: stages.orderIndex,
        name: stages.name,
      })
      .from(stages)
      .where(eq(stages.versionId, row.versionId)),
  ]);

  attemptRows.sort((a, b) => b.attemptNumber - a.attemptNumber);
  stageRows.sort((a, b) => a.orderIndex - b.orderIndex);

  const stageIds = stageRows.map((s) => s.id);
  const activityRows = stageIds.length
    ? await db
        .select({
          id: activities.id,
          stageId: activities.stageId,
          orderIndex: activities.orderIndex,
          type: activities.type,
          candidatePrompt: activities.candidatePrompt,
        })
        .from(activities)
        .where(inArray(activities.stageId, stageIds))
    : [];
  activityRows.sort((a, b) => a.orderIndex - b.orderIndex);

  const runRows = row.attemptId
    ? await db
        .select({
          id: stageRuns.id,
          stageId: stageRuns.stageId,
          completion: stageRuns.completion,
        })
        .from(stageRuns)
        .where(eq(stageRuns.attemptId, row.attemptId))
    : [];

  const runIds = runRows.map((r) => r.id);
  const [responseRows, mediaRows, eventRows, decisionRows] = await Promise.all([
    runIds.length
      ? db
          .select({
            activityId: responses.activityId,
            payload: responses.payload,
          })
          .from(responses)
          .where(inArray(responses.stageRunId, runIds))
      : Promise.resolve([]),
    runIds.length
      ? db
          .select({
            id: mediaAssets.id,
            activityId: mediaAssets.activityId,
            durationMs: mediaAssets.durationMs,
            transcriptId: transcripts.id,
          })
          .from(mediaAssets)
          .leftJoin(transcripts, eq(transcripts.mediaAssetId, mediaAssets.id))
          .where(inArray(mediaAssets.stageRunId, runIds))
      : Promise.resolve([]),
    // Technical events of every attempt, not just the primary one: the dropped
    // first attempt is exactly what the manager wants to see here.
    db
      .select({
        id: technicalEvents.id,
        type: technicalEvents.type,
        at: technicalEvents.at,
        meta: technicalEvents.meta,
        stageRunId: technicalEvents.stageRunId,
      })
      .from(technicalEvents)
      .innerJoin(stageRuns, eq(stageRuns.id, technicalEvents.stageRunId))
      .innerJoin(attempts, eq(attempts.id, stageRuns.attemptId))
      .where(eq(attempts.assessmentId, row.assessmentId)),
    db
      .select({ status: decisions.status, note: decisions.note, at: decisions.at })
      .from(decisions)
      .where(eq(decisions.assessmentId, row.assessmentId)),
  ]);

  const transcriptTexts = new Map<string, string>();
  const withTranscript = mediaRows.filter((m) => m.transcriptId);
  if (withTranscript.length) {
    const texts = await db
      .select({ mediaAssetId: transcripts.mediaAssetId, text: transcripts.text })
      .from(transcripts)
      .where(inArray(transcripts.mediaAssetId, withTranscript.map((m) => m.id)));
    for (const t of texts) transcriptTexts.set(t.mediaAssetId, t.text);
  }

  const runByStage = new Map(runRows.map((r) => [r.stageId, r]));
  const responseByActivity = new Map(
    responseRows.map((r) => [r.activityId, r.payload as ResponsePayload]),
  );
  const mediaByActivity = new Map(
    mediaRows.filter((m) => m.activityId).map((m) => [m.activityId as string, m]),
  );

  // Per stage competency averages, so each stage block can carry its own number.
  const stageAverages = new Map<string, number | null>();
  if (row.evaluationId) {
    const items = await db
      .select({
        stageId: evaluationItems.stageId,
        competencyId: evaluationItems.competencyId,
        score: evaluationItems.score,
      })
      .from(evaluationItems)
      .where(eq(evaluationItems.evaluationId, row.evaluationId));
    for (const stage of stageRows) {
      const forStage = items.filter((i) => i.stageId === stage.id);
      stageAverages.set(
        stage.id,
        forStage.length
          ? averageScore(
              forStage.map((i) => ({ competencyId: i.competencyId, score: i.score })),
            )
          : null,
      );
    }
  }

  const detailStages: DetailStage[] = stageRows.map((stage) => {
    const run = runByStage.get(stage.id) ?? null;
    return {
      stageRunId: run?.id ?? null,
      stageId: stage.id,
      orderIndex: stage.orderIndex,
      name: stage.name,
      completion: run?.completion ?? null,
      average: stageAverages.get(stage.id) ?? null,
      activities: activityRows
        .filter((a) => a.stageId === stage.id)
        .map((activity) => {
          const payload = responseByActivity.get(activity.id);
          const media = mediaByActivity.get(activity.id);
          const transcript = media ? (transcriptTexts.get(media.id) ?? null) : null;
          return {
            activityId: activity.id,
            type: activity.type,
            prompt: activity.candidatePrompt,
            media: media
              ? {
                  id: media.id,
                  durationMs: media.durationMs,
                  hasTranscript: Boolean(media.transcriptId),
                }
              : null,
            transcriptExcerpt: transcript,
            text: payload?.text ?? null,
          };
        }),
    };
  });

  decisionRows.sort((a, b) => b.at.getTime() - a.at.getTime());
  eventRows.sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    row,
    attempts: attemptRows,
    stages: detailStages,
    events: eventRows.map(({ id, type, at, meta }) => ({ id, type, at, meta })),
    decisions: decisionRows,
  };
}
