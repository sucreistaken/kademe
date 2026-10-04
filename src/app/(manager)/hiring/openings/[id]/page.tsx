import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { shortDate } from "@/lib/format";
import { ANCHOR_PROBLEMS, STRUCTURE_PROBLEMS, WEIGHT_PROBLEMS, type PublishProblem } from "@/solutions/hiring/rules/gate";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "./access";
import { publishOpeningAction, type PublishNotice } from "./actions";
import { OpeningHeader } from "./opening-header";
import { describeProblem } from "./problems";

export const dynamic = "force-dynamic";

const NOTICES: Record<PublishNotice, "publishRefused" | "publishNoDraft" | "publishClosed" | "publishInvalid" | "publishFailed"> = {
  refused: "publishRefused",
  nodraft: "publishNoDraft",
  closed: "publishClosed",
  invalid: "publishInvalid",
  failed: "publishFailed",
};

/**
 * One readiness row (HIRING-UX 5.4): dot + text, and while it is open the first
 * thing to fix and a link to where it is fixed. A finished row is one line. The
 * link is left out while that page does not exist yet (ruling C7).
 */
function Row({
  done,
  label,
  detail,
  href,
  action,
  advisory,
}: {
  done: boolean;
  label: string;
  detail?: string;
  href?: string | null;
  action?: string;
  advisory?: string;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-4 first:pt-3 last:pb-1">
      <div className="min-w-0">
        <StatusDot tone={done ? "done" : "warn"} className={done ? "text-[14px] text-muted" : "text-[14px] font-semibold text-ink"}>
          {label}
        </StatusDot>
        {!done && detail ? <p className="mt-1 pl-3.5 text-[13px] leading-5 text-ink">{detail}</p> : null}
        {!done && advisory ? <p className="mt-1 pl-3.5 text-[12px] leading-4 text-muted">{advisory}</p> : null}
      </div>
      {!done && href && action ? (
        <Link href={href} className="shrink-0 pl-3.5 text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink sm:pl-0">
          {action}
        </Link>
      ) : null}
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
  const structure = state.problems.filter((p) => STRUCTURE_PROBLEMS.includes(p.code));
  const anchors = state.problems.filter((p) => ANCHOR_PROBLEMS.includes(p.code));
  const weights = state.problems.filter((p) => WEIGHT_PROBLEMS.includes(p.code));
  const closed = opening.status === "CLOSED";
  const reason = closed
    ? t("hiringOverview.closedBody")
    : !access.edit
      ? t("hiringCommon.noPermission")
      : state.problems.length
        ? (describe(state.problems[0])?.text ?? null)
        : null;
  const published = typeof sp.published === "string" && /^\d{1,6}$/.test(sp.published) ? sp.published : null;
  const notice = typeof sp.publish === "string" && sp.publish in NOTICES ? NOTICES[sp.publish as PublishNotice] : null;

  const action = state.draft ? (
    <form action={publishOpeningAction} className="flex w-full flex-col items-start gap-1 sm:w-auto sm:max-w-[360px] sm:items-end sm:text-right">
      <input type="hidden" name="openingId" value={opening.id} />
      <input type="hidden" name="back" value="overview" />
      <Button id="publish-opening" type="submit" variant="primary" disabled={reason !== null} disabledReason={reason ?? undefined}>
        {t("hiringOverview.publish")}
      </Button>
      {reason ? (
        <DisabledReason id="publish-opening-why">{reason}</DisabledReason>
      ) : (
        <p className="text-[12px] leading-4 text-muted">{t("hiringOverview.publishNote")}</p>
      )}
    </form>
  ) : (
    <div className="flex w-full flex-col items-start gap-1 sm:w-auto sm:max-w-[360px] sm:items-end sm:text-right">
      <Button id="invite-candidate" variant="primary" disabled disabledReason={closed ? t("hiringOverview.closedBody") : t("hiringOverview.inviteLater")}>
        {t("hiringOverview.invite")}
      </Button>
      <DisabledReason id="invite-candidate-why">{closed ? t("hiringOverview.closedBody") : t("hiringOverview.inviteLater")}</DisabledReason>
    </div>
  );

  const first = (list: PublishProblem[]) => (list[0] ? describe(list[0]) : null);
  const structureFirst = first(structure);
  const anchorFirst = first(anchors);
  const weightFirst = first(weights);

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
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

      <div className={state.draft && state.live ? "mt-section grid items-start gap-section lg:grid-cols-[minmax(0,1fr)_360px]" : "mt-section max-w-[760px]"}>
        {state.draft ? (
          <Card className="p-card">
            <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.readinessTitle")}</h2>
            <p className="tnum mt-0.5 text-[13px] text-muted">{t("hiringOverview.draftPending", { number: state.draft.number })}</p>
            <ul className="mt-3 divide-y divide-line">
              <Row done={structure.length === 0} label={t("hiringOverview.rowAssessment")} detail={structureFirst?.text} href={structureFirst?.href} action={t("hiringOverview.goBuilder")} />
              <Row done={anchors.length === 0} label={t("hiringOverview.rowAnchors")} detail={anchorFirst?.text} href={anchorFirst?.href} action={t("hiringOverview.goLibrary")} />
              {/* Weights matter only with weighting on (or when the gate names them). */}
              {content?.weightsEnabled || weights.length ? (
                <Row done={weights.length === 0} label={t("hiringOverview.rowWeights")} detail={weightFirst?.text} href={weightFirst?.href} action={t("hiringOverview.goScorecard")} />
              ) : null}
              <Row done={opening.memberIds.length > 0} label={t("hiringOverview.rowTeam")} advisory={t("hiringOverview.advisory")} />
              <Row done={state.draft.previewedAt !== null} label={t("hiringOverview.rowPreview")} advisory={t("hiringOverview.advisory")} />
            </ul>
          </Card>
        ) : (
          <Card className="p-card">
            <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringOverview.funnelTitle")}</h2>
            <p className="mt-2 text-[13px] text-muted">{closed ? t("hiringOverview.closedBody") : t("hiringOverview.funnelEmpty")}</p>
          </Card>
        )}
        {state.live ? (
          <Card className={state.draft ? "p-card" : "mt-section p-card"}>
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
