import { PageHead } from "@/components/panel/bits";
import { NewExamForm, type TemplateCard } from "@/components/panel/new-exam-form";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { enabledSections, estimatedMinutes } from "@/lib/exam/blueprint";
import { EXAM_TEMPLATES } from "@/lib/exam/templates";

/** Ready templates first, then the blank start. Everything else is set in the editor. */
export default async function NewExamPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("blueprint:write");
  const sp = await searchParams;
  const locale = await managerLocale();
  const t = managerT(locale);
  const templates: TemplateCard[] = EXAM_TEMPLATES.map((x) => ({
    key: x.key,
    name: x.name[locale],
    summary: x.summary[locale],
    meta: t("exams.templateMeta", {
      mode: t(`mode.${x.mode}`),
      minutes: estimatedMinutes(x.config),
      sections: enabledSections(x.config)
        .map((s) => t(`sectionName.${s.section}`))
        .join(", "),
    }),
  }));
  return (
    <main className="mx-auto max-w-[720px] px-6 py-10">
      <PageHead title={t("exams.newTitle")} />
      {sp.error === "template" ? <p className="mt-4 text-[13.5px] text-danger">{t("exams.templateError")}</p> : null}
      <NewExamForm templates={templates} />
    </main>
  );
}
