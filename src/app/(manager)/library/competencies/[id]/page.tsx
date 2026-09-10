import Link from "next/link";
import { InlineLink } from "@/components/ui/inline-link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button, DisabledReason } from "@/components/ui/button";
import { UndoStrip } from "@/components/ui/undo-strip";
import { requireUser } from "@/server/session";
import { can } from "@/lib/authorize";
import { loadCompetency, type OptionView } from "@/lib/library-data";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import type { Locale } from "@/i18n/locale";
import {
  addOption,
  archiveOption,
  restoreOption,
  updateCompetency,
} from "../../actions";

export default async function CompetencyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const { id } = await params;
  const query = await searchParams;
  const detail = await loadCompetency(user.orgId, id);
  if (!detail) notFound();

  const { competency, positive, negative, archivedOptions, scale } = detail;
  const mayEdit = can(user, "template:write");
  const displayName = competency.name[locale] || competency.name.tr;

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <p className="text-[13px] text-muted">
        <Link href="/library" className="hover:text-ink hover:underline">
          {t("shared.libraryBreadcrumb")}
        </Link>{" "}
        / {displayName}
      </p>

      <div className="mt-3">
        <h1 className="text-[26px] font-semibold tracking-tight">{displayName}</h1>
        <p className="mt-1 text-sm text-muted">
          {competency.usageCount > 0
            ? t("competency.usedIn", { count: competency.usageCount })
            : t("competency.notUsed")}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* ---- name and description ---- */}
          <Card>
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold">{t("competency.definition")}</h2>
            </div>
            <form action={updateCompetency} className="space-y-4 px-5 py-5">
              <input type="hidden" name="competencyId" value={competency.id} />
              <fieldset className="space-y-4" disabled={!mayEdit}>
                {/* Each field authors one language of a bilingual record, so it
                    carries that language rather than the panel's. */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Labelled label={t("competency.nameTr")} htmlFor="nameTr">
                    <input
                      id="nameTr"
                      name="nameTr"
                      lang="tr"
                      defaultValue={competency.name.tr}
                      required
                      className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm disabled:text-muted"
                    />
                  </Labelled>
                  <Labelled label={t("competency.nameEn")} htmlFor="nameEn">
                    <input
                      id="nameEn"
                      name="nameEn"
                      lang="en"
                      defaultValue={competency.name.en}
                      className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm disabled:text-muted"
                    />
                  </Labelled>
                  <Labelled label={t("competency.descriptionTr")} htmlFor="descriptionTr">
                    <textarea
                      id="descriptionTr"
                      name="descriptionTr"
                      lang="tr"
                      rows={3}
                      defaultValue={competency.description?.tr ?? ""}
                      className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm disabled:text-muted"
                    />
                  </Labelled>
                  <Labelled label={t("competency.descriptionEn")} htmlFor="descriptionEn">
                    <textarea
                      id="descriptionEn"
                      name="descriptionEn"
                      lang="en"
                      rows={3}
                      defaultValue={competency.description?.en ?? ""}
                      className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm disabled:text-muted"
                    />
                  </Labelled>
                </div>
              </fieldset>

              {query.error === "name" && (
                <p className="text-[13px] text-danger">{t("competency.errorName")}</p>
              )}

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!mayEdit}
                  disabledReason={mayEdit ? undefined : t("shared.noRolePermission")}
                >
                  {t("competency.saveChanges")}
                </Button>
                {!mayEdit && (
                  <DisabledReason>{t("shared.roleCannotEditLibrary")}</DisabledReason>
                )}
                {query.saved === "1" && (
                  <span className="text-[13px] text-muted">{t("competency.savedNote")}</span>
                )}
                {query.created === "1" && (
                  <span className="text-[13px] text-muted">
                    {t("competency.createdNote")}
                  </span>
                )}
              </div>
            </form>
          </Card>

          {/* ---- observation chips ---- */}
          <Card>
            <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold">{t("competency.chipsTitle")}</h2>
              <span className="text-[13px] text-muted">{t("competency.chipsHint")}</span>
            </div>

            <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
              <ChipColumn
                title={t("competency.positive")}
                emptyText={t("competency.positiveEmpty")}
                removeLabel={t("shared.remove")}
                options={positive}
                competencyId={competency.id}
                mayEdit={mayEdit}
                locale={locale}
              />
              <ChipColumn
                title={t("competency.negative")}
                emptyText={t("competency.negativeEmpty")}
                removeLabel={t("shared.remove")}
                options={negative}
                competencyId={competency.id}
                mayEdit={mayEdit}
                locale={locale}
                bordered
              />
            </div>

            {mayEdit && (
              <form
                action={addOption}
                className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-4"
              >
                <input type="hidden" name="competencyId" value={competency.id} />
                <div className="min-w-[220px] flex-1">
                  <label htmlFor="labelTr" className="mb-1.5 block text-[13px] text-muted">
                    {t("competency.newLabelTr")}
                  </label>
                  <input
                    id="labelTr"
                    name="labelTr"
                    lang="tr"
                    required
                    placeholder={t("competency.newLabelTrPlaceholder")}
                    className="h-9 w-full rounded-[10px] border border-line bg-surface px-3 text-sm"
                  />
                </div>
                <div className="min-w-[200px] flex-1">
                  <label htmlFor="labelEn" className="mb-1.5 block text-[13px] text-muted">
                    {t("competency.newLabelEn")}
                  </label>
                  <input
                    id="labelEn"
                    name="labelEn"
                    lang="en"
                    placeholder={t("competency.newLabelEnPlaceholder")}
                    className="h-9 w-full rounded-[10px] border border-line bg-surface px-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="polarity" className="mb-1.5 block text-[13px] text-muted">
                    {t("competency.polarity")}
                  </label>
                  <select
                    id="polarity"
                    name="polarity"
                    className="h-9 rounded-[10px] border border-line bg-surface px-2.5 text-[13px]"
                  >
                    <option value="POSITIVE">{t("competency.positive")}</option>
                    <option value="NEGATIVE">{t("competency.negative")}</option>
                  </select>
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  {t("shared.add")}
                </Button>
              </form>
            )}

            {archivedOptions.length > 0 && (
              <div className="border-t border-line px-5 py-4">
                <p className="text-[13px] text-muted">{t("competency.archivedChips")}</p>
                <ul className="mt-2 space-y-1.5">
                  {archivedOptions.map((option) => (
                    <li key={option.id} className="flex items-center justify-between gap-3">
                      <span className="text-[13px] text-muted">
                        {option.polarity === "POSITIVE" ? "+" : "−"}{" "}
                        {option.label[locale] || option.label.tr}
                      </span>
                      {mayEdit && (
                        <form action={restoreOption}>
                          <input type="hidden" name="optionId" value={option.id} />
                          <input type="hidden" name="competencyId" value={competency.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            {t("shared.restore")}
                          </Button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        {/* ---- the scale, read only here ---- */}
        <Card className="h-fit">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold">{t("shared.ratingScale")}</h2>
          </div>
          {scale ? (
            <>
              <div className="px-5 py-3.5">
                <p className="text-[13px] text-muted">
                  {t("competency.scaleShared", { name: scale.name })}
                </p>
              </div>
              <ul className="px-5 pb-2">
                {scale.levels.map((level) => (
                  <li key={level.id} className="border-t border-line py-2.5 first:border-t-0">
                    <p className="text-[13px]">
                      <span className="tnum font-medium">{level.value}</span> ·{" "}
                      {level.label[locale] || level.label.tr}
                    </p>
                    {level.anchor?.[locale] || level.anchor?.tr ? (
                      <p className="mt-1 text-[12.5px] text-muted">
                        {level.anchor?.[locale] || level.anchor?.tr}
                      </p>
                    ) : null}
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
              <p className="text-[13px] text-muted">{t("competency.noScale")}</p>
            </div>
          )}
        </Card>
      </div>

      {query.undo === "option" && typeof query.optionId === "string" && (
        <UndoStrip
          message={t("competency.undoArchiveOption", {
            name:
              typeof query.who === "string" && query.who ? query.who : t("shared.tag"),
          })}
          action={restoreOption}
          hiddenFields={{ optionId: query.optionId, competencyId: competency.id }}
        />
      )}
    </main>
  );
}

function ChipColumn({
  title,
  emptyText,
  removeLabel,
  options,
  competencyId,
  mayEdit,
  locale,
  bordered = false,
}: {
  title: string;
  emptyText: string;
  removeLabel: string;
  options: OptionView[];
  competencyId: string;
  mayEdit: boolean;
  locale: Locale;
  bordered?: boolean;
}) {
  return (
    <div className={bordered ? "md:border-l md:border-line" : undefined}>
      <p className="px-5 pt-4 text-[13px] font-medium text-muted">{title}</p>
      {options.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-muted">{emptyText}</p>
      ) : (
        <ul className="px-5 py-2">
          {options.map((option) => (
            <li key={option.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0 text-sm">
                <span className="text-muted">
                  {option.polarity === "POSITIVE" ? "+" : "−"}
                </span>{" "}
                {option.label[locale] || option.label.tr}
              </span>
              {mayEdit && (
                <form action={archiveOption}>
                  <input type="hidden" name="optionId" value={option.id} />
                  <input type="hidden" name="competencyId" value={competencyId} />
                  <input
                    type="hidden"
                    name="label"
                    value={option.label[locale] || option.label.tr}
                  />
                  <Button type="submit" variant="ghost" size="sm">
                    {removeLabel}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Labelled({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
