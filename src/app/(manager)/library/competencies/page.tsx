import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageTitle } from "@/components/manager/page-title";
import { RouteTabs } from "@/components/manager/route-tabs";
import { LibraryAddButton } from "@/components/library/add-button";
import { ScaleForm } from "@/components/library/scale-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { pickText } from "@/lib/i18n-text";
import { libraryUsage, listCompetencies, loadDefaultScale, type CompetencyRow } from "@/server/library";
import { requireUser } from "@/server/session";
import { startLibraryAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function CompetenciesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const tab = sp.tab === "scales" ? "scales" : "list";
  const canWrite = can(user, "library:write");
  const scale = await loadDefaultScale(user.orgId);

  if (!scale) {
    return (
      <main className="mx-auto max-w-[1360px] px-page py-8">
        <PageTitle title={t("libCompetencies.title")} sub={t("libCompetencies.sub")} />
        <Empty className="mt-section border border-line">
          <EmptyHeader>
            <EmptyTitle>{t("libCompetencies.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("libCompetencies.emptyBody")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <form action={startLibraryAction}>
              <Button type="submit" variant="primary" disabled={!canWrite} disabledReason={canWrite ? undefined : t("libCompetencies.noPermission")}>
                {t("libCompetencies.start")}
              </Button>
            </form>
            {!canWrite ? <DisabledReason>{t("libCompetencies.noPermission")}</DisabledReason> : null}
          </EmptyContent>
        </Empty>
      </main>
    );
  }

  const tabs = (
    <RouteTabs
      label={t("libCompetencies.tabsLabel")}
      items={[
        { href: "/library/competencies", label: t("libCompetencies.tabList"), active: tab === "list" },
        { href: "/library/competencies?tab=scales", label: t("libCompetencies.tabScales"), active: tab === "scales" },
      ]}
    />
  );

  if (tab === "scales") {
    return (
      <main className="mx-auto max-w-[1360px] px-page py-8">
        <PageTitle title={t("libCompetencies.title")} sub={t("libCompetencies.sub")} />
        <div className="mt-6">{tabs}</div>
        <div className="mt-section max-w-[880px]">
          <ScaleForm levels={scale.levels} canEdit={can(user, "library:scale")} />
        </div>
      </main>
    );
  }

  const rows = await listCompetencies(user.orgId);
  const usage = await libraryUsage(user.orgId, { positionIds: [], competencyIds: rows.map((r) => r.id) }, locale);
  const active = rows.filter((r) => !r.archivedAt);
  const archived = rows.filter((r) => r.archivedAt);

  const table = (list: CompetencyRow[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("libCompetencies.colName")}</TableHead>
          <TableHead>{t("libCompetencies.colAnchors")}</TableHead>
          <TableHead>{t("libCompetencies.colTags")}</TableHead>
          <TableHead>{t("libCompetencies.colUsage")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((row) => {
          const groups = usage.competencies[row.id] ?? [];
          return (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={`/library/competencies/${row.id}`} className="font-medium text-ink hover:underline">
                  {pickText(row.name, locale)}
                </Link>
                {row.seededUnreviewed ? <p className="text-[12px] text-muted">{t("libCompetencies.seeded")}</p> : null}
              </TableCell>
              <TableCell>
                {row.missingLevels.length ? (
                  <StatusDot tone="warn">{t("libCompetencies.anchorsMissing", { level: row.missingLevels[0] })}</StatusDot>
                ) : (
                  <StatusDot tone="done">{t("libCompetencies.anchorsDone")}</StatusDot>
                )}
              </TableCell>
              <TableCell className="tnum text-[13px] text-muted">
                {t("libCompetencies.tagCount", { positive: row.positiveTags, negative: row.negativeTags })}
              </TableCell>
              <TableCell className="tnum text-[13px] text-muted">
                {groups.length ? groups.map((g) => t("libCompetencies.usageLine", { solution: g.label, count: g.entry.total })).join(", ") : "-"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <PageTitle
        title={t("libCompetencies.title")}
        sub={t("libCompetencies.sub")}
        action={
          <LibraryAddButton
            href="/library/competencies/new"
            label={t("libCompetencies.add")}
            canWrite={canWrite}
            noPermission={t("libCompetencies.noPermission")}
          />
        }
      />
      <div className="mt-6">{tabs}</div>
      <Card className="mt-section overflow-x-auto">{table(active)}</Card>
      {archived.length ? (
        <Collapsible className="mt-section">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {t("libCompetencies.archivedTitle", { count: archived.length })}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-3 overflow-x-auto">{table(archived)}</Card>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </main>
  );
}
