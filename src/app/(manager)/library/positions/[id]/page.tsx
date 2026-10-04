import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UndoStrip } from "@/components/ui/undo-strip";
import { PageTitle } from "@/components/manager/page-title";
import { ArchiveForm } from "@/components/library/archive-form";
import { PositionForm } from "@/components/library/position-form";
import { UsageBlock } from "@/components/library/usage-block";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { positionFormValue } from "@/lib/library/positions";
import { activeCompetencyOptions, libraryUsage, loadDefaultScale, loadPosition } from "@/server/library";
import { isUuid } from "@/server/settings";
import { requireUser } from "@/server/session";
import { SOLUTION_MANIFESTS } from "@/solutions/registry";
import { archivePositionAction, restorePositionAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function PositionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const locale = await managerLocale();
  const t = managerT(locale);
  const position = await loadPosition(user.orgId, id);
  if (!position) notFound();
  const [options, scale, usage, sp] = await Promise.all([
    activeCompetencyOptions(user.orgId),
    loadDefaultScale(user.orgId),
    libraryUsage(user.orgId, { positionIds: [id], competencyIds: [] }, locale),
    searchParams,
  ]);
  const canWrite = can(user, "library:write");
  const archived = position.archivedAt !== null;
  // The first solution that offers an action on a position owns the filled button (HIRING-UX 5.9).
  const action = archived ? null : (SOLUTION_MANIFESTS.find((m) => m.positionAction)?.positionAction ?? null);
  // A profile row whose competency was archived stays listed, by its stored name.
  const allOptions = [...options, ...position.profile.filter((p) => p.archived).map((p) => ({ id: p.competencyId, name: p.name }))];

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <Link href="/library/positions" className="text-[13px] text-muted hover:text-ink">
        {t("libPositions.back")}
      </Link>
      <div className="mt-3">
        <PageTitle
          title={position.name}
          sub={archived ? t("libPositions.archivedNote") : (position.team ?? undefined)}
          action={
            action ? (
              <Button asChild variant="primary">
                <Link href={action.href(position.id)}>{action.label[locale]}</Link>
              </Button>
            ) : undefined
          }
        />
      </div>
      <div className="mt-section grid gap-section lg:grid-cols-[minmax(0,1fr)_320px]">
        <PositionForm
          id={position.id}
          locale={locale}
          canWrite={canWrite && !archived}
          archived={archived}
          primary={!action}
          options={allOptions}
          levels={scale?.levels ?? []}
          initial={positionFormValue(position)}
        />
        <aside className="space-y-6">
          <UsageBlock
            title={t("libPositions.usageTitle")}
            empty={t("libPositions.usageEmpty")}
            groups={usage.positions[id] ?? []}
            lineLabel={(g) => t("libPositions.usageLine", { solution: g.label, count: g.entry.total })}
          />
          {canWrite ? (
            <ArchiveForm
              id={position.id}
              archived={archived}
              archiveAction={archivePositionAction}
              restoreAction={restorePositionAction}
              archiveLabel={t("libPositions.archive")}
              restoreLabel={t("libPositions.restore")}
            />
          ) : null}
        </aside>
      </div>
      {sp.archived && archived ? (
        <UndoStrip message={t("libPositions.archivedUndo")} action={restorePositionAction} hiddenFields={{ id: position.id }} />
      ) : null}
    </main>
  );
}
