import { notFound } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  templateVersions,
  templates,
  positions,
  stages,
  stageCompetencies,
  competencies,
  weightSets,
  weights,
} from "@/db/schema";
import { requireUser } from "@/server/session";
import { evenWeightSplit } from "@/lib/scoring";
import { managerLocale } from "@/i18n/manager-locale";
import { WeightsEditor } from "./weights-editor";

export default async function WeightsPage({
  params,
}: {
  params: Promise<{ id: string; tid: string; v: string }>;
}) {
  const user = await requireUser("template:write");
  const locale = await managerLocale();
  const { v: versionId } = await params;

  const [version] = await db
    .select({
      id: templateVersions.id,
      versionNumber: templateVersions.versionNumber,
      status: templateVersions.status,
      templateName: templates.name,
      positionName: positions.name,
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
  if (!version) notFound();

  // Only competencies this version actually measures. Offering the whole org
  // library here would let a manager weight something nobody is scored on.
  const stageRows = await db
    .select({ id: stages.id })
    .from(stages)
    .where(eq(stages.versionId, versionId));

  const links = stageRows.length
    ? await db
        .select({ competencyId: stageCompetencies.competencyId })
        .from(stageCompetencies)
        .where(
          inArray(
            stageCompetencies.stageId,
            stageRows.map((s) => s.id),
          ),
        )
    : [];

  const usedIds = [...new Set(links.map((l) => l.competencyId))];
  // Ordered by name: an unordered query lets rows jump between loads, and the
  // even split adds its remainder to the first rows, so the same competency
  // must land in the same position every time.
  const competencyRows = usedIds.length
    ? await db
        .select({ id: competencies.id, name: competencies.name })
        .from(competencies)
        .where(inArray(competencies.id, usedIds))
        .orderBy(sql`${competencies.name}->>${locale}`)
    : [];

  const [latestSet] = await db
    .select()
    .from(weightSets)
    .where(eq(weightSets.versionId, versionId))
    .orderBy(sql`${weightSets.createdAt} desc`)
    .limit(1);

  const weightRows = latestSet
    ? await db.select().from(weights).where(eq(weights.weightSetId, latestSet.id))
    : [];

  const current = new Map(
    weightRows.map((w) => [w.competencyId, Number(w.percentage)]),
  );

  // Shared, unit tested: an even split that actually adds up to 100.
  const evenSplit = evenWeightSplit(competencyRows.length);

  return (
    <WeightsEditor
      versionId={versionId}
      heading={`${version.positionName} · ${version.templateName} · v${version.versionNumber}`}
      enabled={latestSet?.isActive === 1}
      competencies={competencyRows.map((c, i) => ({
        id: c.id,
        name: c.name[locale] || c.name.tr || c.name.en,
        percentage: current.get(c.id) ?? evenSplit[i],
      }))}
    />
  );
}
