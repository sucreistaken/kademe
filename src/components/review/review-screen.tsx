"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { Transcript } from "./transcript";
import { VideoPlayer, type PlayerHandle } from "./video-player";
import { ScoringRail, type RailCompetency, type SaveState } from "./scoring-rail";
import { saveEvaluationItem } from "@/app/(manager)/candidates/[id]/review/actions";
import { averageScore } from "@/lib/scoring";
import { score as formatScore } from "@/lib/format";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import type { TranscriptWord } from "@/db/schema/types";

export type ReviewActivity = {
  id: string;
  type: string;
  candidatePrompt: string;
  candidateNote: string | null;
  internalObjective: string | null;
  expectedBehaviours: string[];
  redFlags: string[];
  mediaUrl: string | null;
  mediaStatus: string | null;
  transcriptText: string;
  transcriptWords: TranscriptWord[];
  answerText: string | null;
};

export type ReviewStageView = {
  id: string;
  name: string;
  /** The language `name` is actually in, which is not always the panel's. */
  nameLang: Locale;
  completion: string;
  isCarried: boolean;
  internalPurpose: string | null;
  activities: ReviewActivity[];
  competencies: RailCompetency[];
  eventCount: number;
};

const COMPLETION_KEYS = [
  "COMPLETE",
  "PARTIAL",
  "EXPIRED",
  "SKIPPED",
  "PENDING",
] as const;

type CompletionKey = (typeof COMPLETION_KEYS)[number];

function isCompletion(value: string): value is CompletionKey {
  return (COMPLETION_KEYS as readonly string[]).includes(value);
}

