import { PageHead } from "@/components/panel/bits";
import { InviteForm, type ExamOption } from "@/components/panel/invite-form";
import { estimatedMinutes, enabledSections, type BlueprintConfig } from "@/lib/exam/blueprint";
import { examChoiceValue } from "@/lib/exam/exam-choice";
import { EXAM_TEMPLATES } from "@/lib/exam/templates";
import { bankCounts, publishedBlueprints } from "@/server/panel";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

export const dynamic = "force-dynamic";

const shape = (config: BlueprintConfig) => ({ config, minutes: estimatedMinutes(config), sections: enabledSections(config).length });

/**
 * The ready templates come first and are always there, so there is no "create
 * an exam first" state. A template the organisation already invited with is
 * `published`; the others are published on the first invite (see the action).
 * The organisation's own exams follow; the template-made ones are not listed
 * twice.
 */
export default async function InvitePage() {
  const user = await requireUser("student:invite");
  const locale = await managerLocale();
  const t = managerT(locale);
  const blueprints = await publishedBlueprints(user.orgId);
  const counts = await bankCounts(user.orgId);
  const publishedTemplates = new Set(blueprints.flatMap((b) => (b.templateKey ? [b.templateKey] : [])));
  const options: ExamOption[] = [
    ...EXAM_TEMPLATES.map((tpl) => ({
      value: examChoiceValue({ kind: "template", key: tpl.key }),
      group: "template" as const,
      name: tpl.name[locale],
      summary: tpl.summary[locale],
      mode: tpl.mode,
      published: publishedTemplates.has(tpl.key),
      ...shape(tpl.config),
    })),
    ...blueprints
      .filter((b) => !b.templateKey)
      .map((b) => ({
        value: examChoiceValue({ kind: "blueprint", id: b.id }),
        group: "own" as const,
        name: b.name,
        summary: null,
        mode: b.mode,
        published: true,
        ...shape(b.config),
      })),
  ];
  return (
    <main className="mx-auto max-w-[640px] px-6 py-10">
      <PageHead title={t("invite.title")} sub={t("invite.lead")} />
      <InviteForm counts={counts} options={options} />
    </main>
  );
}
