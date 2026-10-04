import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { PageTitle } from "@/components/manager/page-title";
import { RouteTabs } from "@/components/manager/route-tabs";
import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { shortDate } from "@/lib/format";
import type { OpeningStatus, OpeningDetail } from "@/solutions/hiring/server/openings";

type T = ReturnType<typeof managerT>;

/** An opening's status dot, shared by the list and the opening pages (ruling C13). */
export const TONE: Record<OpeningStatus, StatusTone> = { DRAFT: "neutral", OPEN: "active", CLOSED: "done" };

/** The way back to the openings list, above every opening page. */
export function BackToOpenings({ t }: { t: T }) {
  return (
    <Link
      href="/hiring/openings"
      className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 text-[13px] text-muted transition-colors duration-[120ms] ease-out hover:text-ink"
    >
      <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
      {t("hiringCommon.back")}
    </Link>
  );
}

/**
 * HIRING-UX 5.4: name, status, deadline, and the opening's route tabs. Only
 * tabs whose route exists are listed (ruling C7): the overview and the
 * assessment; team and rules (Task 20) joins with its route.
 */
export function OpeningHeader({
  opening,
  active,
  locale,
  t,
  action,
}: {
  opening: OpeningDetail;
  active: "overview" | "assessment" | "settings";
  locale: Locale;
  t: T;
  action?: React.ReactNode;
}) {
  const base = `/hiring/openings/${opening.id}`;
  return (
    <div className="space-y-6">
      <BackToOpenings t={t} />
      <PageTitle
        eyebrow={opening.positionName}
        title={opening.name}
        sub={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusDot tone={TONE[opening.status]}>{t(`hiringCommon.status${opening.status}`)}</StatusDot>
            <span className="tnum text-[13px]">
              {opening.deadlineAt ? t("hiringCommon.deadline", { date: shortDate(opening.deadlineAt, locale) }) : t("hiringCommon.noDeadline")}
            </span>
          </span>
        }
        action={action}
      />
      <RouteTabs
        label={t("hiringCommon.tabsLabel")}
        items={[
          { href: base, label: t("hiringCommon.tabOverview"), active: active === "overview" },
          { href: `${base}/assessment`, label: t("hiringCommon.tabAssessment"), active: active === "assessment" },
        ]}
      />
    </div>
  );
}

/**
 * The assessment's own tabs (HIRING-UX 4.3): the summary with the version
 * history, the builder, the AI draft, the scorecard and the candidate preview.
 */
export function AssessmentTabs({ openingId, active, t }: { openingId: string; active: "summary" | "edit" | "ai" | "scorecard" | "preview"; t: T }) {
  const base = `/hiring/openings/${openingId}/assessment`;
  return (
    <RouteTabs
      size="sm"
      label={t("hiringCommon.assessmentTabsLabel")}
      items={[
        { href: base, label: t("hiringCommon.tabSummary"), active: active === "summary" },
        { href: `${base}/edit`, label: t("hiringCommon.tabBuilder"), active: active === "edit" },
        { href: `${base}/ai`, label: t("hiringCommon.tabAi"), active: active === "ai" },
        { href: `${base}/scorecard`, label: t("hiringCommon.tabScorecard"), active: active === "scorecard" },
        { href: `${base}/preview`, label: t("hiringCommon.tabPreview"), active: active === "preview" },
      ]}
    />
  );
}
