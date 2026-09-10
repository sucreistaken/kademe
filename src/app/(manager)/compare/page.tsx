import Link from "next/link";
import { InlineLink } from "@/components/ui/inline-link";
import { Card } from "@/components/ui/card";
import { Button, DisabledReason } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { requireUser } from "@/server/session";
import {
  loadAssessmentRows,
  loadPositions,
  type AssessmentRow,
} from "@/lib/manager-data";
import { score as formatScore } from "@/lib/format";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import type { Locale } from "@/i18n/locale";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const params = await searchParams;
  const rows = await loadAssessmentRows(user.orgId);
  const positions = await loadPositions(user.orgId, rows);

  // Only candidates somebody has actually opened and scored belong in a
  // comparison. Comparing unscored people would invent a ranking.
  const scored = rows.filter((row) => row.evaluationId !== null);

  const requested = single(params.position);
  const positionsWithScores = positions.filter((position) =>
    scored.some((row) => row.positionId === position.id),
  );
  const selectedId =
    positionsWithScores.find((p) => p.id === requested)?.id ??
    positionsWithScores[0]?.id ??
    null;

  const selected = scored
    .filter((row) => row.positionId === selectedId)
    .sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));

  const columns = competencyColumns(selected, locale);
  const versionIds = [...new Set(selected.map((row) => row.versionId))];
  const sharedVersion = versionIds.length === 1 ? selected[0] : null;
  const positionName = positions.find((p) => p.id === selectedId)?.name ?? null;

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">
            {t("compare.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {positionName
              ? t("compare.summary", {
                  position: positionName,
                  count: selected.length,
                })
              : t("compare.none")}
          </p>
        </div>
        <Button asChild variant="primary" size="md">
          <Link href="/candidates">{t("compare.addCandidate")}</Link>
        </Button>
      </div>

      {positionsWithScores.length > 1 && (
        <div className="mt-5 flex flex-wrap items-center gap-1">
          {positionsWithScores.map((position) => {
            const isActive = position.id === selectedId;
            return (
              <Link
                key={position.id}
                href={`/compare?position=${position.id}`}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "rounded-[8px] bg-ink px-3 py-1.5 text-[13px] font-medium text-surface"
                    : "rounded-[8px] px-3 py-1.5 text-[13px] text-muted hover:bg-canvas hover:text-ink"
                }
              >
                {position.name}
              </Link>
            );
          })}
        </div>
      )}

      <Card className="mt-5 overflow-hidden">
        {selected.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[15px] font-medium">{t("compare.emptyTitle")}</p>
            <p className="mt-1.5 text-[13px] text-muted">{t("compare.emptyBody")}</p>
            <InlineLink href="/dashboard" className="mt-4 inline-block text-[13px]">
              {t("compare.goToQueue")}
            </InlineLink>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[12.5px] text-muted">
                  <th className="px-5 py-3 font-medium">{t("compare.colCandidate")}</th>
                  {columns.map((column) => (
                    <th key={column.id} className="px-5 py-3 font-medium">
                      {column.name}
                    </th>
                  ))}
                  <th className="px-5 py-3 font-medium">{t("compare.colOverall")}</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((row) => {
                  const byId = new Map(
                    row.competencyScores.map((c) => [c.competencyId, c.score]),
                  );
                  const incomplete = row.stagesCompleted < row.stagesTotal;
                  return (
                    <tr key={row.assessmentId} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={row.candidateName} />
                          <Link
                            href={`/candidates/${row.candidateId}`}
                            className="font-medium hover:underline"
                          >
                            {row.candidateName}
                          </Link>
                        </div>
                      </td>
                      {columns.map((column) => {
                        const value = byId.get(column.id);
                        return (
                          <td key={column.id} className="tnum px-5 py-3.5">
                            {value === undefined || value === null ? (
                              <span className="text-[13px] text-muted">
                                {incomplete
                                  ? t("compare.missingStage")
                                  : t("compare.missingScore")}
                              </span>
                            ) : (
                              formatScore(value, locale)
                            )}
                          </td>
                        );
                      })}
                      <td className="tnum px-5 py-3.5 font-medium">
                        {incomplete || row.overall === null ? (
                          <span className="text-[13px] font-normal text-muted">
                            {t("compare.partial")}
                          </span>
                        ) : (
                          formatScore(row.overall, locale)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted">{t("compare.footnote")}</p>
          {sharedVersion ? (
            <InlineLink
              href={`/positions/${sharedVersion.positionId}/templates/${sharedVersion.templateId}/versions/${sharedVersion.versionId}/weights`}
              className="text-[13px]"
            >
              {t("compare.editWeights")}
            </InlineLink>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled
                disabledReason={t("compare.differentVersions")}
              >
                {t("compare.editWeights")}
              </Button>
              <DisabledReason>{t("compare.differentVersionsLong")}</DisabledReason>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

/** Union of the competencies anyone in the table was scored on, name ordered. */
function competencyColumns(rows: AssessmentRow[], locale: Locale) {
  const columns = new Map<string, string>();
  for (const row of rows) {
    for (const competency of row.competencyScores) {
      const name = competency.name[locale]?.trim()
        ? competency.name[locale]
        : (competency.name.tr || competency.name.en);
      columns.set(competency.competencyId, name);
    }
  }
  return [...columns.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
