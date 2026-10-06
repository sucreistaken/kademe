import { notFound } from "next/navigation";
import { Preview } from "@/components/hiring/preview/preview";
import { LOCALES } from "@/i18n/locale";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { candidateSafe } from "@/lib/candidate-safe";
import { loadOrg } from "@/server/settings";
import { toCandidateVersion } from "@/solutions/hiring/rules/candidate-view";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "../../access";
import { AssessmentTabs, OpeningHeader } from "../../opening-header";
import { setupStrip } from "../../setup-strip";

export const dynamic = "force-dynamic";

/**
 * HIRING-UX 5.8: what a candidate will see, shown rather than claimed. The
 * draft when there is one, otherwise the live version. Only the candidate
 * view reaches the client component: toCandidateVersion (a whitelist, the same
 * one plan 2's candidate API uses), then candidateSafe as the generic last
 * line of defence. The version's team-only fields, competencies, anchors,
 * weights and right answers never enter the props (page.test.ts).
 */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const [state, org] = await Promise.all([workingState(user.orgId, opening.id), loadOrg(user.orgId)]);
  const content = state.content;
  if (!content) notFound();
  // 4.5: where a draft's setup path stands, for someone who may edit it (only the people are read; null otherwise).
  const setup = await setupStrip({ orgId: user.orgId, opening, access, t, locale, state });
  const version = candidateSafe(toCandidateVersion(content));
  const locales = LOCALES.filter((l) => content.localeSet.includes(l));
  // Only an editor's visit to a draft with something in it counts as "previewed".
  const stampVersionId = state.draft && access.edit && version.stages.length > 0 ? content.id : null;
  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <OpeningHeader opening={opening} active="assessment" locale={locale} t={t} setup={setup} />
      <div className="mt-4">
        <AssessmentTabs openingId={opening.id} active="preview" t={t} />
      </div>
      <Preview
        openingId={opening.id}
        stampVersionId={stampVersionId}
        mode={state.draft ? "draft" : "live"}
        number={content.number}
        companyName={org?.name ?? ""}
        positionName={opening.positionName}
        version={version}
        locales={locales.length ? locales : [content.defaultLocale]}
        defaultLocale={content.defaultLocale}
      />
    </main>
  );
}
