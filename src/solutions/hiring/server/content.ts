import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { isUuid } from "@/server/settings";
import {
  competencies,
  competencyAnchors,
  hiringActivities,
  hiringActivityCompetencies,
  hiringStages,
  hiringVersions,
  observationTags,
  positionCompetencies,
  positions,
  ratingScales,
  scaleLevels,
  type ScorecardSnapshot,
} from "@/db/schema";
import type { CompetencyFacts, VersionContent } from "../rules/content";

/**
 * Reads for the hiring rules. Every read takes the caller's organisation:
 * a version is found by id AND org_id, and its stages, questions and
 * competency links are read through that version only. Stages and questions
 * come in (order_index, id) order, so the rules see one deterministic order.
 */
export async function loadVersionContent(orgId: string, versionId: string, x: Executor = db): Promise<VersionContent | null> {
  // A malformed id is no row, not a 22P02 from the uuid cast.
  if (!isUuid(versionId)) return null;
  const [version] = await x
    .select()
    .from(hiringVersions)
    .where(and(eq(hiringVersions.id, versionId), eq(hiringVersions.orgId, orgId)))
    .limit(1);
  if (!version) return null;
  const stages = await x.select().from(hiringStages).where(eq(hiringStages.versionId, version.id)).orderBy(asc(hiringStages.orderIndex), asc(hiringStages.id));
  const stageIds = stages.map((st) => st.id);
  const activities = stageIds.length
    ? await x.select().from(hiringActivities).where(inArray(hiringActivities.stageId, stageIds)).orderBy(asc(hiringActivities.orderIndex), asc(hiringActivities.id))
    : [];
  const activityIds = activities.map((a) => a.id);
  const mappings = activityIds.length
    ? await x
        .select()
        .from(hiringActivityCompetencies)
        .where(inArray(hiringActivityCompetencies.activityId, activityIds))
        .orderBy(asc(hiringActivityCompetencies.activityId), asc(hiringActivityCompetencies.orderIndex))
    : [];
  return {
    id: version.id,
    number: version.versionNumber,
    status: version.status,
    defaultLocale: version.defaultLocale,
    localeSet: version.localeSet,
    weightsEnabled: version.weightsEnabled,
    draftWeights: version.draftWeights,
    previewedAt: version.previewedAt,
    stages: stages.map((st) => ({
      id: st.id,
      orderIndex: st.orderIndex,
      name: st.name,
      description: st.description,
      internalPurpose: st.internalPurpose,
      durationSeconds: st.durationSeconds,
      graceSeconds: st.graceSeconds,
      onTimeout: st.onTimeout,
      backNavigation: st.backNavigation,
      activities: activities
        .filter((a) => a.stageId === st.id)
        .map((a) => ({
          id: a.id,
          orderIndex: a.orderIndex,
          type: a.type,
          required: a.required,
          prompt: a.prompt,
          note: a.note,
          internalQuestion: a.internalQuestion,
          expectedBehaviours: a.expectedBehaviours,
          redFlags: a.redFlags,
          managerNotes: a.managerNotes,
          answerExamples: a.answerExamples,
          thinkSeconds: a.thinkSeconds,
          flexibleThink: a.flexibleThink,
          answerSeconds: a.answerSeconds,
          maxTakes: a.maxTakes,
          config: a.config,
          competencyIds: mappings.filter((m) => m.activityId === a.id).map((m) => m.competencyId),
        })),
    })),
  };
}

export async function loadCompetencyFacts(orgId: string, ids: string[], x: Executor = db): Promise<Map<string, CompetencyFacts>> {
  const wanted = ids.filter(isUuid);
  if (wanted.length === 0) return new Map();
  const rows = await x.select().from(competencies).where(and(eq(competencies.orgId, orgId), inArray(competencies.id, wanted)));
  const found = rows.map((r) => r.id);
  if (found.length === 0) return new Map();
  // Anchors and tags are read only for the competencies just proven to be the organisation's.
  const [anchors, tags] = await Promise.all([
    x.select().from(competencyAnchors).where(inArray(competencyAnchors.competencyId, found)),
    x.select().from(observationTags).where(inArray(observationTags.competencyId, found)).orderBy(asc(observationTags.orderIndex), asc(observationTags.id)),
  ]);
  return new Map(
    rows.map((c) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        archived: c.archivedAt !== null,
        anchors: Object.fromEntries(anchors.filter((a) => a.competencyId === c.id).map((a) => [a.value, a.body])),
        tags: tags
          .filter((t) => t.competencyId === c.id)
          .map((t) => ({ id: t.id, polarity: t.polarity, label: t.label, archived: t.archivedAt !== null })),
      },
    ]),
  );
}

export async function loadScaleSnapshot(orgId: string, x: Executor = db): Promise<ScorecardSnapshot["scale"]> {
  const [scale] = await x
    .select()
    .from(ratingScales)
    .where(and(eq(ratingScales.orgId, orgId), eq(ratingScales.isDefault, true)))
    .limit(1);
  if (!scale) throw new Error(`organisation ${orgId} has no default rating scale`);
  const levels = await x.select({ value: scaleLevels.value, label: scaleLevels.label }).from(scaleLevels).where(eq(scaleLevels.scaleId, scale.id)).orderBy(asc(scaleLevels.value));
  return { min: scale.minValue, max: scale.maxValue, levels };
}

/** The position's competency profile, read through a position of the caller's organisation. */
export async function positionProfile(orgId: string, positionId: string, x: Executor = db): Promise<Array<{ competencyId: string; weight: number }>> {
  if (!isUuid(positionId)) return [];
  return x
    .select({ competencyId: positionCompetencies.competencyId, weight: positionCompetencies.weight })
    .from(positionCompetencies)
    .innerJoin(positions, eq(positions.id, positionCompetencies.positionId))
    .where(and(eq(positionCompetencies.positionId, positionId), eq(positions.orgId, orgId)))
    .orderBy(asc(positionCompetencies.orderIndex), asc(positionCompetencies.competencyId));
}
