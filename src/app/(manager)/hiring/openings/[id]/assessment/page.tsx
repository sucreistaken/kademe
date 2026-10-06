import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { shortDate } from "@/lib/format";
import { pickText } from "@/lib/i18n-text";
import { orderedActivities, orderedStages, totalSeconds, usedCompetencyIds } from "@/solutions/hiring/rules/content";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "../access";
import { AssessmentTabs, OpeningHeader } from "../opening-header";
import { setupStrip } from "../setup-strip";
import { versionHistory, type HistoryRow } from "./history";

export const dynamic = "force-dynamic";

const HISTORY_TONE: Record<HistoryRow["state"], StatusTone> = { draft: "neutral", live: "active", earlier: "done" };
const HISTORY_WORD = { draft: "historyDraft", live: "historyLive", earlier: "historyEarlier" } as const;

/**
 * HIRING-UX 4.3 "Değerlendirme": a summary of the version being worked on
 * (the draft, or the live version when there is none) and the version
 * history. The builder is one tab away; this page changes nothing.
 */
export default async function AssessmentSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const state = await workingState(user.orgId, opening.id);
  const content = state.content;
  if (!content) notFound();
  // 4.5: where a draft's setup path stands, for someone who may edit it (only the people are read; null otherwise).
  const setup = await setupStrip({ orgId: user.orgId, opening, access, t, locale, state });
  const stages = orderedStages(content);
  const questions = stages.reduce((sum, s) => sum + s.activities.length, 0);
  const minutes = Math.round(totalSeconds(content) / 60);
  const measured = usedCompetencyIds(content).map((cid) => pickText(state.facts.get(cid)?.name, locale)).filter(Boolean);
  const editable = access.edit && state.draft !== null;
  const builder = `/hiring/openings/${opening.id}/assessment/edit`;

  return (
    // The same page width as the builder, so switching the assessment tabs never moves the header.
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <OpeningHeader opening={opening} active="assessment" locale={locale} t={t} setup={setup} />
      <div className="mt-4">
        <AssessmentTabs openingId={opening.id} active="summary" t={t} />
      </div>

      <div className="mt-section max-w-[960px] space-y-section">
        <Card className="p-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="tnum text-[16px] leading-6 font-semibold text-ink">
                {state.draft ? t("hiringBuilder.summaryDraft", { number: content.number }) : t("hiringBuilder.summaryLive", { number: content.number })}
              </h2>
              <p className="tnum mt-0.5 text-[13px] text-muted">{t("hiringBuilder.summaryCounts", { stages: stages.length, questions, minutes })}</p>
            </div>
            <Button asChild variant="primary">
              <Link href={builder}>{editable ? t("hiringBuilder.summaryEdit") : t("hiringBuilder.summaryView")}</Link>
            </Button>
          </div>

          {stages.length ? (
            <ol className="mt-4 divide-y divide-line border-t border-line">
              {stages.map((stage, i) => (
                <li key={stage.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <Link
                    href={`${builder}?stage=${stage.id}`}
                    className="text-[14px] font-medium text-ink underline decoration-transparent underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-line-strong"
                  >
                    {pickText(stage.name, locale) || t("hiringBuilder.untitledStage", { n: i + 1 })}
                  </Link>
                  <span className="tnum text-[13px] text-muted">
                    {t("hiringBuilder.summaryStage", { questions: orderedActivities(stage).length, minutes: Math.round(stage.durationSeconds / 60) })}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-[14px] text-muted">{t("hiringBuilder.summaryEmpty")}</p>
          )}

          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[13px] text-muted">{t("hiringBuilder.summaryMeasures")}</p>
            <p className="mt-1 text-[14px] text-ink">{measured.length ? measured.join(", ") : t("hiringBuilder.summaryNoCompetency")}</p>
          </div>
        </Card>

        <Card className="p-card">
          <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringBuilder.historyTitle")}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{t("hiringBuilder.historyNote")}</p>
          <ul className="mt-3 divide-y divide-line">
            {versionHistory(state.list).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <span className="flex items-center gap-3">
                  <span className="tnum w-8 text-[14px] font-semibold text-ink">v{row.number}</span>
                  <StatusDot tone={HISTORY_TONE[row.state]}>{t(`hiringBuilder.${HISTORY_WORD[row.state]}`)}</StatusDot>
                </span>
                <span className="tnum text-[13px] text-muted">
                  {row.publishedAt ? t("hiringBuilder.historyPublishedOn", { date: shortDate(row.publishedAt, locale) }) : t("hiringBuilder.historyNotPublished")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
