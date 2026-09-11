import Link from "next/link";
import { InlineLink } from "@/components/ui/inline-link";
import { Card } from "@/components/ui/card";
import { Button, DisabledReason } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { Avatar } from "@/components/ui/avatar";
import { UndoStrip } from "@/components/ui/undo-strip";
import { requireUser } from "@/server/session";
import { can } from "@/lib/authorize";
import {
  loadAssessmentRows,
  loadPositions,
  needsReview,
  pipelineState,
} from "@/lib/manager-data";
import { remaining, waiting } from "@/lib/format";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import { extendLink, undoExtendLink } from "../actions";

/** Rough planning number for the queue footer. Four stages, five minutes each. */
const MINUTES_PER_CANDIDATE = 8;
const EXPIRING_WINDOW_MS = 48 * 60 * 60 * 1000;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const params = await searchParams;
  const rows = await loadAssessmentRows(user.orgId);
  const positions = await loadPositions(user.orgId, rows);
  const now = new Date();
  // A reviewer scores and nothing else. The invite and extend controls land on
  // requireUser("candidate:invite"), so for them the controls say why they are
  // off instead of opening an error page.
  const mayInvite = can(user, "candidate:invite");

  // Oldest first: the queue is ordered by how long someone has been waiting,
  // not by when they were invited.
  const queue = rows
    .filter((row) => needsReview(pipelineState(row, now)))
    .sort(
      (a, b) => (a.lastActivityAt?.getTime() ?? 0) - (b.lastActivityAt?.getTime() ?? 0),
    );

  // Already lapsed links belong in this card too. Dropping them would hide the
  // one case where the manager has to act, and the candidate cannot.
  const expiring = rows
    .filter((row) => {
      const state = pipelineState(row, now);
      if ((state !== "NOT_STARTED" && state !== "EXPIRED") || !row.linkExpiresAt) return false;
      return row.linkExpiresAt.getTime() - now.getTime() < EXPIRING_WINDOW_MS;
    })
    .sort((a, b) => a.linkExpiresAt!.getTime() - b.linkExpiresAt!.getTime());

  const workCount = queue.length + expiring.length;

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[13px] text-muted">{t("dashboard.kicker")}</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">
            {workCount > 0
              ? t("dashboard.workWaiting", { count: workCount })
              : t("dashboard.noWork")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {workCount > 0
              ? [
                  queue.length > 0
                    ? t("dashboard.queueSummary", { count: queue.length })
                    : null,
                  expiring.length > 0
                    ? t("dashboard.expiringSummary", { count: expiring.length })
                    : null,
                ]
                  .filter(Boolean)
                  .join(", ")
              : t("dashboard.queueClear")}
          </p>
        </div>
        {/* The only filled button on this screen. */}
        {mayInvite ? (
          <Button asChild variant="primary" size="md">
            <Link href="/candidates/new">{t("shared.inviteCandidate")}</Link>
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-1.5">
            <Button
              id="invite-cta"
              variant="primary"
              size="md"
              disabled
              disabledReason={t("shared.noRolePermission")}
            >
              {t("shared.inviteCandidate")}
            </Button>
            <DisabledReason id="invite-cta-why">{t("shared.noRolePermission")}</DisabledReason>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* ---- review queue ---- */}
          <Card>
            <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold">{t("dashboard.queueTitle")}</h2>
              <span className="text-[13px] text-muted">{t("dashboard.queueOrder")}</span>
            </div>

            {queue.length === 0 ? (
              <EmptyBlock
                title={t("dashboard.queueEmpty")}
                actionLabel={mayInvite ? t("shared.inviteCandidate") : t("dashboard.seeAllCandidates")}
                actionHref={mayInvite ? "/candidates/new" : "/candidates"}
              />
            ) : (
              <>
                <ul>
                  {queue.map((row) => {
                    const state = pipelineState(row, now);
                    return (
                      <li
                        key={row.assessmentId}
                        className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0"
                      >
                        <Avatar name={row.candidateName} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{row.candidateName}</p>
                          <p className="truncate text-[13px] text-muted">
                            {row.positionName} ·{" "}
                            {t("dashboard.stageProgress", {
                              done: row.stagesCompleted,
                              total: row.stagesTotal,
                            })}
                          </p>
                        </div>
                        <span className="tnum w-28 text-right text-[13px] text-muted">
                          {row.lastActivityAt ? waiting(row.lastActivityAt, locale, now) : "-"}
                        </span>
                        <span className="w-36">
                          <StatusDot tone={state === "PARTIALLY_SCORED" ? "warn" : "neutral"}>
                            {t(`pipeline.${state}`)}
                          </StatusDot>
                        </span>
                        <Link
                          // A candidate can be invited to two positions, so the
                          // queue row must name its own assessment. Without it
                          // both rows open whichever one is newest.
                          href={`/candidates/${row.candidateId}/review?assessment=${row.assessmentId}`}
                          className="rounded-[8px] border border-line px-3 py-1.5 text-[13px]
                                     text-ink hover:bg-canvas"
                        >
                          {state === "PARTIALLY_SCORED"
                            ? t("shared.continue")
                            : t("shared.review")}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[13px] text-muted">
                    {t("dashboard.queueFooter", {
                      count: queue.length,
                      minutes: queue.length * MINUTES_PER_CANDIDATE,
                    })}
                  </span>
                  <InlineLink
                    href={`/candidates/${queue[0].candidateId}/review?assessment=${queue[0].assessmentId}`}
                    className="text-[13px]"
                  >
                    {t("dashboard.startWithFirst")}
                  </InlineLink>
                </div>
              </>
            )}
          </Card>

          {/* ---- links about to lapse ---- */}
          <Card>
            <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold">{t("dashboard.expiringTitle")}</h2>
              <span className="text-[13px] text-muted">
                {t("dashboard.expiringHint")}
              </span>
            </div>

            {expiring.length === 0 ? (
              <EmptyBlock
                title={t("dashboard.expiringEmpty")}
                actionLabel={t("dashboard.seeAllCandidates")}
                actionHref="/candidates"
              />
            ) : (
              <ul>
                {expiring.map((row) => (
                  <li
                    key={row.assessmentId}
                    className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.candidateName}</p>
                      <p className="truncate text-[13px] text-muted">{row.positionName}</p>
                    </div>
                    {/* The countdown is the third and last place the accent is allowed.
                        A lapsed link is not a countdown, so it loses the accent. */}
                    <span
                      className={
                        row.linkExpiresAt!.getTime() > now.getTime()
                          ? "tnum w-24 text-right text-[13px] font-medium text-accent"
                          : "tnum w-24 text-right text-[13px] text-muted"
                      }
                    >
                      {remaining(row.linkExpiresAt!, locale, now)}
                    </span>
                    {mayInvite ? (
                      <form action={extendLink}>
                        <input type="hidden" name="linkId" value={row.linkId ?? ""} />
                        <input type="hidden" name="days" value="3" />
                        <input type="hidden" name="back" value="/dashboard" />
                        <input type="hidden" name="candidateName" value={row.candidateName} />
                        <Button type="submit" variant="secondary" size="sm">
                          {t("dashboard.extendDays", { days: 3 })}
                        </Button>
                      </form>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled
                        disabledReason={t("shared.noRolePermission")}
                      >
                        {t("dashboard.extendDays", { days: 3 })}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ---- open positions ---- */}
        <Card className="h-fit">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold">{t("dashboard.positionsTitle")}</h2>
          </div>
          {positions.length === 0 ? (
            <div className="px-5 py-6">
              <p className="text-sm text-muted">{t("dashboard.positionsEmpty")}</p>
            </div>
          ) : (
            <ul>
              {positions.map((position) => (
                <li
                  key={position.id}
                  className="flex items-center justify-between gap-3 border-b border-line
                             px-5 py-3.5 last:border-b-0"
                >
                  <span className="min-w-0 truncate text-sm">{position.name}</span>
                  {position.hasPublishedVersion ? (
                    <Link
                      href={`/candidates?position=${position.id}`}
                      className="shrink-0 text-[13px] text-muted hover:text-ink hover:underline"
                    >
                      {t("dashboard.candidateCount", { count: position.candidateCount })}
                    </Link>
                  ) : (
                    <StatusDot tone="neutral" className="shrink-0">
                      {t("positionDetail.statusDRAFT")}
                    </StatusDot>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {params.undo === "link" && typeof params.linkId === "string" && (
        <UndoStrip
          message={t("dashboard.undoExtend", {
            name:
              typeof params.who === "string" && params.who
                ? params.who
                : t("shared.candidate"),
            days: typeof params.days === "string" ? params.days : 3,
          })}
          action={undoExtendLink}
          hiddenFields={{
            linkId: params.linkId,
            prev: typeof params.prev === "string" ? params.prev : "",
            prevStatus: typeof params.prevStatus === "string" ? params.prevStatus : "",
            back: "/dashboard",
          }}
        />
      )}
    </main>
  );
}

/** No empty list is a dead end: each one names the next concrete step. */
function EmptyBlock({
  title,
  actionLabel,
  actionHref,
}: {
  title: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-sm text-muted">{title}</p>
      <InlineLink href={actionHref} className="mt-2 inline-block text-[13px]">
        {actionLabel}
      </InlineLink>
    </div>
  );
}
