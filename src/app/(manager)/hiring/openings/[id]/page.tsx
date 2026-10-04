import Link from "next/link";
import { Check, Circle, CircleDashed } from "lucide-react";
import { PublishButton } from "@/components/hiring/publish-button";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/format";
import type { PublishProblem } from "@/solutions/hiring/rules/gate";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "./access";
import { publishOpeningAction, type PublishNotice } from "./actions";
import { OpeningHeader } from "./opening-header";
import { describeProblem } from "./problems";
import { readinessRows, rowAction, rowHref, type ReadinessKey, type ReadinessState } from "./readiness";

export const dynamic = "force-dynamic";

const NOTICES: Record<PublishNotice, "publishRefused" | "publishNoDraft" | "publishClosed" | "publishInvalid" | "publishFailed"> = {
  refused: "publishRefused",
  nodraft: "publishNoDraft",
  closed: "publishClosed",
  invalid: "publishInvalid",
  failed: "publishFailed",
};

const LABELS: Record<ReadinessKey, "rowAssessment" | "rowAnchors" | "rowWeights" | "rowTeam" | "rowPreview"> = {
  assessment: "rowAssessment",
  anchors: "rowAnchors",
  weights: "rowWeights",
  team: "rowTeam",
  preview: "rowPreview",
};
const STATE_WORD = { done: "stateDone", missing: "stateMissing", advisory: "stateAdvisory" } as const;
const STATE_SR = { done: "srDone", missing: "srMissing", advisory: "srAdvisory" } as const;
const ICON = { done: Check, missing: Circle, advisory: CircleDashed } as const;

/**
 * One readiness row (HIRING-UX 5.4). The label is the goal; the state is an
 * icon plus a word, never colour alone, and a screen reader hears the state
 * before the label. Tones follow 8.2: done is muted grey, missing is ink and
 * bold. A finished row is one line. The link appears only while the page that
 * fixes it exists (ruling C7).
 */
function Row({
  state,
  label,
  stateWord,
  stateSr,
  detail,
  href,
  action,
}: {
  state: ReadinessState;
  label: string;
  stateWord: string;
  stateSr: string;
  detail?: string;
  href?: string | null;
  action?: string;
}) {
  const Icon = ICON[state];
  return (
    <li className="flex items-start gap-3 py-4 first:pt-3 last:pb-1">
      <Icon
        className={cn("mt-[3px] size-4 shrink-0", state === "missing" ? "text-ink" : "text-muted")}
        strokeWidth={state === "done" ? 2 : 1.5}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[14px] leading-[22px]", state === "done" ? "text-muted" : state === "missing" ? "font-semibold text-ink" : "text-ink")}>
          <span className="sr-only">{stateSr} </span>
          {label}
        </p>
        {state !== "done" && detail ? (
          // An advisory row's detail repeats what the screen reader already heard first.
          <p aria-hidden={state === "advisory" || undefined} className={cn("mt-0.5 text-[13px] leading-5", state === "missing" ? "text-ink" : "text-muted")}>
            {detail}
          </p>
        ) : null}
        {state !== "done" && href && action ? (
          <Link
            href={href}
            className="mt-1 inline-block text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink"
          >
            {action}
          </Link>
        ) : null}
      </div>
      <span aria-hidden className={cn("shrink-0 pt-px text-[12px] leading-5", state === "missing" ? "font-medium text-ink" : "text-muted")}>
        {stateWord}
      </span>
    </li>
  );
}

