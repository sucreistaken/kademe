"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, Check, Mic, NotebookPen, Video } from "lucide-react";
import { Disclosure } from "@/components/visual/disclosure";
import type { FooterAction } from "@/components/visual/footer-action";
import { MediaStage } from "@/components/visual/media-stage";
import { lastSeconds } from "@/components/visual/ring";
import { StepFooter } from "@/components/visual/step-footer";
import { TimerRing } from "@/components/visual/timer-ring";
import { Textarea } from "@/components/ui/textarea";
import { holdUntilSettled, useCaptureHold } from "@/lib/client/capture-hold";
import type { FlushRegistry } from "@/lib/client/flush-registry";
import { CHUNK_MS, pickChunkedRecorderMime } from "@/lib/client/recorder";
import { formatCountdown } from "@/lib/timer";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";
import { ActivityHeader } from "./activity-header";
import { peakLevel } from "./device-rows";
import { recordedFooterState, refocusAfterTimeUp } from "./recorded-footer";
import type { RecordingResult, RecordingSink, TakeProgress } from "./recording-sink";
import { serverMessage } from "./server-message";
import { trackStream } from "./streams";
import { afterExhausted, canTryAgain, finishFailure, retakesLeft, startFailure, Take, takeHoldsCapture, usedAfterStartFailure, type RecorderLike, type TakeOutcome } from "./take";

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
  /** C4: the runner holds the screen for a reason of its own (the 8 second send strip): the filled button waits with it instead of showing a spinner. */
  holdReason?: string | null;
  /** The warm-up's filled button on the review ("Hazırım, değerlendirmeye başla"), next to "Tekrar çek". */
  reviewPrimary?: FooterAction;
  /** The warm-up's way out on the left of the footer ("Isınmayı atla"), and its journey. */
  footerBack?: { label: string; href: string } | null;
  journey?: { steps: number; current: number; label: string } | null;
  /** The chip above the question; the warm-up says "Isınma · kimse görmez", answers name the kind of question. */
  kicker?: string;
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
  const [exhausted, setExhausted] = useState(false);
  const [level, setLevel] = useState(0);
  // The newest take this screen knows: the one the page opened on, or the last one finished here (Task 14 carry).
  const lastRef = useRef<string | null>(props.existingRef);
  // From the think time until the take is saved the page is held: the frame's language link (a full
  // page load) would cut the take, and the take would still count (Task 5 fix round 2).
  const holdId = useId();
  useCaptureHold(`take:${holdId}`, takeHoldsCapture(phase, writing));
  const takeSeq = useRef(0);
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
        lastRef.current = outcome.result.ref ?? lastRef.current;
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
      // Task 5 carry: the page stays held until this take's outcome settles, also after this question
      // is left (the close waited past its limit): the language link would cut a take still finishing,
      // like it would a file upload.
      takeSeq.current += 1;
      holdUntilSettled(`take-outcome:${holdId}:${takeSeq.current}`, next.outcome);
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
      setCanRetryFinish(false);
      closeStream();
      if (why === "noTakes") {
        // Task 14 carry: "Bu cevabı kullan" shows which take it uses, when this screen knows it.
        const next = afterExhausted({ lastRef: lastRef.current });
        setExhausted(true);
        if (next.phase === "review") {
          setNote(null);
          setPhase("review");
          void loadPlayback({ status: "READY", ref: next.ref });
          return;
        }
        setNote(t("noTakes"));
        setPhase("failed");
        return;
      }
      setNote(why === "server" ? (serverMessage(err) ?? t("failed")) : t("failed"));
      setPhase("failed");
    } finally {
      beginning.current = false;
    }
  }, [disabled, timeUp, openStream, t, audioOnly, sink, mode, closeStream, answerMs, setPhase, settle, activity.maxTakes, loadPlayback, holdId]);

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

  // 3.8: an audio answer shows the real level of the microphone it records (no animation of its own).
  useEffect(() => {
    if (phase !== "record" || !audioOnly || !stream.current) return;
    let ctx: AudioContext | null = null;
    let id: number | null = null;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream.current).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      id = window.setInterval(() => {
        analyser.getByteTimeDomainData(data);
        // C16: the same peak the device check reads.
        setLevel(Math.round(peakLevel(data) * 20) / 20);
      }, 100);
    } catch {
      // No level in this browser: the "Sesin kaydediliyor" line still says it records.
    }
    return () => {
      if (id !== null) window.clearInterval(id);
      void ctx?.close().catch(() => undefined);
      setLevel(0);
    };
  }, [phase, audioOnly]);

  // Task 4 carry 6: time up turns a focused primary into a waiting one (or takes a retake away); focus goes to the heading, not a disabled button.
  const wasTimeUp = useRef(timeUp);
  useEffect(() => {
    const active = document.activeElement;
    const kind = !active || active === document.body ? "body" : active instanceof HTMLButtonElement && active.disabled ? "disabled-control" : "other";
    if (refocusAfterTimeUp({ timeUp, wasTimeUp: wasTimeUp.current, active: kind })) document.getElementById(`prompt-${activity.id}`)?.focus();
    wasTimeUp.current = timeUp;
  }, [timeUp, activity.id]);

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

  // C4: what every action here says about waiting and working comes from one rule (recorded-footer.ts).
  const footerState = recordedFooterState({ timeUp, disabled, timeUpReason: t("timeUpReason"), holdReason: props.holdReason });

  if (writing && alternative) {
    return (
      <div className="mx-auto max-w-[760px] space-y-4 pt-8">
        {alternative.node}
        <p className="text-[14px] leading-[22px] text-muted">{t("writingNote")}</p>
        <RecordedFooter
          hidden={hidePrimary}
          journey={props.journey}
          back={{
            label: t("tryRecording"),
            onClick: () => {
              setWriting(false);
              alternative.onChoose(false);
            },
          }}
          primary={{
            kind: "button",
            id: "send-written",
            label: t("sendWritten"),
            busy: alternative.ready && footerState.busy,
            busyLabel: t("saving"),
            waitReason: footerState.waitReason ?? (!alternative.ready ? t("writtenRequired") : null),
            onClick: alternative.send,
          }}
        />
      </div>
    );
  }

  const takesLine = unlimited ? null : activity.maxTakes === 1 ? t("singleTake") : t("takesLeft", { count: left });
  const retakeOpen = (unlimited || activity.maxTakes > 1) && !timeUp && left > 0 && !exhausted;
  const reviewTitle = audioOnly ? t("reviewTitleAudio") : t("reviewTitle");
  const useAction: FooterAction = {
    kind: "button",
    id: "record-use",
    label: t("use"),
    busy: footerState.busy,
    busyLabel: t("saving"),
    waitReason: footerState.waitReason,
    onClick: () => latest.current.onUse?.(),
  };
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
  const ringLabel = (key: "ringThink" | "ringAnswer", ms: number) => t(key, { time: formatCountdown(ms) });

  const question = (
    <>
      <ActivityHeader
        activity={activity}
        locale={locale}
        kicker={`${props.kicker ?? (audioOnly ? t("audioKicker") : t("videoKicker"))}${takesLine ? ` · ${takesLine}` : ""}`}
        icon={audioOnly ? Mic : Video}
        headingRef={headingRef}
      />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
      {phase === "think" && activity.thinkSeconds > 0 ? (
        <div className="flex items-center gap-5">
          <TimerRing
            remainingMs={thinkLeft}
            totalMs={activity.thinkSeconds * 1000}
            label={ringLabel("ringThink", thinkLeft)}
            caption={lastSeconds(thinkLeft) ? t("lastSeconds") : t("thinkCaption")}
          />
          <p className="text-[16px] leading-[26px] text-ink-2">{thinkLeft === 0 && activity.flexibleThink ? t("thinkOverFlexible") : !activity.flexibleThink ? t("thinkStrictNote") : t("thinkLabel")}</p>
        </div>
      ) : null}
      {phase === "record" || phase === "saving" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-5">
            <TimerRing
              remainingMs={recordLeft}
              totalMs={answerMs}
              label={ringLabel("ringAnswer", recordLeft)}
              caption={lastSeconds(recordLeft) ? t("lastSeconds") : t("answerCaption")}
              announce={phase === "record"}
            />
            <p className="text-[16px] leading-[26px] text-ink-2">{mode === "answer" ? t("autoStop") : t("autoStopPractice")}</p>
          </div>
          {mode === "answer" ? (
            <div>
              <div className="h-1 rounded-full bg-hairline" aria-hidden>
                <div className="h-1 rounded-full bg-ink-3 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
              </div>
              {/* 3.8: the upload says something only when it is slow. */}
              {progress.stalled ? <p className="mt-1 text-[14px] text-ink">{t("uploadStalled")}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {phase === "review" ? (
        <div className="space-y-2">
          <h3 className="text-[18px] font-semibold text-ink">{reviewTitle}</h3>
          {exhausted ? <p className="text-[16px] text-ink">{t("useLastTake")}</p> : null}
          {incomplete ? <p className="text-[16px] text-ink">{t("incomplete")}</p> : null}
          {!retakeOpen && takesLine && !unlimited ? <p className="text-[14px] text-muted">{timeUp ? t("timeUpReason") : t("takesLeft", { count: 0 })}</p> : null}
        </div>
      ) : null}
      {phase === "saved" ? (
        <div className="space-y-2">
          <p role="status" className="flex items-center gap-2 text-[18px] font-medium text-ink">
            <Check className="size-5" strokeWidth={2} aria-hidden />
            {t("saved")}
          </p>
          {incomplete ? <p className="text-[16px] text-ink">{t("incomplete")}</p> : null}
        </div>
      ) : null}
      {phase === "failed" ? (
        <div className="space-y-2">
          <p role="alert" className="text-[16px] text-ink">
            {note ?? t("failed")}
          </p>
          {exhausted ? <p className="text-[16px] text-ink-2">{t("exhaustedUse")}</p> : null}
        </div>
      ) : null}
      {phase === "think" ? (
        <Disclosure label={t("notesShort")} icon={NotebookPen}>
          <label className="block">
            <span className="sr-only">{t("notes")}</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="text-[16px] md:text-[16px]" />
            <span className="mt-1 block text-[14px] text-muted">{t("notesHint")}</span>
          </label>
        </Disclosure>
      ) : null}
      {mode === "answer" && alternative && (phase === "think" || (phase === "failed" && !canRetryFinish)) ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setWriting(true);
            alternative.onChoose(true);
          }}
          className="block min-h-11 text-left text-[16px] text-ink underline decoration-underline underline-offset-4 disabled:opacity-60"
        >
          {audioOnly ? t("useWritingAudio") : t("useWriting")}
        </button>
      ) : null}
    </>
  );

  const placeholder = (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-[14px] text-muted">
      {audioOnly ? <Mic className="size-8" strokeWidth={1.5} aria-hidden /> : <Camera className="size-8" strokeWidth={1.5} aria-hidden />}
      {audioOnly ? t("micLater") : t("cameraLater")}
    </span>
  );
  const preview =
    phase === "record" || phase === "saving" ? (
      audioOnly ? (
        <span className="absolute inset-0 flex items-end justify-center gap-2 pb-[30%]" aria-hidden>
          {[0.6, 0.85, 1, 0.85, 0.6].map((k, i) => (
            <span key={i} className="w-3 rounded-full bg-ink-3" style={{ height: `${Math.max(8, Math.round(level * k * 160))}px` }} />
          ))}
        </span>
      ) : (
        <>
          <video ref={self} muted playsInline className="size-full object-cover" />
          <span className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1 text-[13px] text-ink">
            <span className="size-2.5 rounded-full bg-ink motion-safe:animate-[rec-pulse_1.6s_ease-in-out_infinite]" aria-hidden />
            {phase === "saving" ? t("saving") : t("recording")}
          </span>
        </>
      )
    ) : phase === "review" && src ? (
      audioOnly ? (
        <span className="absolute inset-0 flex items-center px-6">
          <audio controls src={src} className="w-full" />
        </span>
      ) : (
        <video controls playsInline src={src} className="size-full bg-canvas object-cover" />
      )
    ) : phase === "review" && playbackWaiting ? (
      <span role="status" className="absolute inset-0 grid place-items-center px-6 text-center text-[16px] text-ink-2">
        {t("savingPlayback")}
      </span>
    ) : (
      placeholder
    );

  const primary: FooterAction | null =
    phase === "think"
      ? {
          kind: "button",
          id: "record-start",
          label: t("start"),
          busy: opening || footerState.busy,
          busyLabel: opening ? (audioOnly ? t("startingMic") : t("starting")) : t("saving"),
          waitReason: footerState.waitReason,
          onClick: () => void begin(),
        }
      : phase === "record" || phase === "saving"
        ? // The take is the thing that works here: time up stops it by itself, so no time-up reason sits on this button.
          { kind: "button", id: "record-finish", label: t("finish"), busy: phase === "saving", busyLabel: t("saving"), onClick: stopTake }
        : phase === "review"
          ? mode === "answer"
            ? useAction
            : (props.reviewPrimary ?? null)
          : phase === "saved"
            ? mode === "answer"
              ? useAction
              : null
            : canTryAgain({ canRetryFinish, maxTakes: activity.maxTakes, used }) && !exhausted
              ? { kind: "button", id: "record-again", label: t("tryAgain"), busy: footerState.busy, busyLabel: t("saving"), waitReason: footerState.waitReason, onClick: tryAgain }
              : mode === "answer"
                ? useAction
                : null;
  // A retake never offers itself once time is up (the screen says why in the review); while the runner works it is not clickable.
  const retakeState = recordedFooterState({ timeUp, disabled, timeUpReason: t("timeUpReason") });
  const secondary: FooterAction | null =
    phase === "review" && retakeOpen
      ? { kind: "button", id: "record-retake", label: unlimited ? t("retakeFree") : t("retake", { count: left }), busy: retakeState.busy, busyLabel: t("saving"), onClick: retake }
      : null;

  return (
    <>
      <MediaStage question={question} preview={preview} />
      <RecordedFooter hidden={hidePrimary} journey={props.journey} back={props.footerBack} primary={primary} secondary={secondary} />
    </>
  );
}

/** The bar under the screen; none when the runner shows its own filled button (a retry, a closed question), so two fixed bars never stack. */
function RecordedFooter({
  hidden,
  journey,
  back,
  primary,
  secondary,
}: {
  hidden: boolean;
  journey?: { steps: number; current: number; label: string } | null;
  back?: { label: string; onClick?: () => void; href?: string } | null;
  primary: FooterAction | null;
  secondary?: FooterAction | null;
}) {
  if (hidden) return null;
  return <StepFooter journey={journey ?? null} back={back ?? null} primary={primary} secondary={secondary ?? null} />;
}
