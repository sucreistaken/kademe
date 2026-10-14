import { StudentInviteWizard, type ExamOption } from "@/components/panel/student-invite-wizard";
import { estimatedMinutes, enabledSections, type BlueprintConfig } from "@/lib/exam/blueprint";
import { examChoiceValue } from "@/lib/exam/exam-choice";
import { EXAM_TEMPLATES } from "@/lib/exam/templates";
import { CEFR_LEVELS, type Cefr } from "@/lib/exam/types";
import { LINK_TTL_DAYS } from "@/server/invite";
import { bankCounts, listStudents, publishedBlueprints } from "@/server/panel";
import { requireUser } from "@/server/session";
import { isCurrentTemplate } from "@/server/template-blueprint";
import { managerLocale } from "@/i18n/manager-locale";

export const dynamic = "force-dynamic";

const shape = (config: BlueprintConfig) => ({ config, minutes: estimatedMinutes(config), sections: enabledSections(config).length });

/**
 * "Öğrenci davet et" as a guided flow (StudentInviteWizard). The school's
 * own published exams come first (the one it just made is usually what it
 * wants), then the ready templates, which are always there, so there is no
 * "create an exam first" state. A template the organisation already invited
 * with is `published`; the others are published on the first invite. The
 * template-made exams are not listed twice. An exam published from an older
 * version of a template does not count: the next invite replaces it with the
 * template as shown here (ensureTemplateBlueprint).
 */
export default async function InvitePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("student:invite");
  const locale = await managerLocale();
  const [blueprints, counts, students] = await Promise.all([publishedBlueprints(user.orgId), bankCounts(user.orgId), listStudents(user.orgId)]);
  const publishedTemplates = new Set(
    blueprints.flatMap((b) => {
      const tpl = b.templateKey ? EXAM_TEMPLATES.find((x) => x.key === b.templateKey) : undefined;
      return tpl && isCurrentTemplate(b, tpl) ? [tpl.key] : [];
    }),
  );
  const options: ExamOption[] = [
    ...blueprints
      .filter((b) => !b.templateKey)
      // The newest first: the exam just made is usually the one wanted.
      .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
      .map((b) => ({
        value: examChoiceValue({ kind: "blueprint", id: b.id }),
        group: "own" as const,
        name: b.name,
        summary: null,
        mode: b.mode,
        published: true,
        ...shape(b.config),
      })),
    ...EXAM_TEMPLATES.map((tpl) => ({
      value: examChoiceValue({ kind: "template", key: tpl.key }),
      group: "template" as const,
      templateKey: tpl.key,
      name: tpl.name[locale],
      summary: tpl.summary[locale],
      mode: tpl.mode,
      published: publishedTemplates.has(tpl.key),
      ...shape(tpl.config),
    })),
  ];
  // The exam wizard and Advanced "create" send a just-published exam here (`?exam=<id>&claimed=<level>`).
  const sp = await searchParams;
  const wanted = typeof sp.exam === "string" ? examChoiceValue({ kind: "blueprint", id: sp.exam }) : null;
  const initialChoice = wanted && options.some((o) => o.value === wanted) ? wanted : undefined;
  const initialClaimed = typeof sp.claimed === "string" && (CEFR_LEVELS as readonly string[]).includes(sp.claimed) ? (sp.claimed as Cefr) : undefined;
  // A student who still has a link to use: a new invitation would be a second exam, so the last step names them.
  const openEmails = students.filter((s) => (s.status === "NOT_STARTED" || s.status === "IN_EXAM") && s.email).map((s) => s.email.toLowerCase());
  const now = new Date();
  const lastDay = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(now.getTime() + LINK_TTL_DAYS * 86_400_000));
  // The flow draws its own head (the flow's name and "Çık") and its steps' titles, as the hiring invite.
  return (
    <main className="mx-auto max-w-[1080px] px-page pt-6">
      <StudentInviteWizard options={options} counts={counts} openEmails={openEmails} linkDays={LINK_TTL_DAYS} lastDay={lastDay} initialChoice={initialChoice} initialClaimed={initialClaimed} />
    </main>
  );
}
