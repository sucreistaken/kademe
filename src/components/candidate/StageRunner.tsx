"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ProgressTicks } from "@/components/candidate/Countdown";
import { ChoiceActivity } from "@/components/candidate/activities/ChoiceActivity";
import { FileActivity } from "@/components/candidate/activities/FileActivity";
import { MediaActivity } from "@/components/candidate/activities/MediaActivity";
import { TextActivity } from "@/components/candidate/activities/TextActivity";
import { apiSend } from "@/lib/client/api";
import { useStageClock } from "@/lib/client/use-stage-clock";
import { useTechnicalEvents } from "@/lib/client/use-technical-events";
import { formatCountdown } from "@/lib/timer";
import { stepPath } from "@/lib/candidate-routes";
import type { CandidateState, StageActivity } from "@/lib/candidate-flow";
import { useT } from "@/i18n/candidate-client";

/**
 * Artboards A10 and A11. Runs one stage: one question on screen at a time, a
 * server-issued countdown in the bar, and no way back unless the manager
 * allowed one. The client decides nothing that matters. It renders the state
 * the server sent, and every write goes back through an endpoint that
 * re-derives which stage and which activity is being answered.
 */
export function StageRunner({
  token,
  initial,
}: {
  token: string;
  initial: CandidateState;
}) {
  const router = useRouter();
  const t = useT("stage");
  const locale = useLocale();
  const [state, setState] = useState(initial);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Record<number, boolean>>({});
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const stage = state.stage;

  /* The clock starts when the candidate actually reaches the screen, once. */
  useEffect(() => {
    if (!stage || stage.deadlineAt !== null || startedRef.current) return;
    startedRef.current = true;
    void apiSend<CandidateState>(token, "/stage/start", {})
      .then(setState)
      .catch(() => setError(t("startFailed")));
  }, [token, stage, t]);

  /*
   * Resume where the candidate left off rather than at question one. This is a
   * state reset keyed on the stage, done during render rather than in an effect
   * so the first paint is already on the right question.
   */
  const stageKey = stage ? `${stage.position}-${stage.activities.length}` : "";
  const [seenStage, setSeenStage] = useState("");
  if (stage && seenStage !== stageKey) {
    setSeenStage(stageKey);
    const seen: Record<number, boolean> = {};
    for (const activity of stage.activities) {
      seen[activity.index] = hasAnswer(activity);
    }
    setAnswered(seen);
    const firstOpen = stage.activities.findIndex((a) => !hasAnswer(a));
    setIndex(firstOpen === -1 ? stage.activities.length - 1 : firstOpen);
  }

  const clock = useStageClock(
    token,
    {
      serverNow: stage?.serverNow ?? Date.now(),
      deadlineAt: stage?.deadlineAt ?? null,
    },
    () => {
      // The server closes an overrun stage either way; submitting from here just
      // means the candidate sees the next screen instead of a dead one.
      if (stage?.onTimeout === "AUTO_SUBMIT" || stage?.onTimeout === "AUTO_CLOSE") {
        void submit(true);
      }
    },
  );

  useTechnicalEvents(token, !!stage, stream);

  const activity = stage?.activities[index];
  const isLastActivity = !!stage && index === stage.activities.length - 1;
  const isLastStage = !!stage && stage.position === stage.total;
  const isMedia = activity?.type === "VIDEO" || activity?.type === "AUDIO";

  const missingRequired = useMemo(() => {
    if (!stage) return [];
    return stage.activities.filter((a) => a.isRequired && !answered[a.index]);
  }, [stage, answered]);

  async function submit(auto = false) {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<CandidateState>(token, "/stage/submit", {});
      setState(next);
      router.push(stepPath(token, next));
      router.refresh();
    } catch (err) {
      if (!auto) {
        setError(err instanceof Error ? err.message : t("submitFailed"));
      }
      setBusy(false);
    }
  }

  if (!stage || !activity) {
    return (
      <p className="p-10 text-center text-sm text-muted">{t("preparing")}</p>
    );
  }

  const canAdvance = !activity.isRequired || answered[activity.index];
  const advanceReason = activity.isRequired ? t("requiredBlocks") : "";
  const submitReason =
    missingRequired.length > 0
      ? t("requiredWaiting", { count: missingRequired.length })
      : "";

  return (
    /* The subtree carries its own `lang` so uppercase styling and screen
       readers follow the candidate's language, not the document's. */
    <div lang={locale} className="min-h-dvh bg-surface">
      {/* Think time is a single centred countdown on artboard A10, with no
          header above it. Leaving the shell in place put a second, accent
          coloured timer over the one the candidate is watching. */}
      {thinking ? null : (
      <header className="flex h-14 items-center justify-between border-b border-hairline px-7">
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] font-medium text-muted">
            {t("position", {
              position: stage.position,
              total: stage.total,
              question: index + 1,
              questions: stage.activities.length,
            })}
          </span>
          <ProgressTicks total={stage.total} current={stage.position} />
        </div>
        {recording ? (
          <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
            <span className="size-[7px] rounded-full bg-accent" />
            {t("recordingNow")}
          </div>
        ) : (
          <div className="flex items-center gap-3.5">
            <span className="text-[12.5px] text-muted">{t("remaining")}</span>
            <span className="tnum font-mono text-[15px] font-bold text-accent">
              {formatCountdown(clock.remainingMs)}
            </span>
          </div>
        )}
      </header>
      )}

      <main className="mx-auto w-full max-w-[1000px] px-7 pt-9 pb-11">
        <div
          className="mx-auto w-full"
          style={{ maxWidth: isMedia ? 760 : 720 }}
        >
          {/* Think time is one card and nothing else on artboard A10, so the
              stage description waits until the question screen. */}
          {stage.description && index === 0 && !thinking ? (
            <p className="mb-6 border-l-2 border-line pl-4 text-[13.5px] leading-[1.6] text-muted">
              {stage.description}
            </p>
          ) : null}

          <ActivityView
            key={`${stage.position}-${activity.index}`}
            token={token}
            activity={activity}
            locale={state.locale}
            onAnswered={(ok) =>
              setAnswered((prev) => ({ ...prev, [activity.index]: ok }))
            }
            onStream={setStream}
            onRecording={setRecording}
            onThinking={setThinking}
          />

          {thinking ? null : (
          <div className="mt-5 flex items-center justify-between gap-4">
            <span className="text-[12.5px] text-muted">
              {stage.backNavigation && index > 0 ? (
                <button
                  type="button"
                  onClick={() => setIndex((i) => i - 1)}
                  className="underline decoration-line underline-offset-2"
                >
                  {t("previousQuestion")}
                </button>
              ) : (
                t("keepsWhatYouWrote")
              )}
            </span>

            <div className="flex items-center gap-3">
              {!isLastActivity ? (
                <>
                  {!canAdvance ? (
                    <span className="text-[12.5px] text-muted">{advanceReason}</span>
                  ) : null}
                  <button
                    type="button"
                    id="next"
                    disabled={!canAdvance}
                    onClick={() => setIndex((i) => i + 1)}
                    className={primaryButton(canAdvance)}
                  >
                    {t("nextQuestion")}
                  </button>
                </>
              ) : (
                <>
                  {missingRequired.length > 0 ? (
                    <span className="text-[12.5px] text-muted">{submitReason}</span>
                  ) : (
                    <span className="text-[12.5px] font-medium text-ink">
                      {t("continueLater")}
                    </span>
                  )}
                  <button
                    type="button"
                    id="submit"
                    disabled={missingRequired.length > 0 || busy}
                    onClick={() => void submit()}
                    className={primaryButton(missingRequired.length === 0 && !busy)}
                  >
                    {busy
                      ? t("submitting")
                      : isLastStage
                        ? t("submitFinal")
                        : t("submitAndNext", { next: stage.position + 1 })}
                  </button>
                </>
              )}
            </div>
          </div>
          )}

          {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
        </div>
      </main>
    </div>
  );
}

