import Link from "next/link";
import { CalendarDays, Clock, FileText, Inbox, Plus, Users } from "lucide-react";
import { cockpitCounts, cockpitTab } from "@/components/hiring/opening-next-step";
import { positionIcon } from "@/components/hiring/position-icon";
import { PageTitle } from "@/components/manager/page-title";
import { ControlRow, type ControlAttention } from "@/components/manager/control-row";
import { EmptyState } from "@/components/manager/empty-state";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { Disclosure } from "@/components/visual/disclosure";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/format";
import { requireUser } from "@/server/session";
import { TONE } from "./[id]/opening-header";
import { SETUP_LABEL } from "./[id]/setup-steps";
import { loadCockpit, type CockpitRow } from "./cockpit";
import { ScrollTo } from "./scroll-to";

export const dynamic = "force-dynamic";

type T = ReturnType<typeof managerT>;

const NEXT_LABEL = {
  requests: "hiringOpenings.nextRequests",
  team: "hiringOpenings.nextTeam",
  expiring: "hiringOpenings.nextExpiring",
  invite: "hiringOpenings.nextInvite",
  candidates: "hiringOpenings.nextCandidates",
  open: "hiringOpenings.nextOpen",
  continueSetup: "hiringCommon.continueSetup",
  draft: "hiringCommon.continueSetup",
  deadline: "hiringOpenings.nextDeadline",
} as const;

/** One opening as a control row (KG1): status, progress, what needs attention, team and last day, and its one next step. */
function Row({ row, runs, locale, t }: { row: CockpitRow; runs: boolean; locale: Locale; t: T }) {
  const o = row.opening;
  const f = row.facts;
  const status = (
    <StatusDot tone={TONE[o.status]}>
      <span className="tnum">{[t(`hiringCommon.status${o.status}`), o.liveNumber ? `v${o.liveNumber}` : null].filter(Boolean).join(" · ")}</span>
    </StatusDot>
  );
  // KG1: a closed opening's row is its name, status, team and last day, and "Aç"; no count and no attention line.
  const progress =
    o.status === "CLOSED" ? null : o.status === "DRAFT" ? (
      row.setup ? (
        <>
          <p className="tnum">{t("hiringOverview.setupCount", { done: row.setup.done, total: row.setup.total })}</p>
          <span aria-hidden className="mt-1.5 flex gap-1">
            {Array.from({ length: row.setup.total }, (_, i) => (
              <span key={i} className={cn("h-[5px] w-[26px] rounded-[3px]", row.setup && i < row.setup.done ? "bg-accent" : "bg-line")} />
            ))}
          </span>
        </>
      ) : null
    ) : f && f.invited > 0 ? (
      <p className="tnum">{t("hiringOpenings.funnelLine", { invited: f.invited, started: f.started, completed: f.completed })}</p>
    ) : (
      <p className="text-muted">{t("hiringOpenings.funnelEmpty")}</p>
    );
  const requests = f?.requests ? f.requests.open + f.requests.rights : 0;
  const attention: ControlAttention[] = o.status === "CLOSED" ? [] : [
    // H9: requests, an empty team and a waiting draft only for someone who runs openings (their facts alone carry them).
    ...(f?.requests && requests > 0
      ? [{ key: "requests", icon: Inbox, text: t("hiringCommon.openRequests", { count: requests }), note: f.requests.rights > 0 ? t("hiringCommon.rightsNote", { count: f.requests.rights }) : undefined }]
      : []),
    ...(row.noTeam ? [{ key: "team", icon: Users, text: t("hiringInvite.reasonnoEvaluators") }] : []),
    ...(f && f.expiringSoon > 0 ? [{ key: "expiring", icon: Clock, text: t("hiringCommon.expiringLinks", { count: f.expiringSoon }) }] : []),
    // B-M3: a live opening past its last day takes no invitation; said once, as on the opening's overview.
    ...(row.deadlinePassed ? [{ key: "deadline", icon: CalendarDays, text: t("hiringCommon.deadlinePassed") }] : []),
    // A closed opening's draft waits for nothing (as on Today): only a live one says so.
    ...(runs && o.status === "OPEN" && o.liveNumber && o.draftNumber ? [{ key: "draft", icon: FileText, text: t("hiringCommon.draftWaitingPublish", { number: o.draftNumber }) }] : []),
  ];
  const team = row.team.count === 0 ? t("hiringOpenings.teamNone") : row.team.onlyYou ? t("hiringOpenings.teamOnlyYou") : t("hiringOpenings.teamCount", { count: row.team.count });
  const meta = [team, o.deadlineAt ? t("hiringCommon.deadline", { date: shortDate(o.deadlineAt, locale) }) : t("hiringCommon.noDeadline")].join(" · ");
  const next = row.next;
  const label = next.kind === "setup" && next.setupKey ? t("hiringOverview.setupNext", { step: t(`hiringOverview.${SETUP_LABEL[next.setupKey]}`) }) : t(NEXT_LABEL[next.kind === "setup" ? "continueSetup" : next.kind]);
  return (
    <ControlRow
      icon={positionIcon(o.positionName)}
      title={o.name}
      href={`/hiring/openings/${o.id}`}
      status={status}
      meta={meta}
      progress={progress}
      attention={attention}
      next={{ label, href: next.href }}
    />
  );
}

