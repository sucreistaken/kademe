import { PageHead } from "@/components/panel/bits";
import { InviteForm, type ExamOption } from "@/components/panel/invite-form";
import { estimatedMinutes, enabledSections, type BlueprintConfig } from "@/lib/exam/blueprint";
import { examChoiceValue } from "@/lib/exam/exam-choice";
import { EXAM_TEMPLATES } from "@/lib/exam/templates";
import { CEFR_LEVELS, type Cefr } from "@/lib/exam/types";
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
export default async function InvitePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
  // Advanced "create" sends a just-published exam here (`?exam=<id>&claimed=<level>`).
  const sp = await searchParams;
  const wanted = typeof sp.exam === "string" ? examChoiceValue({ kind: "blueprint", id: sp.exam }) : null;
  const initialChoice = wanted && options.some((o) => o.value === wanted) ? wanted : undefined;
  const initialClaimed = typeof sp.claimed === "string" && (CEFR_LEVELS as readonly string[]).includes(sp.claimed) ? (sp.claimed as Cefr) : undefined;
  return (
    <main className="mx-auto max-w-[640px] px-6 py-10">
      <PageHead title={t("invite.title")} sub={t("invite.lead")} />
      <InviteForm counts={counts} options={options} initialChoice={initialChoice} initialClaimed={initialClaimed} />
    </main>
  );
}
