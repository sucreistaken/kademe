"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { FlushRegistry } from "@/lib/client/flush-registry";
import { CHUNK_MS, pickChunkedRecorderMime } from "@/lib/client/recorder";
import { formatCountdown } from "@/lib/timer";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";
import { ActionBar } from "./action-bar";
import { ActivityHeader } from "./activity-header";
import type { RecordingResult, RecordingSink, TakeProgress } from "./recording-sink";
import { serverMessage } from "./server-message";
import { trackStream } from "./streams";
import { canTryAgain, finishFailure, retakesLeft, startFailure, Take, usedAfterStartFailure, type RecorderLike, type TakeOutcome } from "./take";

export type RecordedPhase = "think" | "record" | "saving" | "review" | "saved" | "failed";
/** Strict think time: the camera opens this long before recording starts by itself. */
const WARMUP_MS = 3000;
/** Video takes are capped at 1 Mbps (the exam uses 600 kbps) so the parts keep up on a phone's upload. */
const VIDEO_BITS_PER_SECOND = 1_000_000;
/** A take still uploading after a reload (C14): its playback is asked again every 3 s, for about 2 minutes. */
const PLAYBACK_POLL_MS = 3000;
const PLAYBACK_POLLS = 40;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const codeOf = (err: unknown) => (err && typeof err === "object" && typeof (err as { code?: unknown }).code === "string" ? (err as { code: string }).code : "");

export type RecordedProps = {
  mode: "answer" | "practice";
  activity: Pick<CandidateActivity, "id" | "type" | "prompt" | "note" | "thinkSeconds" | "flexibleThink" | "answerSeconds" | "maxTakes" | "textAlternativeEnabled">;
  locale: Locale;
  headingRef: React.Ref<HTMLHeadingElement>;
  sink: RecordingSink;
  /** Usable takes the server already holds (a reload cannot buy new ones). */
  takesUsed: number;
  /** The newest finished take after a reload: the screen opens on its review. */
  existingRef: string | null;
  /** That take's status (C14): one still UPLOADING says "Kaydediliyor" until it plays; INCOMPLETE says so. */
  existingStatus?: "UPLOADING" | "READY" | "INCOMPLETE" | null;
  /** Answers: the candidate's own take via media/play (MEDIA_NOT_READY while it is saving); the warm-up: its blob URL. */
  playbackSrc(result: RecordingResult): Promise<string | null>;
  onTake?(result: RecordingResult): void;
  /** "Bu cevabı kullan" (answers only); the warm-up has none. */
  onUse?(): void;
  /** Answers: the stage's close waits here for a take that is still finishing. */
  flushes?: FlushRegistry;
  onPhase?(phase: RecordedPhase): void;
  /** The stage's time is up: a running take stops (what is recorded is the answer), no new one starts. */
  timeUp: boolean;
  disabled: boolean;
  /** The runner shows its own filled button (a retry, a closed question): this screen shows none. */
  hidePrimary?: boolean;
  /** The warm-up's filled button on the review ("Hazırım, değerlendirmeye başla"), in the same bar as the retake. */
  reviewPrimary?: React.ReactNode;
  /** HIRING-UX A7: the written alternative, rendered and sent by the runner. */
  alternative?: { node: React.ReactNode; ready: boolean; using: boolean; onChoose(using: boolean): void; send(): void } | null;
};

/**
 * HIRING-UX 6.6: think with the camera off (flexible: recording does not start
 * by itself), record with a small self view, a calm "Kayıtta" dot, the answer
 * time and the upload under it, then review (use it or record again) while
 * takes are left. Retakes skip the think time. Nothing in this file reaches
 * the network: the sink does (take.ts runs one take; leaving the question
 * stops a take and lets it finish, a page that goes away keeps what landed,
 * a finish that fails is tried again on "Tekrar dene").
 */