function Group({ id, name, count, children }: { id: string; name: string; count: number; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <h2 id={`${id}-title`} className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.07em] text-muted uppercase">
        {name}
        <span className="tnum rounded-[10px] bg-secondary px-[7px] py-px tracking-normal text-ink-2">{count}</span>
      </h2>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-hairline">{children}</ul>
      </Card>
    </section>
  );
}

/**
 * HIRING-VISUAL-FLOW 4.4 (K12, H1, H8): the control view of hiring. Every
 * opening is one row with its one next step, in groups on one page: in setup,
 * live, and the closed ones behind a disclosure. The page's one filled button
 * is "Alım aç" (KG5). A reviewer sees the openings they are on, counts only
 * (H9). The old route tabs' links (`?tab=`) land on their group.
 */
export default async function OpeningsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const tab = cockpitTab(sp.tab);
  const { runs, drafts, open, closed } = await loadCockpit(user, t, locale);
  const total = drafts.length + open.length + closed.length;
  const addButton = runs ? (
    <Button asChild variant="primary">
      <Link href="/hiring/openings/new">
        <Plus className="size-4" strokeWidth={2} aria-hidden />
        {t("hiringOpenings.add")}
      </Link>
    </Button>
  ) : (
    <>
      <Button id="openings-add" variant="primary" disabled disabledReason={t("hiringOpenings.noPermission")}>
        {t("hiringOpenings.add")}
      </Button>
      <DisabledReason id="openings-add-why">{t("hiringOpenings.noPermission")}</DisabledReason>
    </>
  );

  if (total === 0) {
    return (
      <main className="mx-auto max-w-[1360px] px-page py-8">
        <PageTitle title={t("hiringOpenings.title")} sub={t("hiringOpenings.sub")} />
        {runs ? (
          <EmptyState variant="page" illustration="emptyOpenings" title={t("hiringOpenings.emptyTitle")} body={t("hiringOpenings.emptyBody")} action={addButton} />
        ) : (
          // A reviewer sees only the openings they work on and cannot open one: no button to stare at.
          <EmptyState variant="page" illustration="emptyOpenings" title={t("hiringOpenings.emptyViewerTitle")} body={t("hiringOpenings.emptyViewerBody")} />
        )}
      </main>
    );
  }

  const counts = cockpitCounts([...drafts, ...open, ...closed].map((r) => ({ status: r.opening.status, next: r.next })));
  const summary = runs
    ? [
        t("hiringOpenings.summaryRunning", { count: counts.running }),
        counts.setup > 0 ? t("hiringOpenings.summarySetup", { count: counts.setup }) : null,
        counts.waiting > 0 ? t("hiringOpenings.summaryWaiting", { count: counts.waiting }) : null,
      ]
        .filter(Boolean)
        .join(" ")
    : t("hiringOpenings.summaryViewer", { count: total });
  const rows = (list: CockpitRow[]) => list.map((row) => <Row key={row.opening.id} row={row} runs={runs} locale={locale} t={t} />);

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <PageTitle title={t("hiringOpenings.title")} sub={summary} action={addButton} />
      {tab ? <ScrollTo id={`group-${tab}`} /> : null}
      <div className="mt-section space-y-section">
        {drafts.length ? (
          <Group id="group-draft" name={t("hiringOpenings.groupSetupName")} count={drafts.length}>
            {rows(drafts)}
          </Group>
        ) : null}
        {open.length ? (
          <Group id="group-open" name={t("hiringOpenings.groupLiveName")} count={open.length}>
            {rows(open)}
          </Group>
        ) : null}
        {closed.length ? (
          <section id="group-closed" className="scroll-mt-6">
            <Disclosure label={t("hiringOpenings.groupClosed", { count: closed.length })} defaultOpen={tab === "closed"}>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-hairline">{rows(closed)}</ul>
              </Card>
            </Disclosure>
          </section>
        ) : null}
      </div>
    </main>
  );
}