export function ReviewScreen({
  evaluationId,
  candidateName,
  positionName,
  attemptLabel,
  stages: initialStages,
  canScore,
  queue,
}: {
  evaluationId: string;
  candidateName: string;
  positionName: string;
  attemptLabel: string;
  stages: ReviewStageView[];
  canScore: boolean;
  queue: {
    position: number;
    total: number;
    previousHref: string | null;
    nextHref: string | null;
  } | null;
}) {
  const t = useMT("review");
  const shared = useMT("shared");
  const completion = useMT("stageCompletion");
  const locale = useLocale() as Locale;
  const [stages, setStages] = useState(initialStages);
  const [stageIndex, setStageIndex] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [showInternal, setShowInternal] = useState(true);

  const playerRef = useRef<PlayerHandle | null>(null);
  const noteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const stage = stages[stageIndex];
  const videoActivity = stage?.activities.find((a) => a.mediaUrl) ?? null;
  // Read the id once. The callbacks below depend on the id, not the whole
  // stage object, and the dependency lists have to say exactly that.
  const stageId = stage?.id;
  const stageCompetencies = stage?.competencies;

  /* ---------- persistence ---------- */

  const persist = useCallback(
    async (competencyId: string, patch: Parameters<typeof saveEvaluationItem>[0]) => {
      setSaveState("saving");
      const result = await saveEvaluationItem(patch);
      if (result.ok) {
        setSaveState("saved");
        setSavedAt(
          new Date(result.at).toLocaleTimeString(
            locale === "tr" ? "tr-TR" : "en-GB",
            { hour: "2-digit", minute: "2-digit" },
          ),
        );
      } else {
        setSaveState("error");
      }
    },
    [locale],
  );

  const patchCompetency = useCallback(
    (competencyId: string, patch: Partial<RailCompetency>) => {
      setStages((prev) =>
        prev.map((s) =>
          s.id !== stageId
            ? s
            : {
                ...s,
                competencies: s.competencies.map((c) =>
                  c.id === competencyId ? { ...c, ...patch } : c,
                ),
              },
        ),
      );
    },
    [stageId],
  );

  const handleScore = useCallback(
    (competencyId: string, score: number | null) => {
      if (!canScore) return;
      if (!stageId) return;
      patchCompetency(competencyId, { score });
      void persist(competencyId, {
        evaluationId,
        competencyId,
        stageId,
        score,
      });
    },
    [canScore, patchCompetency, persist, evaluationId, stageId],
  );

  const handleToggleOption = useCallback(
    (competencyId: string, optionId: string) => {
      if (!canScore) return;
      if (!stageId) return;
      const competency = stageCompetencies?.find((c) => c.id === competencyId);
      if (!competency) return;
      const next = competency.selectedOptionIds.includes(optionId)
        ? competency.selectedOptionIds.filter((id) => id !== optionId)
        : [...competency.selectedOptionIds, optionId];
      patchCompetency(competencyId, { selectedOptionIds: next });
      void persist(competencyId, {
        evaluationId,
        competencyId,
        stageId,
        selectedOptionIds: next,
      });
    },
    [canScore, stageId, stageCompetencies, patchCompetency, persist, evaluationId],
  );

  // Notes debounce; scores and chips do not, because those are single decisive
  // clicks and the manager should see them stick immediately.
  const handleNote = useCallback(
    (competencyId: string, note: string) => {
      if (!canScore || !stageId) return;
      patchCompetency(competencyId, { note });
      const timers = noteTimers.current;
      const existing = timers.get(competencyId);
      if (existing) clearTimeout(existing);
      timers.set(
        competencyId,
        setTimeout(() => {
          void persist(competencyId, {
            evaluationId,
            competencyId,
            stageId,
            note,
          });
        }, 600),
      );
    },
    [canScore, patchCompetency, persist, evaluationId, stageId],
  );

  useEffect(() => {
    const timers = noteTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  /* ---------- keyboard ---------- */

  const seek = useCallback((ms: number) => {
    playerRef.current?.seekTo(ms);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // Never steal keys while the manager is writing a note.
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const competencies = stages[stageIndex]?.competencies ?? [];

      if (event.key >= "1" && event.key <= "5") {
        const competency = competencies[focusedIndex];
        if (competency) {
          event.preventDefault();
          handleScore(competency.id, Number(event.key));
        }
        return;
      }
      if (event.key === "j" || event.key === "J") {
        event.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, Math.max(competencies.length - 1, 0)));
        return;
      }
      if (event.key === "k" || event.key === "K") {
        event.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        playerRef.current?.togglePlay();
        return;
      }
      if (event.key === "ArrowLeft") seek(Math.max(0, currentMs - 15_000));
      if (event.key === "ArrowRight") seek(currentMs + 15_000);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stages, stageIndex, focusedIndex, handleScore, seek, currentMs]);

  if (!stage) {
    return (
      <p className="p-10 text-[13px] text-muted">{t("noStages")}</p>
    );
  }

  const allScored = stages.every((s) =>
    s.competencies.every((c) => c.score !== null),
  );
  const isLastStage = stageIndex === stages.length - 1;

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-6">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">{candidateName}</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {positionName} · {attemptLabel}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {queue && queue.total > 1 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[12.5px] text-muted tnum">
                {t("queuePosition", { total: queue.total, position: queue.position })}
              </span>
              <QueueStep href={queue.previousHref} label={t("previousCandidate")}>
                ‹
              </QueueStep>
              <QueueStep href={queue.nextHref} label={t("nextCandidate")}>
                ›
              </QueueStep>
            </div>
          ) : null}
          <p className="text-[12.5px] text-muted">{t("autosaveHint")}</p>
        </div>
      </div>

      {/* stage tabs */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {stages.map((s, i) => {
          const avg = averageScore(
            s.competencies.map((c) => ({ competencyId: c.id, score: c.score })),
          );
          const active = i === stageIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setStageIndex(i);
                setFocusedIndex(0);
                setCurrentMs(0);
              }}
              className={cn(
                "rounded-[8px] border px-3 py-2 text-left transition-colors",
                active
                  ? "border-ink/25 bg-surface"
                  : "border-line bg-surface/60 hover:bg-surface",
              )}
            >
              <span className="block text-[13px] font-medium">
                {i + 1} · <span lang={s.nameLang}>{s.name}</span>
              </span>
              <span className="mt-0.5 block">
                <StatusDot tone={avg !== null ? "active" : "neutral"}>
                  {avg !== null
                    ? t("scoredWith", { score: formatScore(avg, locale) })
                    : isCompletion(s.completion)
                      ? completion(s.completion)
                      : shared("notScored")}
                </StatusDot>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* left: the candidate's answer */}
        <div className="space-y-4">
          {stage.isCarried ? (
            <p className="rounded-[10px] border border-line bg-surface px-4 py-3 text-[12.5px] text-muted">
              {t("carried")}
            </p>
          ) : null}

          {stage.activities.map((activity) => {
            const isSupportingText =
              !activity.mediaUrl &&
              !activity.mediaStatus &&
              Boolean(activity.answerText) &&
              stage.activities.some((a) => a.mediaUrl);

            if (isSupportingText) {
              return (
                <details
                  key={activity.id}
                  className="group/answer rounded-[14px] border border-line bg-surface px-5 py-4"
                >
                  <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4">
                    <span className="text-[13px] text-muted">
                      {t("supportingText")} ·{" "}
                      <span className="text-ink">{activity.candidatePrompt}</span>
                    </span>
                    <span className="shrink-0 text-[12.5px] text-muted">
                      <span className="group-open/answer:hidden">{shared("show")} ⌄</span>
                      <span className="hidden group-open/answer:inline">
                        {shared("hide")} ⌃
                      </span>
                    </span>
                  </summary>
                  <div className="mt-3 rounded-[10px] bg-canvas px-4 py-3">
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                      {activity.answerText}
                    </p>
                  </div>
                </details>
              );
            }

            return (
            <section
              key={activity.id}
              className="rounded-[14px] border border-line bg-surface p-5"
            >
              <p className="text-[11.5px] uppercase tracking-wide text-muted">
                {t("candidateAnswer")}
              </p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed">
                {activity.candidatePrompt}
              </p>

              {activity.mediaUrl ? (
                <div className="mt-3">
                  <VideoPlayer
                    src={activity.mediaUrl}
                    handleRef={activity === videoActivity ? playerRef : undefined}
                    onTimeUpdate={(ms) => {
                      if (activity === videoActivity) setCurrentMs(ms);
                    }}
                    transcriptText={activity.transcriptText || undefined}
                    transcriptName={`${candidateName} - ${stage.name}`}
                  />
                </div>
              ) : activity.mediaStatus ? (
                <p className="mt-3 text-[13px] text-muted">
                  {t("mediaNotReady", { status: activity.mediaStatus })}
                </p>
              ) : null}

              {activity.answerText ? (
                <div className="mt-3 rounded-[10px] bg-canvas px-4 py-3">
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                    {activity.answerText}
                  </p>
                </div>
              ) : null}

              {activity.mediaUrl ? (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-1 text-[11.5px] uppercase tracking-wide text-muted">
                    {t("transcript")}
                  </p>
                  <Transcript
                    words={activity.transcriptWords}
                    text={activity.transcriptText}
                    currentMs={activity === videoActivity ? currentMs : -1}
                    onSeek={seek}
                  />
                </div>
              ) : null}
            </section>
            );
          })}

          {/* manager-only block. Never rendered anywhere a candidate can reach. */}
          <section className="rounded-[14px] border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11.5px] uppercase tracking-wide text-muted">
                {t("managerOnly")}
              </p>
              <button
                type="button"
                onClick={() => setShowInternal((v) => !v)}
                aria-expanded={showInternal}
                className="text-[12px] text-muted hover:text-ink"
              >
                {showInternal ? `${shared("hide")} ⌃` : `${shared("show")} ⌄`}
              </button>
            </div>

            {showInternal ? (
              <div className="mt-3 space-y-4">
                {stage.internalPurpose ? (
                  <div>
                    <p className="text-[12.5px] font-medium">{t("internalPurpose")}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                      {stage.internalPurpose}
                    </p>
                  </div>
                ) : null}

                {stage.activities
                  .filter((a) => a.redFlags.length > 0)
                  .map((a) => (
                    <div key={a.id}>
                      <p className="text-[12.5px] font-medium">{t("redFlags")}</p>
                      <ul className="mt-1 space-y-1">
                        {a.redFlags.map((flag, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-[12.5px] leading-snug text-muted"
                          >
                            <span aria-hidden>·</span>
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            ) : null}
          </section>

          {stage.eventCount > 0 ? (
            <p className="text-[12px] text-muted">
              {t("eventNote", { count: stage.eventCount })}
            </p>
          ) : null}
        </div>

        {/* right: scoring */}
        <ScoringRail
          stageName={stage.name}
          stageNameLang={stage.nameLang}
          competencies={stage.competencies}
          focusedIndex={focusedIndex}
          saveState={saveState}
          savedAt={savedAt}
          expectedBehaviours={Object.fromEntries(
            stage.competencies.map((c) => [
              c.id,
              stage.activities.flatMap((a) => a.expectedBehaviours),
            ]),
          )}
          onScore={handleScore}
          onToggleOption={handleToggleOption}
          onNote={handleNote}
          onFocusCompetency={setFocusedIndex}
          footer={
            isLastStage ? (
              <>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={!allScored}
                  disabledReason={
                    !allScored ? t("decideBlocked") : undefined
                  }
                  asChild={allScored}
                >
                  {allScored ? (
                    <a href="./decision">{t("decide")}</a>
                  ) : (
                    <span>{t("decide")}</span>
                  )}
                </Button>
                {!allScored ? (
                  <p className="mt-1.5 text-[12px] text-muted">
                    {t("decideBlockedNote")}
                  </p>
                ) : null}
              </>
            ) : (
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => {
                  setStageIndex((i) => i + 1);
                  setFocusedIndex(0);
                  setCurrentMs(0);
                }}
              >
                {t("nextStage", { number: stageIndex + 2 })}
              </Button>
            )
          }
        />
      </div>

      <p className="mt-4 text-[11.5px] text-muted">{t("shortcuts")}</p>
    </div>
  );
}

/** One step through the review queue, or a dead control at either end. */
function QueueStep({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const shape =
    "grid size-6 place-items-center rounded-[6px] border border-line text-[13px]";
  if (!href) {
    return (
      <span className={cn(shape, "text-line")} aria-hidden>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(shape, "text-muted hover:text-ink")}
    >
      {children}
    </Link>
  );
}
