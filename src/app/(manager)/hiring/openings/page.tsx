import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageTitle } from "@/components/manager/page-title";
import { RouteTabs } from "@/components/manager/route-tabs";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { shortDate } from "@/lib/format";
import { requireUser } from "@/server/session";
import { listOpenings } from "@/solutions/hiring/server/openings";
import { TONE } from "./[id]/opening-header";

export const dynamic = "force-dynamic";

const TABS = [
  ["open", "OPEN", "tabOpen"],
  ["draft", "DRAFT", "tabDraft"],
  ["closed", "CLOSED", "tabClosed"],
] as const;

/** HIRING-UX 5.2: which openings are live and which are stuck. A table, not cards. */
export default async function OpeningsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const lists = await Promise.all(TABS.map(([, status]) => listOpenings(user.orgId, user, status)));
  const total = lists.reduce((n, l) => n + l.length, 0);
  // An explicit tab wins; without one, the first tab that has openings (a first draft is not hidden behind an empty "Açık").
  const asked = TABS.findIndex(([key]) => key === sp.tab);
  const tabIndex = asked >= 0 ? asked : Math.max(0, lists.findIndex((l) => l.length > 0));
  const rows = lists[tabIndex];
  const canWrite = can(user, "opening:write");
  const addButton = canWrite ? (
    <Button asChild variant="primary">
      <Link href="/hiring/openings/new">{t("hiringOpenings.add")}</Link>
    </Button>
  ) : (
    <>
      <Button variant="primary" disabled disabledReason={t("hiringOpenings.noPermission")}>
        {t("hiringOpenings.add")}
      </Button>
      <DisabledReason>{t("hiringOpenings.noPermission")}</DisabledReason>
    </>
  );

  if (total === 0) {
    return (
      <main className="mx-auto max-w-[1360px] px-page py-8">
        <PageTitle title={t("hiringOpenings.title")} sub={t("hiringOpenings.sub")} />
        <Empty className="mt-section border border-line bg-surface py-16">
          {canWrite ? (
            <>
              <EmptyHeader>
                <EmptyTitle>{t("hiringOpenings.emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("hiringOpenings.emptyBody")}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>{addButton}</EmptyContent>
            </>
          ) : (
            // A reviewer sees only the openings they work on and cannot open one: no button to stare at.
            <EmptyHeader>
              <EmptyTitle>{t("hiringOpenings.emptyViewerTitle")}</EmptyTitle>
              <EmptyDescription>{t("hiringOpenings.emptyViewerBody")}</EmptyDescription>
            </EmptyHeader>
          )}
        </Empty>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <PageTitle title={t("hiringOpenings.title")} sub={t("hiringOpenings.sub")} action={addButton} />
      <div className="mt-6">
        <RouteTabs
          label={t("hiringOpenings.tabsLabel")}
          items={TABS.map(([key, , label], i) => ({
            href: `/hiring/openings?tab=${key}`,
            label: t(`hiringOpenings.${label}`, { count: lists[i].length }),
            active: i === tabIndex,
          }))}
        />
      </div>
      {rows.length === 0 ? (
        <Empty className="mt-section border border-line bg-surface py-12">
          <EmptyHeader>
            <EmptyTitle>{t("hiringOpenings.emptyTabTitle")}</EmptyTitle>
            <EmptyDescription>{t("hiringOpenings.emptyTabBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="mt-section overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("hiringOpenings.colName")}</TableHead>
                <TableHead>{t("hiringOpenings.colStatus")}</TableHead>
                <TableHead>{t("hiringOpenings.colFunnel")}</TableHead>
                <TableHead>{t("hiringOpenings.colDeadline")}</TableHead>
                <TableHead>{t("hiringOpenings.colOwner")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="py-3">
                    <Link href={`/hiring/openings/${row.id}`} className="font-medium text-ink hover:underline">
                      {row.name}
                    </Link>
                    <p className="text-[12px] leading-4 text-muted">{row.positionName}</p>
                  </TableCell>
                  <TableCell>
                    <StatusDot tone={TONE[row.status]}>
                      <span className="tnum">
                        {t(`hiringCommon.status${row.status}`)}
                        {row.liveNumber ? ` · v${row.liveNumber}` : ""}
                      </span>
                    </StatusDot>
                    {/* A live opening with an edit in progress: the draft is not lost behind "Yayında". */}
                    {row.liveNumber && row.draftNumber ? (
                      <p className="tnum mt-0.5 pl-3.5 text-[12px] leading-4 text-muted">{t("hiringOpenings.draftWaiting", { number: row.draftNumber })}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted">{t("hiringOpenings.funnelEmpty")}</TableCell>
                  <TableCell className="tnum text-[13px] text-muted">{row.deadlineAt ? shortDate(row.deadlineAt, locale) : "-"}</TableCell>
                  <TableCell className="text-[13px] text-muted">{row.ownerName ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </main>
  );
}
