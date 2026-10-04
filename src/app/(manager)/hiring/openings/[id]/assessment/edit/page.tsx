import { notFound } from "next/navigation";
import { Builder } from "@/components/hiring/builder/builder";
import { StatusDot } from "@/components/ui/status-dot";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { pickText } from "@/lib/i18n-text";
import { activeCompetencyOptions } from "@/server/library";
import { isUuid } from "@/server/settings";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "../../access";
import type { PublishNotice } from "../../actions";
import { AssessmentTabs, OpeningHeader } from "../../opening-header";
import { describeProblem } from "../../problems";

export const dynamic = "force-dynamic";

/** What "Yayınla" (?publish=) and "Düzenlemeye başla" (?draft=) answered, each with its own sentence. */
const PUBLISH_NOTICES: Record<PublishNotice, "hiringBuilder.publishRefused" | `hiringOverview.${"publishNoDraft" | "publishClosed" | "publishInvalid" | "publishFailed"}`> = {
  refused: "hiringBuilder.publishRefused",
  nodraft: "hiringOverview.publishNoDraft",
  closed: "hiringOverview.publishClosed",
  invalid: "hiringOverview.publishInvalid",
  failed: "hiringOverview.publishFailed",
};
const DRAFT_NOTICES = { closed: "hiringBuilder.draftClosed", failed: "hiringBuilder.draftFailed" } as const;

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/** HIRING-UX 5.5: the assessment builder. A live version is shown read-only until "Düzenlemeye başla". */
export default async function BuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const [state, options] = await Promise.all([workingState(user.orgId, opening.id), activeCompetencyOptions(user.orgId)]);
  const content = state.content;
  if (!content) notFound();
  // Active competencies to pick from, plus archived ones still linked here (shown, never offered).
  const archived = [...state.facts.values()].filter((f) => f.archived);
  const competencies = [
    ...options.map((o) => ({ id: o.id, name: pickText(o.name, locale), archived: false })),
    ...archived.map((f) => ({ id: f.id, name: pickText(f.name, locale), archived: true })),
  ];
  const problems = state.problems.map((p) => describeProblem(p, { content, facts: state.facts, locale, openingId: opening.id }, t));
  const published = /^\d{1,6}$/.test(one(sp.published) ?? "") ? one(sp.published)! : null;
  const publishNotice = one(sp.publish);
  const draftNotice = one(sp.draft);
  const notice =
    publishNotice && Object.hasOwn(PUBLISH_NOTICES, publishNotice)
      ? t(PUBLISH_NOTICES[publishNotice as PublishNotice])
      : draftNotice && Object.hasOwn(DRAFT_NOTICES, draftNotice)
        ? t(DRAFT_NOTICES[draftNotice as keyof typeof DRAFT_NOTICES])
        : null;
  const stageParam = one(sp.stage);
  const activityParam = one(sp.activity);

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8 pb-40">
      <OpeningHeader opening={opening} active="assessment" locale={locale} t={t} />
      <div className="mt-4">
        <AssessmentTabs openingId={opening.id} active="edit" t={t} />
      </div>
      {published ? (
        <p role="status" className="mt-6 text-[14px] text-ink">
          <StatusDot tone="active">
            <span className="tnum text-[14px] text-ink">{t("hiringBuilder.published", { number: published })}</span>
          </StatusDot>
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-6 text-[14px] font-medium text-ink">
          {notice}
        </p>
      ) : null}
      <Builder
        openingId={opening.id}
        mode={state.draft ? "draft" : "live"}
        versionNumber={content.number}
        liveNumber={state.live?.number ?? null}
        stages={content.stages}
        competencies={competencies}
        problems={problems}
        initial={{
          stageId: stageParam && isUuid(stageParam) ? stageParam : null,
          activityId: activityParam && isUuid(activityParam) ? activityParam : null,
        }}
        locale={locale}
        canEdit={access.edit}
        closed={opening.status === "CLOSED"}
      />
    </main>
  );
}
