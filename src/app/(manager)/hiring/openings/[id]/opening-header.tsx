import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { PanelHeader } from "@/components/manager/panel-header";
import { RouteTabs } from "@/components/manager/route-tabs";
import type { RowMenuItem } from "@/components/manager/row-menu";
import { OPENING_STATUS } from "@/components/hiring/status-vocabulary";
import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { shortDate } from "@/lib/format";
import type { OpeningStatus, OpeningDetail } from "@/solutions/hiring/server/openings";
import type { SetupStripData } from "./setup-strip";
import { SETUP_LABEL } from "./setup-steps";

type T = ReturnType<typeof managerT>;

/** An opening's status dot, shared by the list and the opening pages (ruling C13), from the one dictionary (P9). */
export const TONE: Record<OpeningStatus, StatusTone> = { DRAFT: OPENING_STATUS.DRAFT.tone, OPEN: OPENING_STATUS.OPEN.tone, CLOSED: OPENING_STATUS.CLOSED.tone };

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
 * HIRING-UX 5.4 with HIRING-VISUAL-FLOW P2 and 4.5: name, status, deadline,
 * the page's one filled action, the "⋯" menu of links (plan decision 14), and
 * the opening's route tabs. Only tabs whose route exists are listed (ruling
 * C7). On a draft's other pages (for someone who may edit it) one line under
 * the tabs says where the setup path stands and opens its next step; it is a
 * text link and never competes with the page's own filled button. The
 * overview passes no line: its setup card says the same one line lower.
 */
export function OpeningHeader({
  opening,
  active,
  locale,
  t,
  action,
  menu,
  setup,
}: {
  opening: OpeningDetail;
  active: "overview" | "candidates" | "assessment" | "settings";
  locale: Locale;
  t: T;
  action?: React.ReactNode;
  menu?: RowMenuItem[];
  setup?: SetupStripData | null;
}) {
  const base = `/hiring/openings/${opening.id}`;
  const stripLink = setup ? (
    <>
      {t("hiringOverview.setupNext", { step: t(`hiringOverview.${SETUP_LABEL[setup.next.key]}`) })}
      <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
    </>
  ) : null;
  const linkClass = "inline-flex min-h-11 items-center gap-0.5 font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";
  return (
    <div className="space-y-6">
      <BackToOpenings t={t} />
      <PanelHeader
        kicker={opening.positionName}
        title={opening.name}
        meta={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusDot tone={TONE[opening.status]}>{t(`hiringCommon.status${opening.status}`)}</StatusDot>
            <span className="tnum text-[13px]">
              {opening.deadlineAt ? t("hiringCommon.deadline", { date: shortDate(opening.deadlineAt, locale) }) : t("hiringCommon.noDeadline")}
            </span>
          </span>
        }
        primary={action}
        menu={menu?.length ? { label: t("nav.more"), items: menu } : undefined}
      />
      <div className="space-y-2">
        <RouteTabs
          label={t("hiringCommon.tabsLabel")}
          items={[
            { href: base, label: t("hiringCommon.tabOverview"), active: active === "overview" },
            { href: `${base}/candidates`, label: t("hiringCommon.tabCandidates"), active: active === "candidates" },
            { href: `${base}/assessment`, label: t("hiringCommon.tabAssessment"), active: active === "assessment" },
            { href: `${base}/settings`, label: t("hiringCommon.tabSettings"), active: active === "settings" },
          ]}
        />
        {setup ? (
          <p className="tnum flex flex-wrap items-center gap-x-2 text-[14px] text-ink-2">
            <span>{t("hiringOverview.setupCount", { done: setup.done, total: setup.total })}</span>
            <span aria-hidden>·</span>
            {/* A step with a hash (team and rules' flow, the publish summary) is a plain anchor, so that page hears it (W3). */}
            {setup.next.href.includes("#") ? (
              <a href={setup.next.href} className={linkClass}>
                {stripLink}
              </a>
            ) : (
              <Link href={setup.next.href} className={linkClass}>
                {stripLink}
              </Link>
            )}
          </p>
        ) : null}
      </div>
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
