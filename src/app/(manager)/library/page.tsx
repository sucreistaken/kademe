import Link from "next/link";
import { InlineLink } from "@/components/ui/inline-link";
import { Card } from "@/components/ui/card";
import { Button, DisabledReason } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { UndoStrip } from "@/components/ui/undo-strip";
import { requireUser } from "@/server/session";
import { can } from "@/lib/authorize";
import { libraryCounts, loadLibrary } from "@/lib/library-data";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import { archiveCompetency, restoreCompetency } from "./actions";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const params = await searchParams;
  const library = await loadLibrary(user.orgId);
  const counts = libraryCounts(library);
  const mayEdit = can(user, "template:write");
  const isLastOne = library.competencies.length <= 1;

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{t("library.title")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t("library.summary", {
              competencies: counts.competencies,
              chips: counts.chips,
            })}
          </p>
        </div>
        {mayEdit ? (
          <Button asChild variant="primary" size="md">
            <Link href="/library/competencies/new">{t("library.addCompetency")}</Link>
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-1.5">
            <Button
              variant="primary"
              size="md"
              disabled
              disabledReason={t("shared.noRolePermission")}
            >
              {t("library.addCompetency")}
            </Button>
            <DisabledReason>{t("shared.roleCannotEditLibrary")}</DisabledReason>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold">{t("library.competenciesTitle")}</h2>
              <span className="text-[13px] text-muted">{t("library.sortedByName")}</span>
            </div>

            {library.competencies.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium">{t("library.emptyTitle")}</p>
                <p className="mt-1.5 text-[13px] text-muted">{t("library.emptyBody")}</p>
                <InlineLink
                  href="/library/competencies/new"
                  className="mt-3 inline-block text-[13px]"
                >
                  {t("library.addFirst")}
                </InlineLink>
              </div>
            ) : (
              <ul>
                {library.competencies.map((competency) => (
                  <li
                    key={competency.id}
                    className="flex items-start gap-4 border-b border-line px-5 py-4 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      {/* Both languages are shown because this is the authoring
                          view of a bilingual record. Each half carries its own
                          `lang` so casing and screen readers follow the text,
                          not the page. */}
                      <div className="flex flex-wrap items-baseline gap-2">
                        <Link
                          href={`/library/competencies/${competency.id}`}
                          lang="tr"
                          className="text-sm font-medium hover:underline"
                        >
                          {competency.name.tr}
                        </Link>
                        <span lang="en" className="text-[13px] text-muted">
                          {competency.name.en}
                        </span>
                      </div>
                      {competency.description?.[locale] || competency.description?.tr ? (
                        <p lang={competency.description?.[locale] ? locale : "tr"} className="mt-1 text-[13px] text-muted">
                          {competency.description?.[locale] || competency.description?.tr}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-[13px] text-muted">
                        {t("library.tagCounts", {
                          positive: competency.positiveCount,
                          negative: competency.negativeCount,
                        })}{" "}
                        ·{" "}
                        {competency.usageCount > 0
                          ? t("library.usedIn", { count: competency.usageCount })
                          : t("library.notUsed")}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/library/competencies/${competency.id}`}
                        className="rounded-[8px] border border-line px-3 py-1.5 text-[13px] hover:bg-canvas"
                      >
                        {t("shared.edit")}
                      </Link>
                      {mayEdit &&
                        (isLastOne ? (
                          <div className="flex flex-col items-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              disabledReason={t("library.lastOne")}
                            >
                              {t("shared.archive")}
                            </Button>
                            <DisabledReason>{t("library.lastOneLong")}</DisabledReason>
                          </div>
                        ) : (
                          <form action={archiveCompetency}>
                            <input type="hidden" name="competencyId" value={competency.id} />
                            <input
                              type="hidden"
                              name="name"
                              value={competency.name[locale] || competency.name.tr}
                            />
                            <Button type="submit" variant="ghost" size="sm">
                              {t("shared.archive")}
                            </Button>
                          </form>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {library.archived.length > 0 && (
            <Card>
              <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
                <h2 className="text-[15px] font-semibold">{t("library.archivedTitle")}</h2>
                <span className="text-[13px] text-muted">{t("library.archivedHint")}</span>
              </div>
              <ul>
                {library.archived.map((competency) => (
                  <li
                    key={competency.id}
                    className="flex items-center justify-between gap-4 border-b border-line
                               px-5 py-3.5 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {competency.name[locale] || competency.name.tr}
                      </p>
                      <StatusDot tone="done">
                        {competency.usageCount > 0
                          ? t("library.wasUsedIn", { count: competency.usageCount })
                          : t("library.neverUsed")}
                      </StatusDot>
                    </div>
                    {mayEdit && (
                      <form action={restoreCompetency}>
                        <input type="hidden" name="competencyId" value={competency.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          {t("shared.restore")}
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* ---- the scale ---- */}
        <Card className="h-fit">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold">{t("shared.ratingScale")}</h2>
          </div>
          {library.scale ? (
            <>
              <div className="px-5 py-3.5">
                <p className="text-sm">{library.scale.name}</p>
                <p className="mt-1 text-[13px] text-muted">
                  {t("library.scaleSummary", {
                    min: library.scale.minValue,
                    max: library.scale.maxValue,
                    levels: library.scale.levels.length,
                  })}
                </p>
              </div>
              <ul className="px-5 pb-3">
                {library.scale.levels.map((level) => (
                  <li key={level.id} className="py-1 text-[13px] text-muted">
                    <span className="tnum">{level.value}</span> ·{" "}
                    {level.label[locale] || level.label.tr}
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-5 py-3.5">
                <InlineLink href="/library/scale" className="text-[13px]">
                  {t("shared.editScale")}
                </InlineLink>
              </div>
            </>
          ) : (
            <div className="px-5 py-6">
              <p className="text-[13px] text-muted">{t("library.noScale")}</p>
            </div>
          )}
        </Card>
      </div>

      {params.undo === "competency" && typeof params.competencyId === "string" && (
        <UndoStrip
          message={t("library.undoArchive", {
            name:
              typeof params.who === "string" && params.who
                ? params.who
                : t("shared.competency"),
          })}
          action={restoreCompetency}
          hiddenFields={{ competencyId: params.competencyId }}
        />
      )}
    </main>
  );
}
