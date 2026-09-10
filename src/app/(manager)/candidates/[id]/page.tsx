import Link from "next/link";
import { InlineLink } from "@/components/ui/inline-link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button, DisabledReason } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { Avatar } from "@/components/ui/avatar";
import { UndoStrip } from "@/components/ui/undo-strip";
import { requireUser } from "@/server/session";
import { can } from "@/lib/authorize";
import { RetakePanel } from "@/components/manager/retake-panel";
import {
  loadCandidateDetail,
  pipelineState,
  type DetailStage,
} from "@/lib/manager-data";
import {
  charCount,
  clockTime,
  mediaLength,
  score as formatScore,
  shortDate,
  truncate,
} from "@/lib/format";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import type { Locale } from "@/i18n/locale";
import type { I18nText } from "@/db/schema/types";
import { saveDecision, undoDecision } from "../../actions";

type T = ReturnType<typeof managerT>;

/** The three calls a manager actually makes on this screen. */
const DECISION_CHOICES = [
  { value: "SHORTLISTED", key: "choiceShortlist" },
  { value: "ON_HOLD", key: "choiceHold" },
  { value: "REJECTED", key: "choiceReject" },
] as const;

/**
 * Template content is bilingual data, so it is picked by the reader's locale
 * with a fallback to the other language rather than pinned to Turkish.
 */