/** HIRING-UX 5.4: "Bu alım nerede, sıradaki adımım ne?" */
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
  const state = await workingState(user.orgId, opening.id);
  const content = state.content;
  const describe = (p: PublishProblem) => (content ? describeProblem(p, { content, facts: state.facts, locale, openingId: opening.id }, t) : null);
  const closed = opening.status === "CLOSED";
  const reason = closed
    ? t("hiringOverview.closedBody")
    : !access.edit
      ? t("hiringCommon.noPermission")
      : state.problems.length
        ? (describe(state.problems[0])?.text ?? null)
        : null;
  const published = typeof sp.published === "string" && /^\d{1,6}$/.test(sp.published) ? sp.published : null;
  const notice = typeof sp.publish === "string" && Object.hasOwn(NOTICES, sp.publish) ? NOTICES[sp.publish as PublishNotice] : null;

  const action = state.draft ? (
    <form action={publishOpeningAction} className="flex w-full flex-col items-start gap-1 sm:w-auto sm:max-w-[360px] sm:items-end sm:text-right">
      <input type="hidden" name="openingId" value={opening.id} />
      <input type="hidden" name="back" value="overview" />
      <PublishButton
        id="publish-opening"
        label={t("hiringOverview.publish")}
        pendingLabel={t("hiringOverview.publishing")}
        reason={reason}
        note={t("hiringOverview.publishNote")}
      />
    </form>
  ) : (
    <div className="flex w-full flex-col items-start gap-1 sm:w-auto sm:max-w-[360px] sm:items-end sm:text-right">
      <Button id="invite-candidate" variant="primary" disabled disabledReason={closed ? t("hiringOverview.closedBody") : t("hiringOverview.inviteLater")}>
        {t("hiringOverview.invite")}
      </Button>
      <DisabledReason id="invite-candidate-why">{closed ? t("hiringOverview.closedBody") : t("hiringOverview.inviteLater")}</DisabledReason>
    </div>
  );

  const rows =
    state.draft && content
      ? readinessRows({ problems: state.problems, content, memberCount: opening.memberIds.length, previewed: state.draft.previewedAt !== null })
      : [];

  return (
    // Header and body share one width, so "Yayınla" stays next to the list it depends on.
    <main className="mx-auto max-w-[960px] px-page py-8">
      <OpeningHeader opening={opening} active="overview" locale={locale} t={t} action={action} />
      {published ? (
        <p role="status" className="mt-6 flex items-center gap-2 text-[14px] text-ink">
          <StatusDot tone="active">
            <span className="tnum text-[14px] text-ink">{t("hiringOverview.published", { number: published })}</span>
          </StatusDot>
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-6 text-[14px] font-medium text-ink">
          {t(`hiringOverview.${notice}`)}
        </p>
      ) : null}

      <div className="mt-section space-y-section">
        {state.draft ? (
          <Card className="p-card">
            <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.readinessTitle")}</h2>
            <p className="tnum mt-0.5 text-[13px] text-muted">{t("hiringOverview.draftPending", { number: state.draft.number })}</p>
            <ul className="mt-3 divide-y divide-line">
              {rows.map((row) => {
                const fix = row.problem ? describe(row.problem) : null;
                const detail =
                  row.reason === "NO_COMPETENCIES"
                    ? t("hiringOverview.anchorsNoCompetency")
                    : row.state === "advisory"
                      ? t("hiringOverview.advisory")
                      : fix?.text;
                const href = rowHref(row, fix?.href, opening.id);
                return (
                  <Row
                    key={row.key}
                    state={row.state}
                    label={t(`hiringOverview.${LABELS[row.key]}`)}
                    stateWord={t(`hiringOverview.${STATE_WORD[row.state]}`)}
                    stateSr={t(`hiringOverview.${STATE_SR[row.state]}`)}
                    detail={detail}
                    href={href}
                    action={href ? t(`hiringOverview.${rowAction(href)}`) : undefined}
                  />
                );
              })}
            </ul>
          </Card>
        ) : (
          <Card className="p-card">
            <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.funnelTitle")}</h2>
            <p className="mt-2 text-[13px] text-muted">{closed ? t("hiringOverview.closedBody") : t("hiringOverview.funnelEmpty")}</p>
          </Card>
        )}
        {state.live ? (
          <Card className="p-card">
            <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.liveTitle")}</h2>
            <p className="tnum mt-2 text-[13px] text-muted">
              {t("hiringOverview.liveBody", { number: state.live.number, date: state.live.publishedAt ? shortDate(state.live.publishedAt, locale) : "-" })}
            </p>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
