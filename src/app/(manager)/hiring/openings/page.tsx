import Link from "next/link";
import { Clock, FileText, Inbox, Users } from "lucide-react";
import { funnelShare, cockpitCounts, cockpitTab } from "@/components/hiring/opening-next-step";
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
} as const;

/** One opening as a control row (KG1): status, progress, what needs attention, team and last day, and its one next step. */
function Row({ row, userId, runs, locale, t }: { row: CockpitRow; userId: string; runs: boolean; locale: Locale; t: T }) {
  const o = row.opening;
  const f = row.facts;
  const status = (
    <StatusDot tone={TONE[o.status]}>
      <span className="tnum">{[t(`hiringCommon.status${o.status}`), o.liveNumber ? `v${o.liveNumber}` : null].filter(Boolean).join(" · ")}</span>
    </StatusDot>
  );
  const progress =
    o.status === "DRAFT" ? (
      row.setup ? (
        <>
          <p className="tnum">{t("hiringOverview.setupCount", { done: row.setup.done, total: row.setup.total })}</p>
          <span aria-hidden className="mt-1.5 flex gap-1">
            {Array.from({ length: row.setup.total }, (_, i) => (
              <span key={i} className={cn("h-1.5 w-6 rounded-full", row.setup && i < row.setup.done ? "bg-ink-3" : "bg-hairline")} />
            ))}
          </span>
        </>
      ) : null
    ) : f && f.invited > 0 ? (
      <>
        <p className="tnum">{t("hiringOpenings.funnelLine", { invited: f.invited, started: f.started, completed: f.completed })}</p>
        <div aria-hidden className="mt-1.5 h-1.5 max-w-40 overflow-hidden rounded-full bg-hairline">
          <div className="h-1.5 rounded-full bg-ink-3" style={{ width: `${Math.round(funnelShare(f) * 100)}%` }} />
        </div>
      </>
    ) : (
      <p className="text-muted">{t("hiringOpenings.funnelEmpty")}</p>
    );
  const requests = f?.requests ? f.requests.open + f.requests.rights : 0;
  const attention: ControlAttention[] = [
    // H9: requests, the team rule and a waiting draft only for someone who runs openings (their facts alone carry them).
    ...(f?.requests && requests > 0
      ? [{ key: "requests", icon: Inbox, text: t("hiringCommon.openRequests", { count: requests }), note: f.requests.rights > 0 ? t("hiringCommon.rightsNote", { count: f.requests.rights }) : undefined }]
      : []),
    ...(row.shortfall ? [{ key: "team", icon: Users, text: t("hiringCommon.teamShort", { evaluators: row.shortfall.evaluators, min: row.shortfall.min }) }] : []),
    ...(f && f.expiringSoon > 0 ? [{ key: "expiring", icon: Clock, text: t("hiringCommon.expiringLinks", { count: f.expiringSoon }) }] : []),
    // A closed opening's draft waits for nothing (as on Today): only a live one says so.
    ...(runs && o.status === "OPEN" && o.liveNumber && o.draftNumber ? [{ key: "draft", icon: FileText, text: t("hiringCommon.draftWaitingPublish", { number: o.draftNumber }) }] : []),
  ];
  const team =
    o.memberIds.length === 0 ? t("hiringOpenings.teamNone") : o.memberIds.length === 1 && o.memberIds[0] === userId ? t("hiringOpenings.teamOnlyYou") : t("hiringOpenings.teamCount", { count: o.memberIds.length });
  const facts = (
    <>
      <span className="block">{o.deadlineAt ? t("hiringCommon.deadline", { date: shortDate(o.deadlineAt, locale) }) : t("hiringCommon.noDeadline")}</span>
      <span className="block">{team}</span>
    </>
  );
  const next = row.next;
  const label = next.kind === "setup" && next.setupKey ? t("hiringOverview.setupNext", { step: t(`hiringOverview.${SETUP_LABEL[next.setupKey]}`) }) : t(NEXT_LABEL[next.kind === "setup" ? "continueSetup" : next.kind]);
  return (
    <ControlRow
      title={
        <>
          {o.name}
          <span className="block text-[13px] font-normal text-muted">{o.positionName}</span>
        </>
      }
      href={`/hiring/openings/${o.id}`}
      status={status}
      progress={progress}
      attention={attention}
      facts={facts}
      next={{ label, href: next.href }}
    />
  );
}

function Group({ id, title, columns, children }: { id: string; title: string; columns: [string, string, string, string]; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <h2 id={`${id}-title`} className="mb-3 text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
        {title}
      </h2>
      <Card className="overflow-hidden">
        <div aria-hidden className="hidden gap-x-6 border-b border-line px-5 py-2 text-[12px] text-muted lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]">
          {columns.map((c, i) => (
            <span key={c} className={i === 3 ? "text-right" : undefined}>
              {c}
            </span>
          ))}
        </div>
        <ul className="divide-y divide-line">{children}</ul>
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
      <Link href="/hiring/openings/new">{t("hiringOpenings.add")}</Link>
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
          <EmptyState className="mt-section" illustration="emptyOpenings" title={t("hiringOpenings.emptyTitle")} body={t("hiringOpenings.emptyBody")} action={addButton} />
        ) : (
          // A reviewer sees only the openings they work on and cannot open one: no button to stare at.
          <EmptyState className="mt-section" illustration="emptyOpenings" title={t("hiringOpenings.emptyViewerTitle")} body={t("hiringOpenings.emptyViewerBody")} />
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
  const rows = (list: CockpitRow[]) => list.map((row) => <Row key={row.opening.id} row={row} userId={user.id} runs={runs} locale={locale} t={t} />);

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <PageTitle title={t("hiringOpenings.title")} sub={summary} action={addButton} />
      {tab ? <ScrollTo id={`group-${tab}`} /> : null}
      <div className="mt-section space-y-section">
        {drafts.length ? (
          <Group
            id="group-draft"
            title={t("hiringOpenings.groupSetup", { count: drafts.length })}
            columns={[t("hiringOpenings.colName"), t("hiringOpenings.colSetup"), t("hiringOpenings.colAttention"), t("hiringOpenings.colDeadline")]}
          >
            {rows(drafts)}
          </Group>
        ) : null}
        {open.length ? (
          <Group
            id="group-open"
            title={t("hiringOpenings.groupLive", { count: open.length })}
            columns={[t("hiringOpenings.colName"), t("hiringOpenings.colFunnel"), t("hiringOpenings.colAttention"), t("hiringOpenings.colDeadline")]}
          >
            {rows(open)}
          </Group>
        ) : null}
        {closed.length ? (
          <section id="group-closed" className="scroll-mt-6">
            <Disclosure label={t("hiringOpenings.groupClosed", { count: closed.length })} defaultOpen={tab === "closed"}>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">{rows(closed)}</ul>
              </Card>
            </Disclosure>
          </section>
        ) : null}
      </div>
    </main>
  );
}