function pick(value: I18nText | null | undefined, locale: Locale): string {
  if (!value) return "";
  const wanted = value[locale];
  if (wanted && wanted.trim()) return wanted;
  return (locale === "tr" ? value.en : value.tr) ?? "";
}

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const { id } = await params;
  const query = await searchParams;
  const detail = await loadCandidateDetail(user.orgId, id);
  if (!detail) notFound();

  const { row, stages, attempts, events, decisions } = detail;
  const now = new Date();
  const state = pipelineState(row, now);
  const back = `/candidates/${id}`;

  const scoredStages = stages.filter((stage) => stage.average !== null).length;
  const allStagesScored = stages.length > 0 && scoredStages === stages.length;
  const mayDecide = can(user, "decision:write");
  const mayInvite = can(user, "candidate:invite");
  const currentDecision = decisions[0] ?? null;

  const decisionBlockedReason = !mayDecide
    ? t("candidateDetail.cannotDecideRole")
    : !allStagesScored
      ? t("candidateDetail.cannotDecideUnscored", {
          total: stages.length,
          scored: scoredStages,
        })
      : null;

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <p className="text-[13px] text-muted">
        <Link href="/candidates" className="hover:text-ink hover:underline">
          {t("shared.candidatesBreadcrumb")}
        </Link>{" "}
        / {row.candidateName}
      </p>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <Avatar name={row.candidateName} className="size-12 text-[15px]" />
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">{row.candidateName}</h1>
            <p className="mt-0.5 text-[13px] text-muted">
              {row.candidateEmail ?? t("shared.noEmail")} ·{" "}
              {t("candidateDetail.invited", { date: shortDate(row.invitedAt, locale) })}
              {row.attemptCompletedAt
                ? ` · ${t("candidateDetail.completed", {
                    date: shortDate(row.attemptCompletedAt, locale),
                  })}`
                : ""}
            </p>
            <p className="mt-1 text-[13px] text-muted">{row.positionName}</p>
          </div>
        </div>
        <StatusDot tone={state === "IN_PROGRESS" ? "active" : "neutral"}>
          {currentDecision
            ? t(`decision.${currentDecision.status}`)
            : t(`pipeline.${state}`)}
        </StatusDot>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* ---- attempts ---- */}
          {attempts.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {attempts.map((attempt) => (
                <span
                  key={attempt.id}
                  className={
                    attempt.isPrimary
                      ? "rounded-full border border-ink bg-ink px-3.5 py-1.5 text-[12.5px] font-medium text-surface"
                      : "rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-[12.5px] font-medium text-ink-2"
                  }
                >
                  {t("shared.attempt", { number: attempt.attemptNumber })} ·{" "}
                  {attempt.isPrimary
                    ? t("candidateDetail.attemptValid")
                    : (attempt.createdReason ?? t("candidateDetail.attemptInvalid"))}
                </span>
              ))}
            </div>
          )}

          {/* ---- stage by stage: one card, a divider between stages ----
              Three separate cards read as three unrelated things. The canvas
              keeps one card so the stages read as one candidate's run. ---- */}
          <Card className="overflow-hidden">
            {stages.map((stage) => (
              <StageBlock
                key={stage.stageId}
                stage={stage}
                candidateId={id}
                locale={locale}
                t={t}
              />
            ))}
          </Card>

          {/* ---- technical records: a thin row, not a card ----
              These are diagnostics. Giving them a full card and a 15px heading
              put them level with the answers, which is not where they belong in
              the hierarchy. ---- */}
          <details className="group rounded-[10px] border border-line bg-surface">
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
              <span>
                <span className="block text-[12.5px] font-medium text-ink-2">
                  {t("candidateDetail.technicalTitle")}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-ink-3">
                  {t("candidateDetail.technicalHint", { count: events.length })}
                </span>
              </span>
              <span className="shrink-0 text-[12.5px] text-muted group-open:hidden">
                {t("shared.open")} ⌄
              </span>
              <span className="hidden shrink-0 text-[12.5px] text-muted group-open:inline">
                {t("shared.hide")} ⌃
              </span>
            </summary>
            <div className="border-t border-line px-4 py-3">
                {events.length === 0 ? (
                  <p className="py-2 text-[13px] text-muted">
                    {t("candidateDetail.technicalEmpty")}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {events.map((event) => (
                      <li key={event.id} className="text-[13px] text-muted">
                        <span className="tnum">{clockTime(event.at)}</span> ·{" "}
                        {eventLabel(event.type, t)}
                        {typeof event.meta?.seconds === "number"
                          ? ` · ${t("candidateDetail.eventSeconds", {
                              count: event.meta.seconds,
                            })}`
                          : ""}
                      </li>
                    ))}
                  </ul>
              )}
            </div>
          </details>
        </div>

        {/* ---- right rail: one continuous panel ----
            The summary and the decision are one train of thought, so the canvas
            runs them down a single panel instead of stacking two cards. ---- */}
        <Card elevated className="self-start overflow-hidden">
          <div className="px-5 pt-4 pb-1">
            <h2 className="text-[13.5px] font-semibold">
              {t("candidateDetail.competencySummary")}
            </h2>
          </div>
          {row.competencyScores.length === 0 ? (
              <div className="px-5 py-6">
                <p className="text-[13px] text-muted">
                  {t("candidateDetail.notScoredYet")}
                </p>
                <InlineLink
                  href={`/candidates/${id}/review`}
                  className="mt-2 inline-block text-[13px]"
                >
                  {t("candidateDetail.startScoring")}
                </InlineLink>
              </div>
            ) : (
              <>
              <ul className="px-5 pb-1">
                {row.competencyScores.map((competency) => (
                  <li
                    key={competency.competencyId}
                    className="flex items-center justify-between gap-3 border-t
                               border-row-line py-2.5"
                  >
                    <span className="text-[12.5px] text-ink-2">
                      {pick(competency.name, locale)}
                    </span>
                    <span className="tnum text-[13px] font-semibold">
                      {competency.score === null
                        ? t("shared.notScored")
                        : formatScore(competency.score, locale)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mx-5 flex items-center justify-between border-t border-line pt-3">
                <span className="text-[13px] font-semibold">
                  {t("candidateDetail.overall")}
                </span>
                <span className="tnum text-[18px] font-bold">
                  {row.overall === null
                    ? t("shared.notScored")
                    : formatScore(row.overall, locale)}
                </span>
              </div>
              </>
            )}

          <div className="px-5 pt-5 pb-1">
            <h2 className="text-[13.5px] font-semibold">
              {t("candidateDetail.decisionTitle")}
            </h2>
          </div>
            <form action={saveDecision} className="px-5 py-4">
              <input type="hidden" name="assessmentId" value={row.assessmentId} />
              <input type="hidden" name="back" value={back} />

              <fieldset className="space-y-2" disabled={Boolean(decisionBlockedReason)}>
                <legend className="sr-only">{t("candidateDetail.decisionOptions")}</legend>
                {DECISION_CHOICES.map((choice) => (
                  <label
                    key={choice.value}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[10px]
                               border border-line px-3.5 py-2.5 text-sm hover:bg-canvas
                               has-[:checked]:border-accent has-[:disabled]:cursor-not-allowed
                               has-[:disabled]:text-muted"
                  >
                    <input
                      type="radio"
                      name="status"
                      value={choice.value}
                      defaultChecked={currentDecision?.status === choice.value}
                      className="accent-[var(--color-accent)]"
                      required
                    />
                    {t(`candidateDetail.${choice.key}`)}
                  </label>
                ))}
              </fieldset>

              <label className="mt-4 block text-[13px] text-muted" htmlFor="decision-note">
                {t("candidateDetail.noteLabel")}
              </label>
              <textarea
                id="decision-note"
                name="note"
                rows={3}
                defaultValue={currentDecision?.note ?? ""}
                disabled={Boolean(decisionBlockedReason)}
                className="mt-1.5 w-full rounded-[10px] border border-line bg-surface px-3 py-2
                           text-sm disabled:text-muted"
              />

              <div className="mt-4 space-y-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={Boolean(decisionBlockedReason)}
                  disabledReason={decisionBlockedReason ?? undefined}
                >
                  {t("candidateDetail.saveDecision")}
                </Button>
                {decisionBlockedReason ? (
                  <DisabledReason>{decisionBlockedReason}</DisabledReason>
                ) : (
                  <p className="text-[13px] text-muted">
                    {t("candidateDetail.undoWindow")}
                  </p>
                )}
              </div>
            </form>

            {/* A retake is the honest answer when the assessment went wrong for
                reasons that are not the candidate's fault, so it lives next to
                the decision rather than hidden somewhere else. */}
            <RetakePanel
              assessmentId={row.assessmentId}
              stages={stages.map((stage) => ({
                id: stage.stageId,
                name: pick(stage.name, locale) || t("candidateDetail.stageFallback"),
                index: stage.orderIndex,
              }))}
              attempts={attempts.map((attempt) => ({
                id: attempt.id,
                attemptNumber: attempt.attemptNumber,
                isPrimary: attempt.isPrimary,
                completedAt: attempt.completedAt?.toISOString() ?? null,
              }))}
              canRequest={mayInvite && attempts.length > 0}
              blockedReason={
                !mayInvite
                  ? t("candidateDetail.retakeNoRole")
                  : attempts.length === 0
                    ? t("candidateDetail.retakeNeverStarted")
                    : undefined
              }
            />

            {decisions.length > 1 && (
              <div className="border-t border-line px-5 py-3.5">
                <p className="text-[13px] text-muted">
                  {t("candidateDetail.decisionHistory")}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {decisions.slice(1).map((decision, index) => (
                    <li key={index} className="text-[13px] text-muted">
                      {shortDate(decision.at, locale)} · {t(`decision.${decision.status}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </Card>
      </div>

      {query.undo === "decision" && typeof query.decisionId === "string" && (
        <UndoStrip
          message={t("candidateDetail.decisionSaved")}
          action={undoDecision}
          hiddenFields={{ decisionId: query.decisionId, back }}
        />
      )}
    </main>
  );
}

const EVENT_KEYS = [
  "VISIBILITY_HIDDEN",
  "VISIBILITY_VISIBLE",
  "WINDOW_BLUR",
  "WINDOW_FOCUS",
  "FULLSCREEN_ENTER",
  "FULLSCREEN_EXIT",
  "CAMERA_MUTED",
  "CAMERA_UNMUTED",
  "MIC_MUTED",
  "MIC_UNMUTED",
  "OFFLINE",
  "ONLINE",
  "PAGE_UNLOAD",
  "UPLOAD_STALLED",
  "UPLOAD_RESUMED",
  "DEVICE_CHECK_FAILED",
] as const;

/** An unknown event type is shown raw rather than swallowed by the dictionary. */
function eventLabel(type: string, t: T): string {
  return (EVENT_KEYS as readonly string[]).includes(type)
    ? t(`techEvent.${type as (typeof EVENT_KEYS)[number]}`)
    : type;
}

/**
 * A truncated written answer with no way to expand is a dead end: the manager
 * decides on half a sentence and is not even told it was cut.
 */
function AnswerText({ text, t }: { text: string; t: T }) {
  const limit = 200;

  if (text.length <= limit) {
    return <p className="mt-2 whitespace-pre-wrap text-[13px] text-muted">{text}</p>;
  }

  // Named group: this sits inside the stage <details>, and a bare `group`
  // variant would answer to whichever ancestor group is open.
  return (
    <details className="group/answer mt-2">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span
          className="block whitespace-pre-wrap text-[13px] text-muted
                     group-open/answer:hidden"
        >
          {truncate(text, limit)}
        </span>
        <span
          className="mt-1 inline-block text-[13px] font-medium text-ink underline
                     decoration-underline underline-offset-2"
        >
          <span className="group-open/answer:hidden">{t("candidateDetail.showFull")} ⌄</span>
          <span className="hidden group-open/answer:inline">
            {t("candidateDetail.collapse")} ⌃
          </span>
        </span>
      </summary>
      <p className="whitespace-pre-wrap text-[13px] text-muted">{text}</p>
    </details>
  );
}

/**
 * One stage, collapsed by default apart from its heading. The manager scans the
 * headings, opens the one they care about, and never loses the page position.
 */
function StageBlock({
  stage,
  candidateId,
  locale,
  t,
}: {
  stage: DetailStage;
  candidateId: string;
  locale: Locale;
  t: T;
}) {
  const answered = stage.activities.filter(
    (activity) => activity.media || activity.text,
  ).length;

  return (
    <div className="border-b border-line last:border-b-0">
      <details className="group" open={stage.orderIndex === 1}>
        <summary className="flex cursor-pointer items-center justify-between gap-4 px-[18px] py-3.5">
          <span>
            <span className="block text-[13.5px] font-semibold">
              {t("candidateDetail.stageHeading", {
                index: stage.orderIndex + 1,
                name: pick(stage.name, locale),
              })}
            </span>
            <span className="mt-0.5 block text-[12px] text-muted">
              {t("candidateDetail.activityCount", { count: stage.activities.length })}
              {stage.average !== null
                ? ` · ${t("candidateDetail.stageAverage", {
                    score: formatScore(stage.average, locale),
                  })}`
                : ""}
              {stage.completion === "EXPIRED"
                ? ` · ${t("candidateDetail.stageExpired")}`
                : ""}
            </span>
          </span>
          <span className="shrink-0 text-[12.5px] font-medium group-open:hidden">
            {t("shared.show")} ⌄
          </span>
          <span className="hidden shrink-0 text-[12.5px] font-medium group-open:inline">
            {t("shared.hide")} ⌃
          </span>
        </summary>

        <div>
          {answered === 0 ? (
            <div className="px-5 py-6">
              <p className="text-[13px] text-muted">
                {stage.completion === "EXPIRED"
                  ? t("candidateDetail.stageExpiredEmpty")
                  : t("candidateDetail.stageNoAnswers")}
              </p>
            </div>
          ) : (
            <ul className="space-y-2 px-[18px] pb-4">
              {stage.activities.map((activity) => (
                <li key={activity.activityId} className="rounded-[10px] bg-paper p-3">
                  <div className="flex gap-3.5">
                    {activity.media && <VideoThumb />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">
                        {pick(activity.prompt, locale)}
                        <span className="font-normal text-muted">
                          {" · "}
                          {activity.media
                            ? t("candidateDetail.answerVideo", {
                                length: mediaLength(activity.media.durationMs),
                              })
                            : activity.text
                              ? t("candidateDetail.answerWritten", {
                                  count: charCount(activity.text, locale),
                                })
                              : t("candidateDetail.answerNone")}
                        </span>
                      </p>

                      {activity.transcriptExcerpt && (
                        <p className="mt-1 text-[12.5px] text-muted">
                          “{truncate(activity.transcriptExcerpt, 160)}”
                        </p>
                      )}
                      {!activity.media && activity.text && (
                        <AnswerText text={activity.text} t={t} />
                      )}

                      {activity.media && (
                        <InlineLink
                          href={`/candidates/${candidateId}/review`}
                          className="mt-1.5 inline-block text-[12px]"
                        >
                          {t("candidateDetail.openInReview")}
                        </InlineLink>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}

/**
 * The 112x66 still that stands in for a video answer. It is a placeholder, not
 * a frame grab: pulling a real frame would mean decoding every candidate's
 * video on a list screen, and a frame of someone's face adds nothing the label
 * next to it does not already say. Decorative, so it is hidden from readers.
 */
function VideoThumb() {
  return (
    <span
      aria-hidden
      className="flex h-[66px] w-[112px] flex-none items-center justify-center
                 rounded-[6px] bg-panel-top"
    >
      <span
        className="ml-[3px] block h-0 w-0 border-y-[6px] border-l-[10px]
                   border-y-transparent border-l-white"
      />
    </span>
  );
}
