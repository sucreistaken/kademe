import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { templateVersions, templates, positions, stages, activities } from "@/db/schema";
import { requireUser } from "@/server/session";
import {
  candidateSafe,
  candidateStageColumns,
  candidateActivityColumns,
  candidateVersionColumns,
  pickText,
  type CandidateLocale,
} from "@/lib/candidate-safe";
import { Card } from "@/components/ui/card";
import { TemplateSteps } from "@/components/manager/template-steps";
import { Button } from "@/components/ui/button";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";

const TYPES = [
  "VIDEO",
  "AUDIO",
  "LONG_TEXT",
  "SHORT_TEXT",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "FILE_UPLOAD",
  "SCENARIO",
] as const;

function isType(value: string): value is (typeof TYPES)[number] {
  return (TYPES as readonly string[]).includes(value);
}

/**
 * What the candidate will actually see. This is not a mock: it selects through
 * exactly the same candidate-safe column sets the candidate API uses, so an
 * internal field cannot appear here without also leaking to a real candidate.
 * That is the point of the screen, and why it is worth the extra indirection.
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tid: string; v: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const user = await requireUser();
  const { id, tid, v } = await params;
  const { lang } = await searchParams;
  // Two languages on one page: the chrome speaks to the manager, the preview
  // itself speaks to the candidate. The preview subtree therefore carries its
  // own `lang`, or CSS casing and screen readers would follow the wrong one.
  const panelLocale = await managerLocale();
  const t = managerT(panelLocale);
  const locale: CandidateLocale = lang === "en" ? "en" : "tr";

  const [version] = await db
    .select({
      ...candidateVersionColumns,
      status: templateVersions.status,
      versionNumber: templateVersions.versionNumber,
      templateName: templates.name,
      positionName: positions.name,
    })
    .from(templateVersions)
    .innerJoin(templates, eq(templates.id, templateVersions.templateId))
    .innerJoin(positions, eq(positions.id, templates.positionId))
    .where(
      and(eq(templateVersions.id, v), eq(templateVersions.orgId, user.orgId)),
    )
    .limit(1);
  if (!version) notFound();

  const stageRows = await db
    .select(candidateStageColumns)
    .from(stages)
    .where(eq(stages.versionId, v))
    .orderBy(asc(stages.orderIndex));

  const activityRows = stageRows.length
    ? await db
        .select(candidateActivityColumns)
        .from(activities)
        .where(
          inArray(
            activities.stageId,
            stageRows.map((s) => s.id),
          ),
        )
        .orderBy(asc(activities.orderIndex))
    : [];

  const safeStages = candidateSafe(
    stageRows.map((stage) => ({
      ...stage,
      activities: activityRows.filter((a) => a.stageId === stage.id),
    })),
  );

  const totalMinutes = Math.round(
    safeStages.reduce((acc, s) => acc + s.durationSeconds, 0) / 60,
  );
  const base = `/positions/${id}/templates/${tid}/versions/${v}`;

  return (
    <div className="min-h-screen bg-canvas">
      {/* The frame is manager chrome. Everything below it is the candidate's view. */}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-center gap-4 px-6 py-3">
          <p className="text-[13px] font-medium">{t("preview.frameTitle")}</p>
          <div className="flex-1">
            <p className="text-[12.5px] text-muted">
              {version.positionName} · {version.templateName} v{version.versionNumber}
              {version.status !== "PUBLISHED" ? ` · ${t("preview.draftSuffix")}` : ""}
            </p>
            <div className="mt-0.5">
              <TemplateSteps basePath={base} current={2} reviewable />
            </div>
          </div>
          <div className="flex items-center gap-1">
            {(["tr", "en"] as const).map((code) => (
              <Link
                key={code}
                href={`${base}/preview?lang=${code}`}
                className={
                  locale === code
                    ? "rounded-[6px] bg-accent-soft px-2 py-1 text-[12px] font-medium text-accent"
                    : "rounded-[6px] px-2 py-1 text-[12px] text-muted hover:text-ink"
                }
              >
                {code.toUpperCase()}
              </Link>
            ))}
          </div>
          <Button variant="secondary" size="sm" asChild>
            <Link href={`${base}/builder`}>{t("preview.backToBuilder")}</Link>
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-[1000px] px-6 py-8">
        <Card className="p-8">
          <p className="text-[11.5px] uppercase tracking-wide text-muted">
            {t("preview.introKicker")}
          </p>
          <h1 lang={locale} className="mt-2 text-[26px] font-semibold tracking-tight">
            {pickText(version.introTitle, locale) || version.positionName}
          </h1>
          {pickText(version.introBody, locale) ? (
            <p
              lang={locale}
              className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-muted"
            >
              {pickText(version.introBody, locale)}
            </p>
          ) : (
            <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-muted">
              {t("preview.introMissing")}
            </p>
          )}
          <p className="mt-4 text-[13px] text-muted tnum">
            {t("preview.overview", {
              stages: safeStages.length,
              minutes: totalMinutes,
            })}
          </p>
        </Card>

        {safeStages.length === 0 ? (
          <Card className="mt-4 p-8">
            <p className="text-[14px]">{t("preview.noStages")}</p>
            <p className="mt-1.5 text-[13px] text-muted">{t("preview.noStagesBody")}</p>
            <div className="mt-4">
              <Button variant="secondary" size="md" asChild>
                <Link href={`${base}/builder`}>{t("preview.addStageInBuilder")}</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="mt-4 space-y-4">
            {safeStages.map((stage, i) => (
              <Card key={stage.id} className="p-8">
                <p className="text-[11.5px] uppercase tracking-wide text-muted tnum">
                  {t("preview.stageHeader", {
                    index: i + 1,
                    total: safeStages.length,
                    minutes: Math.round(stage.durationSeconds / 60),
                  })}
                </p>
                <h2
                  lang={locale}
                  className="mt-2 text-[19px] font-semibold tracking-tight"
                >
                  {pickText(stage.name, locale) || t("preview.unnamedStage")}
                </h2>
                {pickText(stage.description, locale) ? (
                  <p
                    lang={locale}
                    className="mt-2 max-w-[62ch] text-[13.5px] leading-relaxed text-muted"
                  >
                    {pickText(stage.description, locale)}
                  </p>
                ) : null}

                <div className="mt-5 space-y-5">
                  {stage.activities.length === 0 ? (
                    <p className="text-[13px] text-muted">
                      {t("preview.noActivities")}
                    </p>
                  ) : (
                    stage.activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="border-t border-line pt-5 first:border-0 first:pt-0"
                      >
                        <p className="text-[11.5px] uppercase tracking-wide text-muted">
                          {isType(activity.type)
                            ? t(`preview.type${activity.type}`)
                            : activity.type}
                          {activity.isRequired ? "" : ` · ${t("preview.optional")}`}
                        </p>
                        <p className="mt-2 text-[15px] leading-relaxed">
                          {pickText(activity.candidatePrompt, locale) ? (
                            <span lang={locale}>
                              {pickText(activity.candidatePrompt, locale)}
                            </span>
                          ) : (
                            <span className="text-muted">{t("preview.noPrompt")}</span>
                          )}
                        </p>
                        {pickText(activity.candidateNote, locale) ? (
                          <p lang={locale} className="mt-2 text-[13px] text-muted">
                            {pickText(activity.candidateNote, locale)}
                          </p>
                        ) : null}
                        {activity.answerSeconds ? (
                          <p className="mt-2 text-[12.5px] text-muted tnum">
                            {t("preview.timing", {
                              think: activity.thinkSeconds,
                              answer: Math.round(activity.answerSeconds / 60),
                            })}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <p className="mt-6 text-[12.5px] text-muted">{t("preview.noLeak")}</p>
      </main>
    </div>
  );
}
