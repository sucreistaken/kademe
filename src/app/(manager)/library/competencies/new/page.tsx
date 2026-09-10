import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/session";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import { createCompetency } from "../../actions";

export default async function NewCompetencyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser("template:write");
  const locale = await managerLocale();
  const t = managerT(locale);
  const params = await searchParams;

  return (
    <main className="mx-auto max-w-[640px] px-6 py-10">
      <p className="text-[13px] text-muted">
        <Link href="/library" className="hover:text-ink hover:underline">
          {t("shared.libraryBreadcrumb")}
        </Link>{" "}
        / {t("competency.newBreadcrumb")}
      </p>
      <h1 className="mt-3 text-[26px] font-semibold tracking-tight">
        {t("competency.newTitle")}
      </h1>
      <p className="mt-1 text-sm text-muted">{t("competency.newLead")}</p>

      <Card className="mt-6 p-6">
        {/* Each field authors one language of a bilingual record, so it carries
            that language rather than the panel's. */}
        <form action={createCompetency} className="space-y-4">
          <Field label={t("competency.nameTr")} htmlFor="nameTr">
            <input
              id="nameTr"
              name="nameTr"
              lang="tr"
              required
              autoFocus
              className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm"
            />
          </Field>
          <Field
            label={t("competency.nameEn")}
            htmlFor="nameEn"
            hint={t("competency.nameEnHint")}
          >
            <input
              id="nameEn"
              name="nameEn"
              lang="en"
              className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm"
            />
          </Field>
          <Field
            label={t("competency.descriptionTr")}
            htmlFor="descriptionTr"
            hint={t("competency.descriptionTrHint")}
          >
            <textarea
              id="descriptionTr"
              name="descriptionTr"
              lang="tr"
              rows={2}
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t("competency.descriptionEn")} htmlFor="descriptionEn">
            <textarea
              id="descriptionEn"
              name="descriptionEn"
              lang="en"
              rows={2}
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm"
            />
          </Field>

          {params.error === "name" && (
            <p className="text-[13px] text-danger">{t("competency.errorName")}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" variant="primary" size="md">
              {t("competency.newTitle")}
            </Button>
            <Link href="/library" className="text-[13px] text-muted hover:text-ink hover:underline">
              {t("common.cancel")}
            </Link>
          </div>
        </form>
      </Card>
    </main>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[12.5px] text-muted">{hint}</p>}
    </div>
  );
}
