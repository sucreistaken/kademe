import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageTitle } from "@/components/manager/page-title";
import { LibraryAddButton } from "@/components/library/add-button";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { libraryUsage, listPositions, type PositionRow } from "@/server/library";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

/** HIRING-UX 5.9: the organisation's positions, with team, competency count and usage. */
export default async function PositionsPage() {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const rows = await listPositions(user.orgId);
  const addButton = (
    <LibraryAddButton
      href="/library/positions/new"
      label={t("libPositions.add")}
      canWrite={can(user, "library:write")}
      noPermission={t("libPositions.noPermission")}
    />
  );

  const usage = rows.length
    ? await libraryUsage(user.orgId, { positionIds: rows.map((r) => r.id), competencyIds: [] }, locale, user)
    : { positions: {}, competencies: {} };
  const table = (list: PositionRow[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("libPositions.colName")}</TableHead>
          <TableHead>{t("libPositions.colTeam")}</TableHead>
          <TableHead>{t("libPositions.colCompetencies")}</TableHead>
          <TableHead>{t("libPositions.colUsage")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((row) => {
          const groups = usage.positions[row.id] ?? [];
          return (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={`/library/positions/${row.id}`} className="font-medium text-ink hover:underline">
                  {row.name}
                </Link>
              </TableCell>
              <TableCell className="text-[13px] text-muted">{row.team ?? "-"}</TableCell>
              <TableCell className="tnum text-[13px] text-muted">{t("libPositions.competencyCount", { count: row.competencyCount })}</TableCell>
              <TableCell className="tnum text-[13px] text-muted">
                {groups.length ? groups.map((g) => t("libPositions.usageLine", { solution: g.label, count: g.entry.total })).join(", ") : "-"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
  const active = rows.filter((r) => !r.archivedAt);
  const archived = rows.filter((r) => r.archivedAt);

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      {active.length ? (
        <>
          <PageTitle title={t("libPositions.title")} sub={t("libPositions.sub")} action={addButton} />
          <Card className="mt-section overflow-x-auto">{table(active)}</Card>
        </>
      ) : (
        <>
          {/* No active position: the empty state holds the one filled button, archived rows stay below. */}
          <PageTitle title={t("libPositions.title")} sub={t("libPositions.sub")} />
          <Empty className="mt-section border border-line">
            <EmptyHeader>
              <EmptyTitle>{t("libPositions.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("libPositions.emptyBody")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>{addButton}</EmptyContent>
          </Empty>
        </>
      )}
      {archived.length ? (
        <Collapsible className="mt-section">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {t("libPositions.archivedTitle", { count: archived.length })}
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
