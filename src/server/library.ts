import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  competencies,
  competencyAnchors,
  observationTags,
  positionCompetencies,
  positions,
  ratingScales,
  scaleLevels,
  type I18nText,
} from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { missingAnchorLevels } from "@/lib/library/anchors";
import { groupUsage, type SolutionUsage } from "@/lib/library/usage";
import { solutionModules } from "@/solutions/registry.server";
import type { LibraryRefs } from "@/solutions/types";

/**
 * Read model for the organisation library (core: no solution table here).
 * Foreign keys between library tables are single-column, so a link can point
 * at another organisation's row. Every query therefore scopes by org itself,
 * including the ones that join or follow a link.
 */

export type ScaleView = {
  id: string;
  name: string;
  minValue: number;
  maxValue: number;
  levels: Array<{ value: number; label: I18nText }>;
};

export async function loadDefaultScale(orgId: string): Promise<ScaleView | null> {
  const [scale] = await db
    .select()
    .from(ratingScales)
    .where(and(eq(ratingScales.orgId, orgId), eq(ratingScales.isDefault, true)))
    .limit(1);
  if (!scale) return null;
  const levels = await db
    .select({ value: scaleLevels.value, label: scaleLevels.label })
    .from(scaleLevels)
    .where(eq(scaleLevels.scaleId, scale.id))
    .orderBy(asc(scaleLevels.value));
  return { id: scale.id, name: scale.name, minValue: scale.minValue, maxValue: scale.maxValue, levels };
}

export type CompetencyRow = {
  id: string;
  name: I18nText;
  seededUnreviewed: boolean;
  archivedAt: Date | null;
  missingLevels: number[];
  positiveTags: number;
  negativeTags: number;
};

export async function listCompetencies(orgId: string): Promise<CompetencyRow[]> {
  const rows = await db.select().from(competencies).where(eq(competencies.orgId, orgId)).orderBy(asc(competencies.createdAt));
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];
  const [anchors, tags] = await Promise.all([
    db.select().from(competencyAnchors).where(inArray(competencyAnchors.competencyId, ids)),
    db
      .select({ competencyId: observationTags.competencyId, polarity: observationTags.polarity })
      .from(observationTags)
      .where(and(inArray(observationTags.competencyId, ids), isNull(observationTags.archivedAt))),
  ]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    seededUnreviewed: r.seedKey !== null && r.reviewedAt === null,
    archivedAt: r.archivedAt,
    missingLevels: missingAnchorLevels(
      Object.fromEntries(anchors.filter((a) => a.competencyId === r.id).map((a) => [a.value, a.body])),
    ),
    positiveTags: tags.filter((t) => t.competencyId === r.id && t.polarity === "POSITIVE").length,
    negativeTags: tags.filter((t) => t.competencyId === r.id && t.polarity === "NEGATIVE").length,
  }));
}

export type CompetencyDetail = {
  id: string;
  name: I18nText;
  description: I18nText;
  seededUnreviewed: boolean;
  archivedAt: Date | null;
  anchors: Partial<Record<number, I18nText>>;
  tags: Array<{ id: string; polarity: "POSITIVE" | "NEGATIVE"; label: I18nText }>;
};

export async function loadCompetency(orgId: string, id: string): Promise<CompetencyDetail | null> {
  const [row] = await db
    .select()
    .from(competencies)
    .where(and(eq(competencies.id, id), eq(competencies.orgId, orgId)))
    .limit(1);
  if (!row) return null;
  const [anchors, tags] = await Promise.all([
    db.select().from(competencyAnchors).where(eq(competencyAnchors.competencyId, id)),
    db
      .select()
      .from(observationTags)
      .where(and(eq(observationTags.competencyId, id), isNull(observationTags.archivedAt)))
      .orderBy(asc(observationTags.orderIndex)),
  ]);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    seededUnreviewed: row.seedKey !== null && row.reviewedAt === null,
    archivedAt: row.archivedAt,
    anchors: Object.fromEntries(anchors.map((a) => [a.value, a.body])),
    tags: tags.map((t) => ({ id: t.id, polarity: t.polarity, label: t.label })),
  };
}

/** Competencies a new profile row or question may pick: not archived. */
export async function activeCompetencyOptions(orgId: string): Promise<Array<{ id: string; name: I18nText }>> {
  return db
    .select({ id: competencies.id, name: competencies.name })
    .from(competencies)
    .where(and(eq(competencies.orgId, orgId), isNull(competencies.archivedAt)))
    .orderBy(asc(competencies.createdAt));
}

export type PositionRow = { id: string; name: string; team: string | null; competencyCount: number; archivedAt: Date | null };

export async function listPositions(orgId: string): Promise<PositionRow[]> {
  return db
    .select({
      id: positions.id,
      name: positions.name,
      team: positions.team,
      archivedAt: positions.archivedAt,
      // Only competencies of the same organisation count (the FK is single-column).
      competencyCount: sql<number>`(select count(*)::int from ${positionCompetencies} pc join ${competencies} c on c.id = pc.competency_id where pc.position_id = ${positions.id} and c.org_id = ${orgId})`,
    })
    .from(positions)
    .where(eq(positions.orgId, orgId))
    .orderBy(asc(positions.name));
}

export type PositionDetail = {
  id: string;
  name: string;
  team: string | null;
  shortDescription: string | null;
  jobDescription: string | null;
  skills: string[];
  languages: string[];
  archivedAt: Date | null;
  profile: Array<{ competencyId: string; name: I18nText; weight: number; expectedLevel: number | null; archived: boolean }>;
};

export async function loadPosition(orgId: string, id: string): Promise<PositionDetail | null> {
  const [row] = await db
    .select()
    .from(positions)
    .where(and(eq(positions.id, id), eq(positions.orgId, orgId)))
    .limit(1);
  if (!row) return null;
  const profile = await db
    .select({
      competencyId: positionCompetencies.competencyId,
      weight: positionCompetencies.weight,
      expectedLevel: positionCompetencies.expectedLevel,
      name: competencies.name,
      archivedAt: competencies.archivedAt,
    })
    .from(positionCompetencies)
    .innerJoin(
      competencies,
      and(eq(competencies.id, positionCompetencies.competencyId), eq(competencies.orgId, orgId)),
    )
    .where(eq(positionCompetencies.positionId, id))
    .orderBy(asc(positionCompetencies.orderIndex));
  return {
    id: row.id,
    name: row.name,
    team: row.team,
    shortDescription: row.shortDescription,
    jobDescription: row.jobDescription,
    skills: row.skills,
    languages: row.languages,
    archivedAt: row.archivedAt,
    profile: profile.map((p) => ({
      competencyId: p.competencyId,
      name: p.name,
      weight: p.weight,
      expectedLevel: p.expectedLevel,
      archived: p.archivedAt !== null,
    })),
  };
}

/** Asks every registered solution where these rows are used (contract hook, spec 3). */
export async function libraryUsage(orgId: string, refs: LibraryRefs, locale: Locale) {
  const results: SolutionUsage[] = await Promise.all(
    solutionModules()
      .filter((m) => m.library)
      .map(async (m) => ({ solution: m.key, label: m.label[locale], usage: await m.library!.usage(orgId, refs) })),
  );
  return groupUsage(results, refs);
}
