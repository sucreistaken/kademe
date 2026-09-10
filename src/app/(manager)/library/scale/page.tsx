import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/session";
import { loadScale } from "@/lib/library-data";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import { updateScale } from "../actions";

export default async function ScalePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("template:write");
  const locale = await managerLocale();
  const t = managerT(locale);
  const params = await searchParams;
  const scale = await loadScale(user.orgId);
  if (!scale) notFound();

  return (
    <main className="mx-auto max-w-[820px] px-6 py-10">
      <p className="text-[13px] text-muted">
        <Link href="/library" className="hover:text-ink hover:underline">
          {t("shared.libraryBreadcrumb")}
        </Link>{" "}
        / {t("scale.breadcrumb")}
      </p>
      <h1 className="mt-3 text-[26px] font-semibold tracking-tight">{scale.name}</h1>
      <p className="mt-1 text-sm text-muted">{t("scale.lead")}</p>
      <p className="mt-3 text-[13px] text-muted">{t("scale.warning")}</p>

      <form action={updateScale} className="mt-6 space-y-4">
        <input type="hidden" name="scaleId" value={scale.id} />

        {scale.levels.map((level) => (
          <Card key={level.id} className="p-5">
            <div className="flex items-baseline gap-3">
              <span className="tnum text-[18px] font-semibold">{level.value}</span>
              <span className="text-[13px] text-muted">{t("scale.level")}</span>
            </div>

            {/* Each field authors one language of a bilingual record, so it
                carries that language rather than the panel's. */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor={`label-tr-${level.id}`}
                  className="mb-1.5 block text-[13px] text-muted"
                >
                  {t("scale.labelTr")}
                </label>
                <input
                  id={`label-tr-${level.id}`}
                  name={`label-tr-${level.id}`}
                  lang="tr"
                  defaultValue={level.label.tr}
                  required
                  className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor={`label-en-${level.id}`}
                  className="mb-1.5 block text-[13px] text-muted"
                >
                  {t("scale.labelEn")}
                </label>
                <input
                  id={`label-en-${level.id}`}
                  name={`label-en-${level.id}`}
                  lang="en"
                  defaultValue={level.label.en}
                  className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor={`anchor-tr-${level.id}`}
                  className="mb-1.5 block text-[13px] text-muted"
                >
                  {t("scale.anchorTr")}
                </label>
                <textarea
                  id={`anchor-tr-${level.id}`}
                  name={`anchor-tr-${level.id}`}
                  lang="tr"
                  rows={3}
                  defaultValue={level.anchor?.tr ?? ""}
                  className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor={`anchor-en-${level.id}`}
                  className="mb-1.5 block text-[13px] text-muted"
                >
                  {t("scale.anchorEn")}
                </label>
                <textarea
                  id={`anchor-en-${level.id}`}
                  name={`anchor-en-${level.id}`}
                  lang="en"
                  rows={3}
                  defaultValue={level.anchor?.en ?? ""}
                  className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm"
                />
              </div>
            </div>
          </Card>
        ))}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" size="md">
            {t("scale.save")}
          </Button>
          {params.saved === "1" && (
            <span className="text-[13px] text-muted">{t("scale.saved")}</span>
          )}
          <Link href="/library" className="text-[13px] text-muted hover:text-ink hover:underline">
            {t("shared.backToLibrary")}
          </Link>
        </div>
      </form>
    </main>
  );
}
