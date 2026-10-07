import { notFound, redirect } from "next/navigation";
import { AiDraft } from "@/components/hiring/ai/ai-draft";
import { UrlNotice } from "@/components/ui/url-notice";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { pickText } from "@/lib/i18n-text";
import { noticeOf } from "@/lib/url-notice";
import { activeCompetencyOptions, loadPosition } from "@/server/library";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "../../access";
import { AssessmentTabs, OpeningHeader } from "../../opening-header";
import { setupStrip } from "../../setup-strip";

export const dynamic = "force-dynamic";

/** What "Düzenlemeye başla" (?draft=) answered when it was started here. */
const DRAFT_NOTICES = { closed: "hiringBuilder.draftClosed", failed: "hiringBuilder.draftFailed" } as const;

/**
 * HIRING-UX 5.6: the AI draft. The job ad comes from the position; proposals
 * live in the browser only and are written one accepted card at a time. With
 * only a published version, the screen offers "Düzenlemeye başla" first
 * (ruling C5); a closed opening or a viewer who may not edit sees it read-only.
 */
export default async function AiDraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  // HIRING-UX 5.20: a draft opening is set up in the wizard.
  if (opening.status === "DRAFT" && access.edit) redirect(`/hiring/openings/${opening.id}/setup#questions`);
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const [state, position, options] = await Promise.all([
    workingState(user.orgId, opening.id),
    loadPosition(user.orgId, opening.positionId),
    activeCompetencyOptions(user.orgId),
  ]);
  const content = state.content;
  if (!content) notFound();
  // 4.5: where a draft's setup path stands, for someone who may edit it (only the people are read; null otherwise).
  const setup = await setupStrip({ orgId: user.orgId, opening, access, t, locale, state });
  const draftKey = noticeOf(sp, "draft", DRAFT_NOTICES);
  const draftNotice = draftKey ? t(draftKey) : null;

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <OpeningHeader opening={opening} active="assessment" locale={locale} t={t} setup={setup} />
      <div className="mt-4">
        <AssessmentTabs openingId={opening.id} active="ai" t={t} />
      </div>
      {draftNotice ? (
        <UrlNotice params={["draft"]}>
          <p role="status" className="mt-6 text-[14px] font-medium text-ink">
            {draftNotice}
          </p>
        </UrlNotice>
      ) : null}
      <AiDraft
        openingId={opening.id}
        initialJobAd={position?.jobDescription ?? ""}
        library={options.map((o) => ({ id: o.id, name: pickText(o.name, locale) }))}
        locales={content.localeSet}
        mode={opening.status === "CLOSED" ? "closed" : state.draft ? "draft" : "live"}
        canEdit={access.edit}
        liveNumber={state.live?.number ?? null}
        versionNumber={content.number}
      />
    </main>
  );
}
