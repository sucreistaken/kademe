import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, EyeOff, Inbox, Users } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InviteSheet } from "@/components/hiring/invite/invite-sheet";
import { SummaryRows, type SummaryRow } from "@/components/manager/summary-rows";
import type { RowMenuItem } from "@/components/manager/row-menu";
import { UrlNotice } from "@/components/ui/url-notice";
import { StatusDot } from "@/components/ui/status-dot";
import { PathSteps } from "@/components/visual/path-steps";
import { StepScreen } from "@/components/visual/step-screen";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { noticeOf, one } from "@/lib/url-notice";
import { shortDate } from "@/lib/format";
import { orgDay, zoneLabel } from "@/lib/org-timezone";
import { loadPanelUsers } from "@/server/settings";
import { canDecide } from "@/solutions/hiring/rules/access";
import { orderedStages, totalSeconds } from "@/solutions/hiring/rules/content";
import type { PublishProblem } from "@/solutions/hiring/rules/gate";
import { previewIsCurrent } from "@/solutions/hiring/rules/versions";
import { SURVEY_BATCH } from "@/solutions/hiring/rules/invitation";
import { invitableOpenings, openingCardFacts, openingFunnel } from "@/solutions/hiring/server/invitations";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "./access";
import { publishOpeningAction, type PublishNotice } from "./actions";
import { funnelView } from "./funnel";
import { inviteBlock, inviteWaitReason } from "./invite-wait";
import { OpeningHeader } from "./opening-header";
import { describeProblem } from "./problems";
import { OverviewOnly, PUBLISHED_NOTICE_ID, PublishFooter, PublishLink, PublishSwitch, SETUP_HEADING_ID, SetupFocusArea } from "./publish-view";
import { rowAction } from "./readiness";
import { SETUP_LABEL, setupNext, setupProgress, setupRowsOf, setupSkips } from "./setup-steps";

export const dynamic = "force-dynamic";

const NOTICES: Record<PublishNotice, "publishRefused" | "publishNoDraft" | "publishClosed" | "publishInvalid" | "publishFailed"> = {
  refused: "publishRefused",
  nodraft: "publishNoDraft",
  closed: "publishClosed",
  invalid: "publishInvalid",
  failed: "publishFailed",
};

/** The redirect after "Yayınla" brings one of these; shown once, then taken out of the address. */
const NOTICE_PARAMS = ["publish", "published"] as const;

const LINK = "font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink";
const TEXT_ACTION = "inline-flex min-h-11 items-center gap-0.5 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";
const ATTENTION_ROW = "flex min-h-11 items-center gap-3 py-3 text-[14px] text-ink transition-colors duration-[120ms] ease-out hover:bg-canvas";