/** The one filled button on the screen, per the canvas rule. */
function primaryButton(enabled: boolean) {
  return enabled
    ? "rounded-[9px] bg-accent px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent-hover"
    : "cursor-not-allowed rounded-[9px] bg-disabled px-5 py-3 text-[13.5px] font-semibold text-ink-3";
}

function ActivityView({
  token,
  activity,
  locale,
  onAnswered,
  onStream,
  onRecording,
  onThinking,
}: {
  token: string;
  activity: StageActivity;
  locale: "tr" | "en";
  onAnswered: (answered: boolean) => void;
  onStream: (stream: MediaStream | null) => void;
  onRecording: (recording: boolean) => void;
  onThinking: (thinking: boolean) => void;
}) {
  switch (activity.type) {
    case "VIDEO":
    case "AUDIO":
      return (
        <MediaActivity
          token={token}
          activity={activity}
          onAnswered={onAnswered}
          onStream={onStream}
          onRecording={onRecording}
          onThinking={onThinking}
        />
      );
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return (
        <ChoiceActivity
          token={token}
          activity={activity}
          locale={locale}
          onAnswered={onAnswered}
        />
      );
    case "FILE_UPLOAD":
      return (
        <FileActivity token={token} activity={activity} onAnswered={onAnswered} />
      );
    default:
      return (
        <TextActivity token={token} activity={activity} onAnswered={onAnswered} />
      );
  }
}

function hasAnswer(activity: StageActivity): boolean {
  const payload = activity.payload;
  if (!payload) return false;
  switch (activity.type) {
    case "VIDEO":
    case "AUDIO":
      return !!payload.mediaAssetId || !!payload.text?.trim();
    case "FILE_UPLOAD":
      return (payload.fileAssetIds ?? []).length > 0;
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return (payload.choiceIds ?? []).length > 0;
    default:
      return !!payload.text?.trim();
  }
}
