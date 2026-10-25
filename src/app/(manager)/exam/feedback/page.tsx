import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Dot, shortDateTime } from "@/components/panel/bits";
import { StarsReadout } from "@/components/panel/result/exam-feedback-box";
import { PanelHeader } from "@/components/manager/panel-header";
import { Card } from "@/components/ui/card";
import { formatAverage, technicalPercent } from "@/lib/exam/feedback-stats";
import { feedbackOverview } from "@/server/exam-feedback";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

export const dynamic = "force-dynamic";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="tnum mt-1 text-[22px] leading-tight font-bold text-ink">{children}</dd>
    </Card>
  );
}

/**
 * The students' end-of-exam survey, summed up (a sub-page of Advanced, so the
 * menu keeps its five items): how many answered, the average rating, the share
 * who had a technical problem and the newest comments. One organisation only.
 */
export default async function ExamFeedbackPage() {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const overview = await feedbackOverview(user.orgId);
  const percent = technicalPercent(overview.technicalAnswered, overview.technicalYes);
  const average = (value: number | null) => (value === null ? "-" : t("examFeedback.averageValue", { value: formatAverage(value, locale) }));

  return (
    <main className="mx-auto max-w-[860px] space-y-8 px-6 py-8">
      <div>
        <Link href="/advanced" className="mb-3 inline-flex min-h-8 items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
          {t("examFeedback.backToAdvanced")}
        </Link>
        <PanelHeader title={t("examFeedback.pageTitle")} meta={t("examFeedback.pageLead")} />
      </div>

      {overview.count === 0 ? (
        <Card className="px-6 py-8 text-center">
          <p className="text-[15px] font-medium text-ink">{t("examFeedback.emptyTitle")}</p>
          <p className="mt-1 text-[13.5px] text-muted">{t("examFeedback.emptyBody")}</p>
        </Card>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Stat label={t("examFeedback.statCount")}>{overview.count}</Stat>
            <Stat label={t("examFeedback.statAverage")}>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {average(overview.averageOverall)}
                {overview.averageOverall === null ? null : <StarsReadout value={overview.averageOverall} />}
              </span>
            </Stat>
          </dl>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Stat label={t("examFeedback.statClarity")}>{average(overview.averageClarity)}</Stat>
            <Stat label={t("examFeedback.statUsability")}>{average(overview.averageUsability)}</Stat>
            <Stat label={t("examFeedback.statTechnical")}>
              {percent === null ? "-" : t("examFeedback.technicalValue", { percent, yes: overview.technicalYes, answered: overview.technicalAnswered })}
            </Stat>
          </dl>

          <section aria-labelledby="exam-feedback-comments" className="space-y-3">
            <h2 id="exam-feedback-comments" className="text-[16px] font-semibold text-ink">
              {t("examFeedback.commentsTitle")}
            </h2>
            {overview.comments.length === 0 ? (
              <p className="text-[13.5px] text-muted">{t("examFeedback.commentsEmpty")}</p>
            ) : (
              <Card className="divide-y divide-line">
                {overview.comments.map((c) => (
                  <article key={c.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
                      <StarsReadout value={c.overall} />
                      <span className="tnum font-semibold text-ink">{t("examFeedback.ratingOf", { n: c.overall })}</span>
                      {c.technicalProblem ? <Dot tone="warn">{t("examFeedback.technicalFlag")}</Dot> : null}
                      <span className="tnum text-muted">{shortDateTime(c.createdAt, locale)}</span>
                      <Link href={`/exam/students/${c.assessmentId}`} className="ms-auto text-ink underline decoration-underline underline-offset-2">
                        {c.name || t("examFeedback.unknownName")} · {t("examFeedback.openResult")}
                      </Link>
                    </div>
                    <p lang={c.locale} dir="auto" className="mt-2 text-[14px] leading-[1.6] whitespace-pre-line text-ink">
                      {c.comment}
                    </p>
                  </article>
                ))}
              </Card>
            )}
          </section>
        </>
      )}
    </main>
  );
}
