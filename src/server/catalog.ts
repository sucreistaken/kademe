import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  positions,
  templates,
  templateVersions,
  stages,
  activities,
  stageCompetencies,
  competencies,
  assessments,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth";

/**
 * Position list with the counts the manager actually needs.
 *
 * Deliberately three grouped queries rather than correlated subqueries: inside
 * a raw sql`` template Drizzle emits a column reference unqualified, so
 * `where t.position_id = ${positions.id}` renders as `= "id"` and the query
 * fails at runtime. Joining in JS is both correct and easier to read.
 */
export async function loadPositions(orgId: string) {
  const rows = await db
    .select({
      id: positions.id,
      name: positions.name,
      shortDescription: positions.shortDescription,
      archivedAt: positions.archivedAt,
      createdAt: positions.createdAt,
    })
    .from(positions)
    .where(eq(positions.orgId, orgId))
    .orderBy(asc(positions.archivedAt), desc(positions.createdAt));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [templateCounts, publishedCounts, candidateCounts] = await Promise.all([
    db
      .select({
        positionId: templates.positionId,
        count: sql<number>`count(*)::int`,
      })
      .from(templates)
      .where(inArray(templates.positionId, ids))
      .groupBy(templates.positionId),
    db
      .select({
        positionId: templates.positionId,
        count: sql<number>`count(*)::int`,
      })
      .from(templateVersions)
      .innerJoin(templates, eq(templates.id, templateVersions.templateId))
      .where(
        and(
          inArray(templates.positionId, ids),
          eq(templateVersions.status, "PUBLISHED"),
        ),
      )
      .groupBy(templates.positionId),
    db
      .select({
        positionId: templates.positionId,
        count: sql<number>`count(*)::int`,
      })
      .from(assessments)
      .innerJoin(templateVersions, eq(templateVersions.id, assessments.versionId))
      .innerJoin(templates, eq(templates.id, templateVersions.templateId))
      .where(inArray(templates.positionId, ids))
      .groupBy(templates.positionId),
  ]);

  const lookup = (
    list: Array<{ positionId: string; count: number }>,
    id: string,
  ) => list.find((r) => r.positionId === id)?.count ?? 0;

  return rows.map((row) => ({
    ...row,
    templateCount: lookup(templateCounts, row.id),
    publishedCount: lookup(publishedCounts, row.id),
    candidateCount: lookup(candidateCounts, row.id),
  }));
}

export async function loadPosition(id: string, orgId: string) {
  const [position] = await db
    .select()
    .from(positions)
    .where(and(eq(positions.id, id), eq(positions.orgId, orgId)))
    .limit(1);
  if (!position) return null;

  const templateRows = await db
    .select({
      id: templates.id,
      name: templates.name,
      archivedAt: templates.archivedAt,
      createdAt: templates.createdAt,
    })
    .from(templates)
    .where(eq(templates.positionId, id))
    // Archived last, newest first inside each group, so the live templates are
    // what the manager sees when the page opens.
    .orderBy(asc(templates.archivedAt), desc(templates.createdAt));

  const versionRows = templateRows.length
    ? await db
        .select({
          id: templateVersions.id,
          templateId: templateVersions.templateId,
          versionNumber: templateVersions.versionNumber,
          status: templateVersions.status,
          publishedAt: templateVersions.publishedAt,
        })
        .from(templateVersions)
        .where(
          inArray(
            templateVersions.templateId,
            templateRows.map((t) => t.id),
          ),
        )
        .orderBy(desc(templateVersions.versionNumber))
    : [];

  const versionIds = versionRows.map((v) => v.id);
  const [stageCounts, candidateCounts] = await Promise.all([
    versionIds.length
      ? db
          .select({ versionId: stages.versionId, count: sql<number>`count(*)::int` })
          .from(stages)
          .where(inArray(stages.versionId, versionIds))
          .groupBy(stages.versionId)
      : [],
    versionIds.length
      ? db
          .select({
            versionId: assessments.versionId,
            count: sql<number>`count(*)::int`,
          })
          .from(assessments)
          .where(inArray(assessments.versionId, versionIds))
          .groupBy(assessments.versionId)
      : [],
  ]);

  return {
    position,
    templates: templateRows.map((t) => ({
      ...t,
      versions: versionRows
        .filter((v) => v.templateId === t.id)
        .map((v) => ({
          ...v,
          stageCount: stageCounts.find((s) => s.versionId === v.id)?.count ?? 0,
          candidateCount:
            candidateCounts.find((c) => c.versionId === v.id)?.count ?? 0,
        })),
    })),
  };
}

/**
 * The whole tree the builder edits. Loads the internal fields too: this is the
 * manager surface, and the internal/candidate split is the point of the screen.
 */
export async function loadVersionTree(versionId: string, user: SessionUser) {
  const [version] = await db
    .select({
      id: templateVersions.id,
      versionNumber: templateVersions.versionNumber,
      status: templateVersions.status,
      defaultLocale: templateVersions.defaultLocale,
      localeSet: templateVersions.localeSet,
      introTitle: templateVersions.introTitle,
      introBody: templateVersions.introBody,
      templateId: templates.id,
      templateName: templates.name,
      positionId: positions.id,
      positionName: positions.name,
      jobDescription: positions.jobDescription,
    })
    .from(templateVersions)
    .innerJoin(templates, eq(templates.id, templateVersions.templateId))
    .innerJoin(positions, eq(positions.id, templates.positionId))
    .where(
      and(
        eq(templateVersions.id, versionId),
        eq(templateVersions.orgId, user.orgId),
      ),
    )
    .limit(1);
  if (!version) return null;

  const stageRows = await db
    .select()
    .from(stages)
    .where(eq(stages.versionId, versionId))
    .orderBy(asc(stages.orderIndex));

  const stageIds = stageRows.map((s) => s.id);
  const [activityRows, linkRows, competencyRows] = await Promise.all([
    stageIds.length
      ? db
          .select()
          .from(activities)
          .where(inArray(activities.stageId, stageIds))
          .orderBy(asc(activities.orderIndex))
      : [],
    stageIds.length
      ? db
          .select()
          .from(stageCompetencies)
          .where(inArray(stageCompetencies.stageId, stageIds))
          .orderBy(asc(stageCompetencies.orderIndex))
      : [],
    db
      .select({ id: competencies.id, name: competencies.name })
      .from(competencies)
      .where(
        and(
          eq(competencies.orgId, user.orgId),
          sql`${competencies.archivedAt} is null`,
        ),
      )
      .orderBy(sql`${competencies.name}->>'tr'`),
  ]);

  return {
    version,
    library: competencyRows,
    stages: stageRows.map((stage) => ({
      ...stage,
      activities: activityRows.filter((a) => a.stageId === stage.id),
      competencyIds: linkRows
        .filter((l) => l.stageId === stage.id)
        .map((l) => l.competencyId),
    })),
  };
}

export type VersionTree = NonNullable<Awaited<ReturnType<typeof loadVersionTree>>>;
