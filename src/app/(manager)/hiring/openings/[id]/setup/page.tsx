import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/hiring/wizard/setup-wizard";
import { candidatePreview, scorecardLine } from "@/components/hiring/wizard/setup-model";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { pickText } from "@/lib/i18n-text";
import { orgDay, zoneLabel } from "@/lib/org-timezone";
import { noticeOf, one } from "@/lib/url-notice";
import { activeCompetencyOptions, loadPosition } from "@/server/library";
import { isUuid, loadPanelUsers } from "@/server/settings";
import { usedCompetencyIds } from "@/solutions/hiring/rules/content";
import { ANCHOR_PROBLEMS, WEIGHT_PROBLEMS } from "@/solutions/hiring/rules/gate";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "../access";
import type { PublishNotice } from "../actions";
import { describeProblem } from "../problems";

export const dynamic = "force-dynamic";

/** What "Yayınla" answered when it was refused here (?publish=), each in its overview sentence. */
const PUBLISH_NOTICES: Record<PublishNotice, "publishRefused" | "publishNoDraft" | "publishClosed" | "publishInvalid" | "publishFailed"> = {
  refused: "publishRefused",
  nodraft: "publishNoDraft",
  closed: "publishClosed",
  invalid: "publishInvalid",
  failed: "publishFailed",
};

/**
 * HIRING-UX 5.20 steps 2 and 3 of "Alım aç": the questions (#questions) and
 * the preview with publishing (#publish), for someone who may edit an
 * opening's draft. No draft (a live opening nobody is editing, a closed one)
 * or no right to edit: the opening's overview, where "Soruları düzenle"
 * starts a new version.
 */
export default async function OpeningSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const base = `/hiring/openings/${opening.id}`;
  if (!access.edit || opening.status === "CLOSED") redirect(base);
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  // One read after another, never side by side (ruling C21).
  const state = await workingState(user.orgId, opening.id);
  if (!state.draft || !state.content) redirect(base);
  const content = state.content;
  const position = await loadPosition(user.orgId, opening.positionId);
  const options = await activeCompetencyOptions(user.orgId);
  const people = await loadPanelUsers(user.orgId);

  const archived = [...state.facts.values()].filter((f) => f.archived);
  const competencies = [
    ...options.map((o) => ({ id: o.id, name: pickText(o.name, locale), archived: false })),
    ...archived.map((f) => ({ id: f.id, name: pickText(f.name, locale), archived: true })),
  ];
  const first = state.problems[0] ?? null;
  const blocking = first
    ? {
        text: describeProblem(first, { content, facts: state.facts, locale, openingId: opening.id }, t).text,
        // An anchor or a weight is fixed on the scorecard: the footer offers that way there.
        scorecard: (ANCHOR_PROBLEMS as readonly string[]).includes(first.code) || (WEIGHT_PROBLEMS as readonly string[]).includes(first.code),
      }
    : null;
  const line = scorecardLine({ measured: usedCompetencyIds(content).length, weightsEnabled: content.weightsEnabled, weights: content.draftWeights });
  const hasStages = content.stages.length > 0;
  const activity = one(sp.activity);
  const notice = noticeOf(sp, "publish", PUBLISH_NOTICES);

  return (
    <main className="mx-auto max-w-[1080px] px-page pt-6">
      <SetupWizard
        // A new version (a publish, a new draft) is a new wizard: nothing typed for the old one carries over.
        key={content.id}
        openingId={opening.id}
        kicker={state.live ? t("hiringWizard.kickerEdit", { name: opening.name, number: content.number }) : t("hiringWizard.kicker", { name: opening.name })}
        locale={locale}
        contentLocale={content.defaultLocale}
        stages={content.stages}
        competencies={competencies}
        autoDraft={one(sp.draft) === "ai" && !hasStages}
        canDraft={Boolean(position?.jobDescription?.trim())}
        blocking={blocking}
        scorecard={{ ...line, href: `${base}/assessment/scorecard` }}
        preview={{ ...candidatePreview(content, locale), href: `${base}/assessment/preview` }}
        me={user.id}
        users={people.map((u) => ({ id: u.id, name: u.name, role: u.role, disabled: u.disabledAt !== null }))}
        saved={{
          name: opening.name,
          memberIds: opening.memberIds,
          decisionMakerId: opening.decisionMakerId,
          backupDecisionMakerId: opening.backupDecisionMakerId,
          blindMode: opening.blindMode,
          deadline: opening.deadlineAt ? orgDay(opening.deadlineAt) : null,
          feedbackDays: opening.feedbackDays,
          candidateContactEmail: opening.candidateContactEmail ?? "",
          finishSurveyEnabled: opening.finishSurveyEnabled,
        }}
        today={orgDay()}
        zone={zoneLabel(locale)}
        notice={notice ? t(`hiringOverview.${notice}`) : null}
        initialActivity={activity && isUuid(activity) ? activity : null}
      />
    </main>
  );
}
