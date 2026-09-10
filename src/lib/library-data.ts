/**
 * Read model for the competency library.
 *
 * The library ships full: eight competencies, a written 1-5 scale and seven
 * observation chips each. That is what stops a new manager from meeting an
 * empty screen. But shipping it full is only half the promise; if none of it
 * can be edited, the product's claim that the manager designs their own
 * assessment is false. These screens are that other half.
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  competencies,
  evaluationOptions,
  ratingScales,
  scaleLevels,
  stageCompetencies,
} from "@/db/schema";
import type { I18nText, optionPolarity } from "@/db/schema";

type Polarity = (typeof optionPolarity.enumValues)[number];

export type OptionView = {
  id: string;
  polarity: Polarity;
  label: I18nText;
  orderIndex: number;
  archivedAt: Date | null;
};

export type CompetencyView = {
  id: string;
  name: I18nText;
  description: I18nText | null;
  scaleId: string;
  archivedAt: Date | null;
  positiveCount: number;
  negativeCount: number;
  /** How many stages across all template versions measure this competency. */
  usageCount: number;
};

export type ScaleView = {
  id: string;
  name: string;
  minValue: number;
  maxValue: number;
  levels: Array<{ id: string; value: number; label: I18nText; anchor: I18nText | null }>;
};

export type LibraryView = {
  competencies: CompetencyView[];
  archived: CompetencyView[];
  scale: ScaleView | null;
};

export async function loadLibrary(orgId: string): Promise<LibraryView> {
  const [competencyRows, scale] = await Promise.all([
    db.select().from(competencies).where(eq(competencies.orgId, orgId)),
    loadScale(orgId),
  ]);

  const ids = competencyRows.map((row) => row.id);
  const [optionRows, usageRows] = await Promise.all([
    ids.length
      ? db
          .select({
            competencyId: evaluationOptions.competencyId,
            polarity: evaluationOptions.polarity,
            archivedAt: evaluationOptions.archivedAt,
          })
          .from(evaluationOptions)
          .where(inArray(evaluationOptions.competencyId, ids))
      : Promise.resolve([]),
    ids.length
      ? db
          .select({ competencyId: stageCompetencies.competencyId })
          .from(stageCompetencies)
          .where(inArray(stageCompetencies.competencyId, ids))
      : Promise.resolve([]),
  ]);

  const usage = new Map<string, number>();
  for (const row of usageRows) {
    usage.set(row.competencyId, (usage.get(row.competencyId) ?? 0) + 1);
  }

  const views = competencyRows.map<CompetencyView>((row) => {
    const live = optionRows.filter(
      (option) => option.competencyId === row.id && option.archivedAt === null,
    );
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      scaleId: row.scaleId,
      archivedAt: row.archivedAt,
      positiveCount: live.filter((option) => option.polarity === "POSITIVE").length,
      negativeCount: live.filter((option) => option.polarity === "NEGATIVE").length,
      usageCount: usage.get(row.id) ?? 0,
    };
  });

  const byName = (a: CompetencyView, b: CompetencyView) =>
    a.name.tr.localeCompare(b.name.tr, "tr");

  return {
    competencies: views.filter((row) => row.archivedAt === null).sort(byName),
    archived: views.filter((row) => row.archivedAt !== null).sort(byName),
    scale,
  };
}

export async function loadScale(orgId: string): Promise<ScaleView | null> {
  const [scale] = await db
    .select()
    .from(ratingScales)
    .where(eq(ratingScales.orgId, orgId))
    .limit(1);
  if (!scale) return null;

  const levels = await db
    .select()
    .from(scaleLevels)
    .where(eq(scaleLevels.scaleId, scale.id));

  return {
    id: scale.id,
    name: scale.name,
    minValue: scale.minValue,
    maxValue: scale.maxValue,
    levels: levels
      .map((level) => ({
        id: level.id,
        value: level.value,
        label: level.label,
        anchor: level.anchor,
      }))
      .sort((a, b) => b.value - a.value),
  };
}

export type CompetencyDetail = {
  competency: CompetencyView;
  positive: OptionView[];
  negative: OptionView[];
  archivedOptions: OptionView[];
  scale: ScaleView | null;
};

export async function loadCompetency(
  orgId: string,
  competencyId: string,
): Promise<CompetencyDetail | null> {
  const [row] = await db
    .select()
    .from(competencies)
    .where(and(eq(competencies.id, competencyId), eq(competencies.orgId, orgId)))
    .limit(1);
  if (!row) return null;

  const [optionRows, usageRows, scale] = await Promise.all([
    db
      .select()
      .from(evaluationOptions)
      .where(eq(evaluationOptions.competencyId, competencyId)),
    db
      .select({ stageId: stageCompetencies.stageId })
      .from(stageCompetencies)
      .where(eq(stageCompetencies.competencyId, competencyId)),
    loadScale(orgId),
  ]);

  const views = optionRows
    .map<OptionView>((option) => ({
      id: option.id,
      polarity: option.polarity,
      label: option.label,
      orderIndex: option.orderIndex,
      archivedAt: option.archivedAt,
    }))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const live = views.filter((option) => option.archivedAt === null);

  return {
    competency: {
      id: row.id,
      name: row.name,
      description: row.description,
      scaleId: row.scaleId,
      archivedAt: row.archivedAt,
      positiveCount: live.filter((option) => option.polarity === "POSITIVE").length,
      negativeCount: live.filter((option) => option.polarity === "NEGATIVE").length,
      usageCount: usageRows.length,
    },
    positive: live.filter((option) => option.polarity === "POSITIVE"),
    negative: live.filter((option) => option.polarity === "NEGATIVE"),
    archivedOptions: views.filter((option) => option.archivedAt !== null),
    scale,
  };
}

/** Counts for the library header, so the number is computed in one place. */
export function libraryCounts(view: LibraryView) {
  const chips = view.competencies.reduce(
    (sum, row) => sum + row.positiveCount + row.negativeCount,
    0,
  );
  return { competencies: view.competencies.length, chips };
}

/** Used by the archive action to keep at least one live competency around. */
export async function countLiveCompetencies(orgId: string): Promise<number> {
  const rows = await db
    .select({ id: competencies.id })
    .from(competencies)
    .where(and(eq(competencies.orgId, orgId), isNull(competencies.archivedAt)));
  return rows.length;
}
