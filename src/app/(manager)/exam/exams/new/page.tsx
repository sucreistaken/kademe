import { NewExamWizard, type ExamTemplateCard } from "@/components/panel/new-exam-wizard";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { enabledSections, estimatedMinutes } from "@/lib/exam/blueprint";
import { EXAM_TEMPLATES } from "@/lib/exam/templates";
import { bankCounts } from "@/server/panel";
import { contentLocale } from "@/i18n/locale";

export const dynamic = "force-dynamic";

/**
 * "Yeni sınav" as a guided flow (NewExamWizard): a ready template or blank,
 * the sections and minutes, the watching level, a last look and "Yayınla".
 * The bank's counts come along so the last step says before publishing
 * whether the bank can fill the exam.
 */
export default async function NewExamPage() {
  const user = await requireUser("blueprint:write");
  const locale = await managerLocale();
  const t = managerT(locale);
  const templates: ExamTemplateCard[] = EXAM_TEMPLATES.map((x) => ({
    key: x.key,
    mode: x.mode,
    name: x.name[contentLocale(locale)],
    summary: x.summary[contentLocale(locale)],
    config: x.config,
    meta: t("exams.templateMeta", {
      mode: t(`mode.${x.mode}`),
      minutes: estimatedMinutes(x.config),
      sections: enabledSections(x.config)
        .map((s) => t(`sectionName.${s.section}`))
        .join(", "),
    }),
  }));
  // The flow draws its own head (the flow's name and "Çık") and its steps' titles, as the hiring wizard.
  return (
    <main className="mx-auto max-w-[1080px] px-page pt-6">
      <NewExamWizard templates={templates} counts={await bankCounts(user.orgId)} />
    </main>
  );
}