export function RecordedActivity(props: RecordedProps) {
  const { mode, activity, locale, headingRef, sink, flushes, timeUp, disabled, hidePrimary = false, alternative } = props;
  const t = useT("hiringMedia");
  const audioOnly = activity.type === "AUDIO";
  const answerMs = (activity.answerSeconds ?? 120) * 1000;
  const unlimited = !Number.isFinite(activity.maxTakes);
  const [phase, setPhaseState] = useState<RecordedPhase>(props.existingRef ? "review" : "think");
  const [writing, setWriting] = useState(!!alternative?.using && !props.existingRef);
  const [used, setUsed] = useState(props.takesUsed);
  const usedRef = useRef(props.takesUsed);
  const [thinkLeft, setThinkLeft] = useState(activity.thinkSeconds * 1000);
  const [recordLeft, setRecordLeft] = useState(answerMs);
  const [progress, setProgress] = useState<TakeProgress>({ ratio: 0, stalled: false });
  const [src, setSrc] = useState<string | null>(null);
  const [playbackWaiting, setPlaybackWaiting] = useState(props.existingStatus === "UPLOADING");
  const [note, setNote] = useState<string | null>(null);
  const [incomplete, setIncomplete] = useState(props.existingStatus === "INCOMPLETE");
  const [canRetryFinish, setCanRetryFinish] = useState(false);
  const [notes, setNotes] = useState("");
  const [opening, setOpening] = useState(false);
  const self = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pending = useRef<Promise<MediaStream | null> | null>(null);
  const take = useRef<Take | null>(null);
  const beginning = useRef(false);
  const mounted = useRef(false);
  // The runner's callbacks change with its state; a take that settles later calls the latest ones.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const left = retakesLeft(activity.maxTakes, used);

  const setPhase = useCallback((next: RecordedPhase) => {
    setPhaseState(next);
    latest.current.onPhase?.(next);
  }, []);

  const closeStream = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  /** One stream at a time, however often it is asked for (strict warm-up, start, retake). */
  const openStream = useCallback(() => {
    if (stream.current?.getTracks().some((track) => track.readyState === "live")) return Promise.resolve(stream.current);
    pending.current ??= (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia(
          audioOnly ? { audio: true } : { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true } },
        );
        // A prompt answered after the question was left: the camera goes off at once.
        if (!mounted.current) {
          media.getTracks().forEach((track) => track.stop());
          return null;
        }
        stream.current = trackStream(media);
        return media;
      } catch {
        return null;
      } finally {
        pending.current = null;
      }
    })();
    return pending.current;
  }, [audioOnly]);

  /** Asks for the take's playback; a take still saving (MEDIA_NOT_READY) is asked again for a while. */
  const loadPlayback = useCallback(async (result: RecordingResult) => {
    for (let poll = 0; poll < PLAYBACK_POLLS && mounted.current; poll += 1) {
      try {
        const url = await latest.current.playbackSrc(result);
        if (!mounted.current) return;
        setPlaybackWaiting(false);
        setSrc(url);
        return;
      } catch (err) {
        // Not the candidate's take: nothing to play, the answer itself is unaffected.
        if (codeOf(err) === "UPLOAD_NOT_FOUND") return setPlaybackWaiting(false);
        if (!mounted.current) return;
        setPlaybackWaiting(true);
        await wait(PLAYBACK_POLL_MS);
      }
    }
  }, []);

  /** Where a take ends up: review or saved, the finish failed (try it again), or the server gave the take back. */
  const settle = useCallback(
    async (finished: Take, outcome: TakeOutcome) => {
      if (take.current !== finished) return;
      if (outcome.ok) {
        take.current = null;
        setCanRetryFinish(false);
        latest.current.onTake?.(outcome.result);
        setIncomplete(outcome.result.status === "INCOMPLETE");
        setNote(null);
        if (retakesLeft(activity.maxTakes, usedRef.current) > 0) {
          setPhase("review");
          await loadPlayback(outcome.result);
        } else {
          // HIRING-UX 6.6: no retake left, no review: "Kaydedildi." and on to the next question.
          setPhase("saved");
          if (mode === "answer")
            window.setTimeout(() => {
              // Not when the stage's time is up or the runner is busy: the stage's own close carries the take then.
              const now = latest.current;
              if (mounted.current && !now.disabled && !now.timeUp) now.onUse?.();
            }, 1000);
        }
        return;
      }
      if (finishFailure(outcome.error) === "retry") {
        // The take waits in this tab and on the server: "Tekrar dene" finishes it again.
        setCanRetryFinish(true);
        setNote(t("finishFailed"));
      } else {
        // NO_PARTS: nothing landed, the server gave the take back.
        take.current = null;
        usedRef.current = Math.max(0, usedRef.current - 1);
        setUsed(usedRef.current);
        setCanRetryFinish(false);
        setNote(t("failed"));
      }
      setPhase("failed");
    },
    [activity.maxTakes, loadPlayback, mode, setPhase, t],
  );

  const begin = useCallback(async () => {
    if (beginning.current || disabled || timeUp) return;
    beginning.current = true;
    setNote(null);
    setIncomplete(false);
    setSrc(null);
    setOpening(true);
    const media = await openStream();
    setOpening(false);
    if (!mounted.current) return;
    if (!media) {
      setNote(t("deviceError"));
      setCanRetryFinish(false);
      setPhase("failed");
      beginning.current = false;
      return;
    }
    try {
      const wanted = pickChunkedRecorderMime(audioOnly ? "audio" : "video");
      const mime = wanted || (audioOnly ? "audio/webm" : "video/webm");
      const options: MediaRecorderOptions | undefined = audioOnly
        ? wanted
          ? { mimeType: wanted }
          : undefined
        : { ...(wanted ? { mimeType: wanted } : {}), videoBitsPerSecond: VIDEO_BITS_PER_SECOND };
      const next = await Take.begin({
        sink,
        mime,
        chunkMs: CHUNK_MS,
        onProgress: setProgress,
        makeRecorder: () => new MediaRecorder(media, options) as unknown as RecorderLike,
        // Fix round 1 (Minor 4): the take itself listens for the page going away until it is finished,
        // also after this screen is gone (the question changed, or the stage closed past its wait).
        watchPageHide: (onHide) => {
          window.addEventListener("pagehide", onHide);
          return () => window.removeEventListener("pagehide", onHide);
        },
      });
      if (!mounted.current) {
        if (mode === "practice") next.discard();
        else next.stop();
        closeStream();
        return;
      }
      take.current = next;
      usedRef.current += 1;
      setUsed(usedRef.current);
      setRecordLeft(answerMs);
      setProgress({ ratio: 0, stalled: false });
      setPhase("record");
      void next.outcome.then((outcome) => settle(next, outcome));
    } catch (err) {
      const why = startFailure(err);
      // No takes left on the server: none is offered here either (the "Tekrar dene" would only be refused again).
      usedRef.current = usedAfterStartFailure(err, usedRef.current, activity.maxTakes);
      setUsed(usedRef.current);
      setNote(why === "noTakes" ? t("noTakes") : why === "server" ? (serverMessage(err) ?? t("failed")) : t("failed"));
      setCanRetryFinish(false);
      setPhase("failed");
      closeStream();
    } finally {
      beginning.current = false;
    }
  }, [disabled, timeUp, openStream, t, audioOnly, sink, mode, closeStream, answerMs, setPhase, settle, activity.maxTakes]);

  // The strict think time's own start reads the latest state (time up, disabled), not the first render's.
  const beginRef = useRef(begin);
  useEffect(() => {
    beginRef.current = begin;
  });

  /** "Cevabı bitir", the answer clock, the stage clock: the recorder's last chunk, then the finish. */
  const stopTake = useCallback(() => {
    const current = take.current;
    if (!current?.recording) return;
    current.stop();
    setPhase("saving");
    closeStream();
  }, [closeStream, setPhase]);

  // A take opened before a reload: review it (one still uploading says "Kaydediliyor" and is asked again).
  const existing = props.existingRef;
  useEffect(() => {
    if (!existing) return;
    const id = window.setTimeout(() => void loadPlayback({ status: "READY", ref: existing }), 0);
    return () => window.clearTimeout(id);
  }, [existing, loadPlayback]);

  // Think time, camera off. Strict mode warms the camera up 3 s before the end and starts by itself.
  useEffect(() => {
    if (phase !== "think" || writing || activity.thinkSeconds === 0) return;
    const endsAt = Date.now() + activity.thinkSeconds * 1000;
    const id = window.setInterval(() => {
      const leftMs = Math.max(0, endsAt - Date.now());
      setThinkLeft(leftMs);
      if (!activity.flexibleThink && leftMs <= WARMUP_MS) void openStream();
      if (leftMs === 0) {
        window.clearInterval(id);
        if (!activity.flexibleThink) void beginRef.current();
      }
    }, 250);
    return () => window.clearInterval(id);
    // The think time runs once per visit of the think screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, writing, activity.thinkSeconds, activity.flexibleThink]);

  // The answer clock; at its end the recording stops by itself. A recorder that stopped on its own (an error) is saving.
  useEffect(() => {
    if (phase !== "record") return;
    const endsAt = Date.now() + answerMs;
    const id = window.setInterval(() => {
      if (take.current && !take.current.recording) {
        window.clearInterval(id);
        setPhase("saving");
        closeStream();
        return;
      }
      const leftMs = Math.max(0, endsAt - Date.now());
      setRecordLeft(leftMs);
      if (leftMs === 0) {
        window.clearInterval(id);
        stopTake();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, answerMs, stopTake, setPhase, closeStream]);

  // The stage's time ran out: what is recorded so far is the answer.
  useEffect(() => {
    if (timeUp && phase === "record") stopTake();
  }, [timeUp, phase, stopTake]);

  // The self view shows the stream the recorder records.
  useEffect(() => {
    if (phase !== "record" || audioOnly) return;
    if (self.current && stream.current && self.current.srcObject !== stream.current) {
      self.current.srcObject = stream.current;
      void self.current.play().catch(() => undefined);
    }
  }, [phase, audioOnly]);

  // The stage's close (next question, finish, time up) waits for a take that is recording or finishing.
  useEffect(() => {
    if (!flushes) return;
    return flushes.register(`${activity.id}:take`, async () => {
      const current = take.current;
      if (!current) return;
      current.stop();
      await current.outcome;
    });
  }, [flushes, activity.id]);

  // Leaving the question stops a take (an answer finishes in the background; the warm-up's is
  // dropped) and closes the camera. A page that goes away mid-take is the take's own listener (take.ts).
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const current = take.current;
      if (current) {
        if (mode === "practice") current.discard();
        else current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, [mode]);

  function retake() {
    setSrc(null);
    setNote(null);
    void begin();
  }

  function tryAgain() {
    const current = take.current;
    if (canRetryFinish && current) {
      setNote(null);
      setPhase("saving");
      void current.retry().then((outcome) => settle(current, outcome));
      return;
    }
    retake();
  }

  if (writing && alternative) {
    return (
      <div className="space-y-4">
        {alternative.node}
        <p className="text-[14px] leading-[22px] text-muted">{t("writingNote")}</p>
        <ActionBar>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {hidePrimary ? null : (
              <Button
                id="send-written"
                variant="primary"
                size="lg"
                className="w-full text-[16px] sm:w-auto"
                disabled={disabled || !alternative.ready}
                disabledReason={!alternative.ready ? t("writtenRequired") : undefined}
                onClick={alternative.send}
              >
                {disabled && alternative.ready ? t("saving") : t("sendWritten")}
              </Button>
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setWriting(false);
                alternative.onChoose(false);
              }}
              className="min-h-11 text-[16px] text-ink underline decoration-underline underline-offset-4 disabled:opacity-60"
            >
              {t("tryRecording")}
            </button>
          </div>
          {!alternative.ready && !hidePrimary ? (
            <DisabledReason id="send-written-why" className="mt-2 text-[14px]">
              {t("writtenRequired")}
            </DisabledReason>
          ) : null}
        </ActionBar>
      </div>
    );
  }

  const takesLine = unlimited ? null : activity.maxTakes === 1 ? t("singleTake") : t("takesLeft", { count: left });
  const writeLink =
    mode === "answer" && alternative && (phase === "think" || (phase === "failed" && !canRetryFinish)) ? (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setWriting(true);
          alternative.onChoose(true);
        }}
        className="mt-4 block min-h-11 text-left text-[16px] text-ink underline decoration-underline underline-offset-4 disabled:opacity-60"
      >
        {audioOnly ? t("useWritingAudio") : t("useWriting")}
      </button>
    ) : null;
  // C15: every reason a button here waits is said next to it.
  const startWhy = timeUp ? t("timeUpReason") : null;
  const retakeWhy = timeUp ? t("timeUpReason") : left === 0 ? t("takesLeft", { count: 0 }) : null;
  const showRetake = unlimited || activity.maxTakes > 1;
  const reviewTitle = audioOnly ? t("reviewTitleAudio") : t("reviewTitle");
  // HIRING-UX 8.7: the recording state is spoken when it changes, never the clock or the upload's percent.
  const announce =
    phase === "record"
      ? progress.stalled && mode === "answer"
        ? t("uploadStalled")
        : audioOnly
          ? t("recordingAudio")
          : t("recording")
      : phase === "saving"
        ? t("saving")
        : phase === "review"
          ? reviewTitle
          : phase === "saved"
            ? t("saved")
            : "";

  return (
    <div className="space-y-6">
      <ActivityHeader activity={activity} locale={locale} kicker={`${audioOnly ? t("audioKicker") : t("videoKicker")}${takesLine ? ` · ${takesLine}` : ""}`} headingRef={headingRef} large />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>

      {phase === "think" ? (
        <div className="space-y-4">
          {activity.thinkSeconds > 0 ? (
            <div>
              <p className="text-[14px] text-muted">{t("thinkLabel")}</p>
              <p className="tnum text-[32px] leading-9 font-semibold text-accent">{formatCountdown(thinkLeft)}</p>
              <p className="mt-1 text-[16px] text-ink-2">
                {thinkLeft === 0 && activity.flexibleThink ? t("thinkOverFlexible") : !activity.flexibleThink ? t("thinkStrictNote") : audioOnly ? t("micOff") : t("cameraOff")}
              </p>
            </div>
          ) : null}
          <label className="block">
            <span className="text-[14px] font-medium text-ink">{t("notes")}</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 text-[16px] md:text-[16px]" />
            <span className="mt-1 block text-[14px] text-muted">{t("notesHint")}</span>
          </label>
          {hidePrimary ? null : (
            <ActionBar>
              <Button
                id="record-start"
                variant="primary"
                size="lg"
                className="w-full text-[16px] sm:w-auto"
                disabled={disabled || opening || timeUp}
                disabledReason={startWhy ?? undefined}
                onClick={() => void begin()}
              >
                {opening ? (audioOnly ? t("startingMic") : t("starting")) : t("start")}
              </Button>
              {startWhy ? (
                <DisabledReason id="record-start-why" className="mt-2 text-[14px]">
                  {startWhy}
                </DisabledReason>
              ) : null}
            </ActionBar>
          )}
        </div>
      ) : null}

      {phase === "record" || phase === "saving" ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="flex items-center gap-2 text-[16px] font-medium text-ink">
              <span className="size-2.5 rounded-full bg-ink motion-safe:animate-[rec-pulse_1.6s_ease-in-out_infinite]" aria-hidden />
              {phase === "saving" ? t("saving") : audioOnly ? t("recordingAudio") : t("recording")}
            </p>
            <p className="text-right">
              <span className="block text-[13px] text-muted">{t("answerLeft")}</span>
              <span className="tnum block text-[32px] leading-9 font-semibold text-accent">{formatCountdown(recordLeft)}</span>
            </p>
          </div>
          {!audioOnly ? <video ref={self} muted playsInline className="ml-auto aspect-[3/4] w-32 rounded-xl bg-canvas object-cover sm:aspect-video sm:w-56" /> : null}
          {mode === "answer" ? (
            <div>
              <div className="h-1 rounded-full bg-hairline" aria-hidden>
                <div className="h-1 rounded-full bg-ink-3 transition-[width] duration-300" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
              </div>
              <p className="tnum mt-1 text-[14px] text-muted">{progress.stalled ? t("uploadStalled") : t("uploading", { percent: Math.round(progress.ratio * 100) })}</p>
            </div>
          ) : null}
          {/* The warm-up keeps nothing, so it never says the answer is saved. */}
          <p className="text-[14px] text-muted">{mode === "answer" ? t("autoStop") : t("autoStopPractice")}</p>
          <ActionBar>
            <Button id="record-finish" variant="primary" size="lg" className="w-full text-[16px] sm:w-auto" disabled={phase === "saving"} onClick={stopTake}>
              {phase === "saving" ? t("saving") : t("finish")}
            </Button>
          </ActionBar>
        </div>
      ) : null}

      {phase === "review" ? (
        <div className="space-y-4">
          <h3 className="text-[18px] font-semibold text-ink">{reviewTitle}</h3>
          {src ? (
            audioOnly ? (
              <audio controls src={src} className="w-full" />
            ) : (
              <video controls playsInline src={src} className="aspect-[3/4] w-full max-w-[640px] rounded-xl bg-canvas sm:aspect-video" />
            )
          ) : playbackWaiting ? (
            <p role="status" className="text-[16px] text-ink-2">
              {t("savingPlayback")}
            </p>
          ) : null}
          {incomplete ? <p className="text-[16px] text-ink">{t("incomplete")}</p> : null}
          <ActionBar>
            <div className="flex flex-wrap items-center gap-3">
              {mode === "answer" && !hidePrimary ? (
                <Button id="record-use" variant="primary" size="lg" className="w-full text-[16px] sm:w-auto" disabled={disabled} onClick={() => latest.current.onUse?.()}>
                  {disabled && !timeUp ? t("saving") : t("use")}
                </Button>
              ) : null}
              {props.reviewPrimary}
              {showRetake ? (
                <Button id="record-retake" size="lg" className="w-full text-[16px] sm:w-auto" disabled={disabled || retakeWhy !== null} disabledReason={retakeWhy ?? undefined} onClick={retake}>
                  {unlimited || left === 0 ? t("retakeFree") : t("retake", { count: left })}
                </Button>
              ) : null}
            </div>
            {showRetake && retakeWhy ? (
              <DisabledReason id="record-retake-why" className="mt-2 text-[14px]">
                {retakeWhy}
              </DisabledReason>
            ) : null}
          </ActionBar>
        </div>
      ) : null}

      {phase === "saved" ? (
        <div className="space-y-3">
          <p role="status" className="text-[18px] font-medium text-ink">
            {t("saved")}
          </p>
          {incomplete ? <p className="text-[16px] text-ink">{t("incomplete")}</p> : null}
          {/* The next question opens by itself after a second; should that close fail, the runner says so and this sends it again. */}
          {mode === "answer" && !hidePrimary ? (
            <ActionBar>
              <Button id="record-use" variant="primary" size="lg" className="w-full text-[16px] sm:w-auto" disabled={disabled} onClick={() => latest.current.onUse?.()}>
                {disabled && !timeUp ? t("saving") : t("use")}
              </Button>
            </ActionBar>
          ) : null}
        </div>
      ) : null}

      {phase === "failed" ? (
        <div className="space-y-3">
          <p role="alert" className="text-[16px] text-ink">
            {note ?? t("failed")}
          </p>
          {!hidePrimary && canTryAgain({ canRetryFinish, maxTakes: activity.maxTakes, used }) ? (
            <ActionBar>
              <Button
                id="record-again"
                variant="primary"
                size="lg"
                className="w-full text-[16px] sm:w-auto"
                disabled={disabled || (!canRetryFinish && timeUp)}
                disabledReason={!canRetryFinish && timeUp ? t("timeUpReason") : undefined}
                onClick={tryAgain}
              >
                {t("tryAgain")}
              </Button>
              {!canRetryFinish && timeUp ? (
                <DisabledReason id="record-again-why" className="mt-2 text-[14px]">
                  {t("timeUpReason")}
                </DisabledReason>
              ) : null}
            </ActionBar>
          ) : !hidePrimary && mode === "answer" ? (
            // Every take is used (TAKES_EXHAUSTED): the server holds them, so the answer can still be used.
            <ActionBar>
              <Button id="record-use" variant="primary" size="lg" className="w-full text-[16px] sm:w-auto" disabled={disabled} onClick={() => latest.current.onUse?.()}>
                {disabled && !timeUp ? t("saving") : t("use")}
              </Button>
            </ActionBar>
          ) : null}
        </div>
      ) : null}

      {writeLink}
    </div>
  );
}
