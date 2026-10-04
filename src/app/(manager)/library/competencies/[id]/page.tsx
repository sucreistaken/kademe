import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UndoStrip } from "@/components/ui/undo-strip";
import { PageTitle } from "@/components/manager/page-title";
import { CompetencyForm, type CompetencyFormValue } from "@/components/library/competency-form";
import { UsageBlock } from "@/components/library/usage-block";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { pickText } from "@/lib/i18n-text";
import { liveCount } from "@/lib/library/usage";
import { libraryUsage, loadCompetency, loadDefaultScale, type CompetencyDetail } from "@/server/library";
import { isUuid } from "@/server/settings";
import { requireUser } from "@/server/session";
import { archiveCompetencyAction, restoreCompetencyAction } from "../../actions";

export const dynamic = "force-dynamic";

function formValue(c: CompetencyDetail): CompetencyFormValue {
  return {
    name: c.name,
    description: c.description,
    anchors: Object.fromEntries([1, 2, 3, 4, 5].map((l) => [l, c.anchors[l] ?? { tr: "", en: "" }])),
    tags: c.tags.map((tag) => ({ key: tag.id, id: tag.id, polarity: tag.polarity, label: tag.label })),
  };
}

export default async function CompetencyPage({
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
  const competency = await loadCompetency(user.orgId, id);
  if (!competency) notFound();
  const [scale, usage, sp] = await Promise.all([
    loadDefaultScale(user.orgId),
    libraryUsage(user.orgId, { positionIds: [], competencyIds: [id] }, locale),
    searchParams,
  ]);
  const groups = usage.competencies[id] ?? [];
  const canWrite = can(user, "library:write");

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <Link href="/library/competencies" className="text-[13px] text-muted hover:text-ink">
        {t("libCompetencies.back")}
      </Link>
      <div className="mt-3">
        <PageTitle
          title={pickText(competency.name, locale)}
          sub={competency.archivedAt ? t("libCompetencies.archivedNote") : competency.seededUnreviewed ? t("libCompetencies.seeded") : undefined}
        />
      </div>
      <div className="mt-section grid gap-section lg:grid-cols-[minmax(0,1fr)_320px]">
        <CompetencyForm
          id={competency.id}
          initial={formValue(competency)}
          levels={scale?.levels ?? []}
          canWrite={canWrite && !competency.archivedAt}
          archived={competency.archivedAt !== null}
          seededUnreviewed={competency.seededUnreviewed}
          liveCount={liveCount(groups)}
          locale={locale}
        />
        <aside className="space-y-6">
          <UsageBlock
            title={t("libCompetencies.usageTitle")}
            empty={t("libCompetencies.usageEmpty")}
            groups={groups}
            lineLabel={(g) => t("libCompetencies.usageLine", { solution: g.label, count: g.entry.total })}
          />
          {canWrite ? (
            <form action={competency.archivedAt ? restoreCompetencyAction : archiveCompetencyAction} className="space-y-2">
              <input type="hidden" name="id" value={competency.id} />
              <Button type="submit" variant="secondary" size="sm">
                {competency.archivedAt ? t("libCompetencies.restore") : t("libCompetencies.archive")}
              </Button>
              {competency.archivedAt ? null : <p className="text-[13px] text-muted">{t("libCompetencies.archiveHint")}</p>}
            </form>
          ) : null}
        </aside>
      </div>
      {sp.archived && competency.archivedAt ? (
        <UndoStrip message={t("libCompetencies.archivedUndo")} action={restoreCompetencyAction} hiddenFields={{ id: competency.id }} />
      ) : null}
    </main>
  );
}