/** A link inside the opening: with a hash (the publish summary, team and rules' flow) a plain anchor, so the page hears the hash (W3). */
function To({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return href.includes("#") ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/**
 * HIRING-VISUAL-FLOW 4.5 (K12): one opening's control view. A draft: its
 * setup path as one list ("Kurulum n / N · k adım kaldı"), the one filled
 * "Kuruluma devam et" opening the next step (H7), and the publish summary at
 * `#publish` with the filled "Yayınla". Live: the funnel as tiles, what needs
 * attention, and the opening's rules in one card. The "⋯" menu holds links
 * only (plan decision 14). The publish gate, its reasons and notices are the
 * existing ones; publishOpeningAction is unchanged.
 */
export default async function OpeningOverviewPage({
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
  const [state, people, funnel, invitable] = await Promise.all([
    workingState(user.orgId, opening.id),
    loadPanelUsers(user.orgId),
    openingFunnel(user.orgId, opening.id),
    access.edit ? invitableOpenings(user.orgId) : Promise.resolve([]),
  ]);
  const closed = opening.status === "CLOSED";
  const live = opening.status === "OPEN";
  // Counts only for a live opening (a closed one draws none), after the reads above, never beside them (ruling C21).
  // Requests are read only for someone who runs openings (H9); a reviewer's facts carry the expiring count alone.
  const facts = live ? ((await openingCardFacts(user.orgId, [opening.id], { runs: can(user, "opening:write") }))[opening.id] ?? null) : null;
  // The opening as the invite form needs it: OPEN, of this organisation (invitableOpenings).
  const target = invitable.find((o) => o.id === opening.id) ?? null;
  const today = orgDay();
  // B-M3: what the invite form would refuse on this opening anyway, and a team short of the rule (only read for an editor of a live opening).
  const block = inviteBlock(target, today);
  const shortfall = target && target.evaluators < target.minEvaluations ? { evaluators: target.evaluators, min: target.minEvaluations } : null;
  const deadlinePassed = target?.deadlineDay != null && target.deadlineDay < today;
  const view = funnelView(funnel, opening.finishSurveyEnabled);
  const number = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { maximumFractionDigits: 1 });
  const content = state.content;
  const describe = (p: PublishProblem) => (content ? describeProblem(p, { content, facts: state.facts, locale, openingId: opening.id }, t) : null);
  const base = `/hiring/openings/${opening.id}`;
  const reason = closed
    ? t("hiringOverview.closedBody")
    : !access.edit
      ? t("hiringCommon.noPermission")
      : state.problems.length
        ? (describe(state.problems[0])?.text ?? null)
        : null;
  const published = /^\d{1,6}$/.test(one(sp.published) ?? "") ? one(sp.published)! : null;
  const notice = noticeOf(sp, "publish", NOTICES);
  const waitReason = block ? t(`hiringInvite.reason${block}`) : inviteWaitReason(closed, access.edit, t);

  // The setup path (4.5): the readiness rows, the advice steps passed with "Atla" (?skip=), then "Yayınla".
  const setupRows = setupRowsOf({ state, opening, people, t, locale });
  const skipped = setupSkips(sp.skip);
  const progress = setupProgress(setupRows, skipped);
  const next = setupNext(setupRows, opening.id, skipped);
  const lang = one(sp.lang);
  const skipHref = (keys: readonly string[]) => `${base}?skip=${keys.join(",")}${lang ? `&lang=${encodeURIComponent(lang)}` : ""}`;

  // The publish summary (#publish, the path's last step): what goes live, each row with "Değiştir ›".
  // The team in one line (the publish summary and the rules card): the active members, the people the
  // team rule and the control view count (Task 18), and the decider named only while active and able to
  // decide (the same rule as the setup path's team step, setupRowsOf); otherwise "kimse seçilmedi".
  const active = new Set(people.filter((u) => u.disabledAt === null).map((u) => u.id));
  const decider = people.find((u) => u.id === opening.decisionMakerId && u.disabledAt === null && canDecide(u.role)) ?? null;
  const first = state.problems[0] ? describe(state.problems[0]) : null;
  const stages = content ? orderedStages(content) : [];
  const teamValue = t("hiringCommon.rulesTeam", { count: opening.memberIds.filter((m) => active.has(m)).length, decider: decider?.name ?? t("hiringCommon.rulesNoDecider") });
  const deadlineValue = opening.deadlineAt ? t("hiringCommon.deadline", { date: shortDate(opening.deadlineAt, locale) }) : t("hiringCommon.noDeadline");
  const publishRows: SummaryRow[] =
    state.draft && content
      ? [
          {
            id: "version",
            label: t("hiringOverview.publishVersion"),
            value: t("hiringOverview.publishVersionValue", {
              number: state.draft.number,
              stages: stages.length,
              questions: stages.reduce((sum, s) => sum + s.activities.length, 0),
              minutes: Math.round(totalSeconds(content) / 60),
            }),
            problem: first?.text,
            edit: { href: `${base}/assessment/edit` },
          },
          // Task 19 carry: these hashes are steps of team and rules' flows (Task 21), never cleared there.
          { id: "team", icon: Users, label: t("hiringSettings.teamTitle"), value: teamValue, edit: { href: `${base}/settings#team-members` } },
          { id: "deadline", icon: CalendarDays, label: t("hiringOverview.publishDeadline"), value: deadlineValue, edit: { href: `${base}/settings#contact-deadline` } },
          {
            id: "preview",
            label: t("hiringOverview.publishPreview"),
            value: previewIsCurrent(state.draft) ? t("hiringOverview.publishPreviewDone") : t("hiringOverview.publishPreviewNot"),
            edit: { href: `${base}/assessment/preview` },
          },
        ]
      : [];
  const publishSummary =
    state.draft && content && access.edit && !closed ? (
      <div id="publish-summary">
        <form id="publish-form" action={publishOpeningAction}>
          <input type="hidden" name="openingId" value={opening.id} />
          <input type="hidden" name="back" value="overview" />
          <StepScreen layout="split" width={1000} title={t("hiringOverview.publishSummaryTitle")} lead={<p>{t("hiringOverview.publishNote")}</p>}>
            <SummaryRows rows={publishRows} changeLabel={t("flow.change")} changedLabel={t("flow.changed")} />
          </StepScreen>
          <PublishFooter
            formId="publish-form"
            reason={reason}
            fix={first?.href ? { label: t("hiringOverview.fixProblem"), href: first.href } : null}
            labels={{ publish: t("hiringOverview.publish"), publishing: t("hiringOverview.publishing"), back: t("hiringOverview.backToOverview") }}
          />
        </form>
      </div>
    ) : null;

  // H7: a draft's one filled button continues the setup; "Yayınla" is filled only on the publish summary.
  // 4.5 (B-M9): a closed opening has no filled button; the "Kapalı" note below points an owner or manager to "Yeniden aç".
  const pageAction =
    opening.status === "DRAFT" ? (
      access.edit ? (
        <Button asChild variant="primary">
          {next.key === "publish" ? (
            // The summary on this page: opened as a marked history entry, so "‹ Genel bakış" goes back (M3).
            <PublishLink href={next.href}>{t("hiringCommon.continueSetup")}</PublishLink>
          ) : next.href.includes("#") ? (
            <a href={next.href}>{t("hiringCommon.continueSetup")}</a>
          ) : (
            <Link href={next.href}>{t("hiringCommon.continueSetup")}</Link>
          )}
        </Button>
      ) : null
    ) : closed ? null : target && !block ? (
      <InviteSheet opening={target} today={today} zone={zoneLabel(locale)} />
    ) : (
      // The same button waiting with the Candidates tab's reason, or the invite form's own (no evaluator, last day passed; B-M3, RULES 5).
      <div className="flex w-full flex-col items-start gap-1 sm:w-auto sm:max-w-[360px] sm:items-end sm:text-right">
        <Button id="invite-candidate" variant="primary" disabled disabledReason={waitReason}>
          {t("hiringOverview.invite")}
        </Button>
        <DisabledReason id="invite-candidate-why">{waitReason}</DisabledReason>
      </div>
    );
  // RULES 2: while the summary shows, its "Yayınla" is the screen's one filled button.
  const action = pageAction && publishSummary ? <OverviewOnly hasSummary>{pageAction}</OverviewOnly> : pageAction;

  // Plan decision 14 and ruling C9: links only; "Kopyala" only for someone who may open an opening (its page refuses anyone else).
  const menu: RowMenuItem[] = [
    { label: t("hiringOverview.menuPreview"), href: `${base}/assessment/preview` },
    { label: t("hiringOverview.menuSettings"), ...(access.edit ? { detail: t("hiringOverview.menuSettingsDetail") } : {}), href: `${base}/settings` },
    ...(can(user, "opening:write") ? [{ label: t("hiringCommon.copyOpening"), href: `/hiring/openings/new?copy=${opening.id}` }] : []),
  ];

  const pathSteps = [
    ...setupRows.map((row, i) => {
      const current = i === progress.current;
      const detail =
        row.state === "done"
          ? undefined
          : row.row.reason === "NO_COMPETENCIES"
            ? t("hiringOverview.anchorsNoCompetency")
            : row.row.reason === "NO_DECISION_MAKER"
              ? t("hiringOverview.teamNoDecisionMaker")
              : row.row.reason === "DISABLED_MEMBER"
                ? t("hiringOverview.teamDisabledMember")
                : row.state === "advisory"
                  ? t("hiringOverview.advisory")
                  : (row.fixText ?? undefined);
      // The team step opens team and rules' flow (a hash), so its words are named here, not read from the address.
      const words = row.key === "team" ? "goTeam" : row.href ? rowAction(row.href) : null;
      return {
        title: t(`hiringOverview.${SETUP_LABEL[row.key]}`),
        detail,
        state: row.state === "done" ? ("done" as const) : current ? ("current" as const) : ("todo" as const),
        action:
          current && access.edit && row.href && words ? (
            <span className="flex flex-wrap items-center gap-x-5">
              <To href={row.href} className={TEXT_ACTION}>
                {t(`hiringOverview.${words}`)}
                <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
              </To>
              {row.state === "advisory" ? (
                // STATUS decision 7: advice never blocks; "Atla" passes it for this visit (the address remembers, nothing is stored).
                // The page stays where it is (no scroll to the top) and keeps ?lang= when the address has one.
                <Link href={skipHref([...skipped, row.key])} scroll={false} className={TEXT_ACTION}>
                  {t("flow.skip")}
                  <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                </Link>
              ) : null}
            </span>
          ) : undefined,
      };
    }),
    {
      title: t("hiringOverview.rowPublish"),
      state: progress.current === setupRows.length ? ("current" as const) : ("todo" as const),
      action:
        progress.current === setupRows.length && publishSummary ? (
          <PublishLink href={`${base}#publish`} className={TEXT_ACTION}>
            {t("hiringOverview.goPublish")}
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          </PublishLink>
        ) : undefined,
    },
  ];

  const requests = facts?.requests ? facts.requests.open + facts.requests.rights : 0;
  const rulesRows: SummaryRow[] = [
    { id: "team", icon: Users, label: t("hiringSettings.teamTitle"), value: teamValue },
    { id: "contact", icon: CalendarDays, label: t("hiringSettings.candidateTitle"), value: t("hiringCommon.rulesContact", { deadline: deadlineValue, days: opening.feedbackDays }) },
    {
      id: "fair",
      icon: EyeOff,
      label: t("hiringSettings.fairTitle"),
      value: [opening.blindMode ? t("hiringCommon.rulesBlindOn") : t("hiringCommon.rulesBlindOff"), opening.finishSurveyEnabled ? t("hiringCommon.rulesSurveyOn") : t("hiringCommon.rulesSurveyOff")].join(" · "),
    },
  ];

  return (
    // Header and body share one width, so the filled button stays next to the list it depends on.
    <main className="mx-auto max-w-[960px] px-page py-8">
      <OpeningHeader opening={opening} active="overview" locale={locale} t={t} action={action} menu={menu} />
      {published ? (
        <UrlNotice params={NOTICE_PARAMS}>
          {/* B-M2: after "Yayınla" the summary and the setup card are gone; the focus lands here (PublishSwitch). */}
          <p id={PUBLISHED_NOTICE_ID} tabIndex={-1} role="status" className="mt-6 flex items-center gap-2 text-[14px] text-ink outline-none">
            <StatusDot tone="active">
              <span className="tnum text-[14px] text-ink">{t("hiringOverview.published", { number: published })}</span>
            </StatusDot>
          </p>
        </UrlNotice>
      ) : null}
      {closed ? (
        // "Yeniden aç" lives on team and rules; an owner or manager is pointed there.
        <p className="mt-6 text-[14px] text-ink">
          {t("hiringOverview.closedNotice")}{" "}
          {canDecide(user.role) ? (
            <Link href={`${base}/settings`} className={LINK}>
              {t("hiringOverview.goReopen")}
            </Link>
          ) : null}
        </p>
      ) : null}
      {notice ? (
        <UrlNotice params={NOTICE_PARAMS}>
          <p role="status" className="mt-6 text-[14px] font-medium text-ink">
            {t(`hiringOverview.${notice}`)}
          </p>
        </UrlNotice>
      ) : null}

      <PublishSwitch summary={publishSummary}>
        <div className="mt-section space-y-section">
          {state.draft ? (
            <Card className="p-card">
              <SetupFocusArea>
                {/* Where the focus lands back from the publish summary or after a path action goes away (W10). */}
                <h2 id={SETUP_HEADING_ID} tabIndex={-1} className="text-[16px] leading-6 font-semibold text-ink outline-none">
                  {t("hiringOverview.readinessTitle")}
                </h2>
                <p className="tnum mt-0.5 text-[13px] text-muted">
                  {t("hiringOverview.draftPending", { number: state.draft.number })}
                  {setupRows.length ? ` · ${t("hiringOverview.setupCount", { done: progress.done, total: progress.total })} · ${t("hiringOverview.setupLeft", { count: progress.left })}` : ""}
                </p>
                {setupRows.length ? (
                  <div className="mt-4">
                    <PathSteps steps={pathSteps} label={t("hiringOverview.readinessTitle")} locale={locale} />
                  </div>
                ) : null}
              </SetupFocusArea>
            </Card>
          ) : null}
          {/* HIRING-UX 5.4: the funnel while published, also under a new draft once candidates exist. */}
          {!state.draft || view ? (
            <Card className="p-card">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.funnelTitle")}</h2>
                {view ? (
                  <Link href={`${base}/candidates`} className={`text-[13px] ${LINK}`}>
                    {t("hiringOverview.funnelAll")}
                  </Link>
                ) : null}
              </div>
              {view ? (
                <>
                  {/* FunnelTiles (design 5): three boxes in order with a chevron between them; the bar shows the share of those invited who got this far. */}
                  <ol className="mt-3 flex items-stretch gap-2">
                    {view.steps.map((s, i) => (
                      <li key={s.key} className="flex min-w-0 flex-1 items-center gap-2">
                        {i > 0 ? <ChevronRight className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden /> : null}
                        <div className="min-w-0 flex-1 self-stretch rounded-xl border border-line bg-surface p-3">
                          <p className="text-[13px] text-muted">{t(`hiringOverview.funnel_${s.key}`)}</p>
                          <p className="tnum text-[24px] leading-8 font-semibold text-ink">{s.count}</p>
                          {i > 0 && view.steps[0].count > 0 ? (
                            <div className="mt-1 h-1 rounded-full bg-hairline" aria-hidden>
                              <div className="h-1 rounded-full bg-ink-3" style={{ width: `${Math.round(Math.min(1, s.count / view.steps[0].count) * 100)}%` }} />
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                  {view.time ? (
                    <p className="tnum mt-3 text-[13px] text-ink">
                      {t("hiringOverview.funnelMedian", { minutes: view.time.median })}
                      {view.time.estimate !== null ? ` · ${t("hiringOverview.funnelEstimate", { minutes: view.time.estimate })}` : ""}
                      {view.time.over ? <span className="mt-1 block text-muted">{t("hiringOverview.funnelOver")}</span> : null}
                    </p>
                  ) : null}
                  <div className="mt-4 border-t border-line pt-3">
                    <h3 className="text-[14px] font-semibold text-ink">{t("hiringOverview.experienceTitle")}</h3>
                    {view.experience.kind === "off" ? (
                      <p className="mt-1 text-[13px] text-muted">{t("hiringOverview.experienceOff")}</p>
                    ) : view.experience.kind === "waiting" ? (
                      <p className="tnum mt-1 text-[13px] text-muted">{t("hiringOverview.experienceWaiting", { needed: view.experience.needed })}</p>
                    ) : (
                      <>
                        <p className="tnum mt-1 text-[14px] text-ink">
                          {t("hiringOverview.experienceAverage", { average: number.format(view.experience.average), count: view.experience.count })}
                        </p>
                        <p className="tnum mt-0.5 text-[12px] text-muted">{t("hiringOverview.experienceBatch", { batch: SURVEY_BATCH })}</p>
                        {view.experience.comments.length ? (
                          // Task 19 ruling 1 and fix round 1: a few released comments in a fixed shuffled order, no rating or date.
                          <>
                            <p className="mt-2 text-[12px] text-muted">{t("hiringOverview.experienceComments")}</p>
                            <ul className="mt-1 space-y-1">
                              {view.experience.comments.map((comment, i) => (
                                <li key={i} className="text-[13px] break-words whitespace-pre-line text-ink-2">
                                  {comment}
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-[13px] text-muted">{closed ? t("hiringOverview.closedBody") : t("hiringOverview.funnelEmpty")}</p>
              )}
            </Card>
          ) : null}
          {/* H9 and ruling C18's open point: requests only for someone who runs openings (their facts alone carry them); the expiring count, a number, for everyone on the opening. */}
          {(facts && (requests > 0 || facts.expiringSoon > 0)) || shortfall || deadlinePassed ? (
            // B-M3: the team below the rule and a passed last day only for an editor (target is read for them alone).
            <Card className="p-card">
              <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.attentionTitle")}</h2>
              <ul className="mt-2 divide-y divide-line">
                {facts && requests > 0 ? (
                  <li>
                    <Link href={`${base}/candidates`} className={ATTENTION_ROW}>
                      <Inbox className="size-[18px] shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
                      <span className="flex-1">
                        {t("hiringCommon.openRequests", { count: requests })}
                        {/* Ruling C6: counted, said plainly, handled with plan 3. */}
                        {facts.requests && facts.requests.rights > 0 ? <span className="block text-[13px] text-muted">{t("hiringCommon.rightsNote", { count: facts.requests.rights })}</span> : null}
                      </span>
                      <span className="inline-flex items-center text-[13px] font-medium">
                        {t("hiringOpenings.nextRequests")}
                        <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                      </span>
                    </Link>
                  </li>
                ) : null}
                {facts && facts.expiringSoon > 0 ? (
                  <li>
                    <Link href={`${base}/candidates`} className={ATTENTION_ROW}>
                      <Clock className="size-[18px] shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
                      <span className="flex-1">{t("hiringCommon.expiringLinks", { count: facts.expiringSoon })}</span>
                      <span className="inline-flex items-center text-[13px] font-medium">
                        {t("hiringOpenings.nextExpiring")}
                        <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                      </span>
                    </Link>
                  </li>
                ) : null}
                {shortfall ? (
                  <li>
                    {/* A step of team and rules' flow (a hash): a plain anchor, so that page hears it (W3). */}
                    <To href={`${base}/settings#team-members`} className={ATTENTION_ROW}>
                      <Users className="size-[18px] shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
                      <span className="flex-1">{t("hiringCommon.teamShort", { evaluators: shortfall.evaluators, min: shortfall.min })}</span>
                      <span className="inline-flex items-center text-[13px] font-medium">
                        {t("hiringOpenings.nextTeam")}
                        <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                      </span>
                    </To>
                  </li>
                ) : null}
                {deadlinePassed ? (
                  <li>
                    <To href={`${base}/settings#contact-deadline`} className={ATTENTION_ROW}>
                      <CalendarDays className="size-[18px] shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
                      <span className="flex-1">{t("hiringCommon.deadlinePassed")}</span>
                      <span className="inline-flex items-center text-[13px] font-medium">
                        {t("hiringOpenings.nextDeadline")}
                        <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                      </span>
                    </To>
                  </li>
                ) : null}
              </ul>
            </Card>
          ) : null}
          {live ? (
            // 4.5: the opening's rules at a glance; changing them is team and rules' work (4.10). A reviewer reads them.
            <Card className="p-card">
              <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.rulesTitle")}</h2>
              <SummaryRows rows={rulesRows} readOnly changeLabel={t("flow.change")} changedLabel={t("flow.changed")} />
              {access.edit ? (
                <div className="flex justify-end">
                  <Link href={`${base}/settings`} className={TEXT_ACTION}>
                    {t("hiringOverview.changeRules")}
                    <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                  </Link>
                </div>
              ) : null}
            </Card>
          ) : null}
          {state.live ? (
            <Card className="p-card">
              <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.liveTitle")}</h2>
              <p className="tnum mt-2 text-[13px] text-muted">
                {t("hiringOverview.liveBody", { number: state.live.number, date: state.live.publishedAt ? shortDate(state.live.publishedAt, locale) : "-" })}
              </p>
            </Card>
          ) : null}
        </div>
      </PublishSwitch>
    </main>
  );
}
