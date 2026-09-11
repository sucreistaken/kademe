"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiBeacon } from "@/lib/client/api";
import {
  CHUNK_MS,
  ChunkedUploader,
  pickRecorderMime,
  type UploaderStatus,
} from "@/lib/client/recorder";
import { formatCountdown } from "@/lib/timer";
import type { StageActivity } from "@/lib/candidate-flow";
import {
  ActivityKicker,
  useStageSession,
} from "@/components/candidate/activities/shared";
import { TextActivity } from "@/components/candidate/activities/TextActivity";
import { useT } from "@/i18n/candidate-client";

/**
 * Artboard A10, in both of its states: think time on a quiet centred screen,
 * then the recording screen with the countdown beside the question.
 *
 * Think time runs first with the camera off, then recording starts and uploads
 * at the same time. Nothing waits for the end: by the time the candidate stops
 * talking, almost everything is already in storage. That is what makes a three
 * minute answer survive on a phone, and why a dropped connection costs seconds
 * rather than the whole answer.
 */

type Phase = "THINKING" | "RECORDING" | "UPLOADING" | "DONE" | "FAILED";

/**
 * How long before the end of think time the camera opens.
 *
 * Long enough that recording starts on the second the timer hits zero, short
 * enough that "the camera is off" stays true for effectively all of the think
 * time. The screen switches its own wording at the same moment.
 */
const CAMERA_WARMUP_MS = 3000;

export function MediaActivity({
  token,
  activity,
  onAnswered,
  onStream,
  onRecording,
  onThinking,
}: {
  token: string;
  activity: StageActivity;
  onAnswered: (answered: boolean) => void;
  onStream?: (stream: MediaStream | null) => void;
  onRecording?: (recording: boolean) => void;
  /** Think time owns the whole screen, so the shell hides itself for it. */
  onThinking?: (thinking: boolean) => void;
}) {
  const t = useT("media");
  const { position: stagePosition } = useStageSession();
  const isAudio = activity.type === "AUDIO";
  const answerSeconds = activity.answerSeconds ?? 180;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const uploaderRef = useRef<ChunkedUploader | null>(null);
  const startedAtRef = useRef<number>(0);
  /**
   * Set from the moment `beginRecording` is entered until the take is over.
   * The effect that calls it re-runs on every render that touches its inputs,
   * and `/media/init` takes long enough that several of those happen before
   * the phase flips to RECORDING; without this guard each one opened another
   * MediaRecorder and another media asset for the same answer.
   */
  const beginningRef = useRef(false);

  const [phase, setPhase] = useState<Phase>(
    activity.payload?.mediaAssetId ? "DONE" : "THINKING",
  );
  const [streamReady, setStreamReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [thinkLeft, setThinkLeft] = useState(activity.thinkSeconds * 1000);
  const [recordLeft, setRecordLeft] = useState(answerSeconds * 1000);
  const [elapsed, setElapsed] = useState(0);
  const [upload, setUpload] = useState<UploaderStatus>({
    uploadedBytes: 0,
    queuedBytes: 0,
    stalled: false,
  });
  const [error, setError] = useState<string | null>(null);
  // Seeded from the server's count of kept recordings, so a reload cannot
  // hand the candidate a fresh set of takes. The server enforces it too.
  const [takes, setTakes] = useState(activity.takeCount);
  const [useText, setUseText] = useState(!!activity.payload?.usedTextAlternative);
  const [startRequested, setStartRequested] = useState(false);
  /**
   * A retake has no think time: the candidate has already thought. This is an
   * explicit flag rather than "thinkLeft is zero" because the countdown effect
   * derives its end from `thinkSeconds` and would otherwise start the full
   * think time over again 200 ms after the retake began.
   */
  const [skipThink, setSkipThink] = useState(false);
  /* The server said no more takes. Offering "try again" would only repeat it. */
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    onRecording?.(phase === "RECORDING");
  }, [phase, onRecording]);

  useEffect(() => {
    // An activity with no think time passes through this phase in one frame,
    // and hiding the shell for that frame would only make the header blink.
    const thinking = phase === "THINKING" && activity.thinkSeconds > 0 && !skipThink;
    onThinking?.(thinking);
    return () => onThinking?.(false);
  }, [phase, activity.thinkSeconds, skipThink, onThinking]);

  /*
   * The camera is closed while the candidate is thinking, and the screen says
   * so. It used to open the moment the activity mounted, which lit the camera
   * light on the candidate's laptop under a line of text claiming the camera
   * was off. On a product built around recorded answers that is not a wording
   * slip, it is the one thing a candidate cannot be wrong about.
   *
   * It warms up three seconds before the timer runs out so that recording still
   * starts on time. Permission was already granted during the device check, so
   * this is a device open, not a prompt.
   */
  // Once the take is over (DONE, FAILED) nothing here wants the camera,
  // whatever got it opened during think time. `startRequested` used to count
  // on its own, which kept the light on after a "start now" answer was saved.
  const thinkOver = skipThink || startRequested || thinkLeft <= 0;
  const cameraWanted =
    !useText &&
    (phase === "RECORDING" ||
      phase === "UPLOADING" ||
      (phase === "THINKING" && (thinkOver || thinkLeft <= CAMERA_WARMUP_MS)));

  useEffect(() => {
    if (!cameraWanted) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          isAudio
            ? { audio: true }
            : {
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: { echoCancellation: true, noiseSuppression: true },
              },
        );
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        onStream?.(stream);
        if (videoRef.current && !isAudio) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
        setStreamReady(true);
      } catch {
        if (!cancelled) setMediaError(isAudio ? t("micError") : t("cameraError"));
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStreamReady(false);
      onStream?.(null);
    };
    // `phase` is deliberately absent: it changes from THINKING to RECORDING
    // while the recorder is running off this exact stream, and tearing the
    // tracks down underneath it would end the recording it just started.
  }, [cameraWanted, activity.index, isAudio, onStream, t]);

  /*
   * The camera opens during think time, and the think screen has no <video>
   * element: it is a countdown and the question, nothing else. So when the
   * stream arrives above there is nothing to attach it to, and the element
   * that appears with the recording screen would stay black for the whole
   * answer while MediaRecorder happily records off the same stream. The
   * candidate cannot see themselves, the manager can. Attach on every phase
   * change instead, whenever both the element and the stream exist.
   */
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || isAudio) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  }, [phase, streamReady, isAudio]);

  /* ---- think countdown, camera off ---- */
  useEffect(() => {
    if (phase !== "THINKING" || activity.thinkSeconds === 0 || skipThink) return;
    const endsAt = Date.now() + activity.thinkSeconds * 1000;
    const timer = window.setInterval(() => {
      setThinkLeft(Math.max(0, endsAt - Date.now()));
    }, 200);
    return () => window.clearInterval(timer);
  }, [phase, activity.index, activity.thinkSeconds, skipThink]);

  /* Recording begins when think time is over AND the camera is actually ready,
   * or as soon as the camera opens for a candidate who said they were ready.
   * Keyed on the boolean, not on `thinkLeft` itself, so the ticking countdown
   * does not re-run it every 200 ms while `/media/init` is still in flight. */
  useEffect(() => {
    if (phase !== "THINKING" || !streamReady || !thinkOver) return;
    void beginRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, streamReady, thinkOver]);

  /* ---- recording countdown ---- */
  useEffect(() => {
    if (phase !== "RECORDING") return;
    const endsAt = startedAtRef.current + answerSeconds * 1000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, endsAt - Date.now());
      setRecordLeft(left);
      setElapsed(Date.now() - startedAtRef.current);
      if (left === 0) {
        window.clearInterval(timer);
        stopRecording();
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [phase, answerSeconds]);

  /* ---- a tab that dies mid recording still leaves a playable answer ---- */
  useEffect(() => {
    const onHide = () => {
      const uploader = uploaderRef.current;
      if (phase !== "RECORDING" || !uploader) return;
      apiBeacon(token, "/media/complete", {
        uploadRef: uploader.uploadRef,
        durationMs: Date.now() - startedAtRef.current,
        incomplete: true,
      });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [token, phase]);

  const finishRecording = useCallback(async () => {
    const uploader = uploaderRef.current;
    if (!uploader) return;
    try {
      const durationMs = Date.now() - startedAtRef.current;
      const res = await uploader.finish(durationMs);
      setPhase("DONE");
      setTakes((n) => n + 1);
      onAnswered(true);
      if (res.status === "INCOMPLETE") setError(t("incomplete"));
    } catch {
      setError(t("finishFailed"));
      setPhase("FAILED");
    }
  }, [onAnswered, t]);

  const beginRecording = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream || beginningRef.current) return;
    beginningRef.current = true;
    try {
      const mime = pickRecorderMime(isAudio ? "audio" : "video");
      const uploader = await ChunkedUploader.open(
        token,
        { stagePosition, activityIndex: activity.index },
        mime || (isAudio ? "audio/webm" : "video/webm"),
        setUpload,
      );
      uploaderRef.current = uploader;

      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        // Straight into the upload queue. Nothing accumulates here.
        if (e.data.size > 0) uploader.push(e.data);
      };
      recorder.onstop = () => void finishRecording();
      recorder.start(CHUNK_MS);

      startedAtRef.current = Date.now();
      setRecordLeft(answerSeconds * 1000);
      setElapsed(0);
      setPhase("RECORDING");
    } catch (err) {
      // The server's own words when it refused (no takes left, stale stage),
      // the generic line when the recorder itself would not start.
      const fromServer =
        err instanceof Error && "code" in err ? err.message : null;
      if (err instanceof Error && "code" in err && err.code === "TAKES_EXHAUSTED") {
        setExhausted(true);
      }
      setError(fromServer ?? t("startFailed"));
      setPhase("FAILED");
    }
  }, [token, stagePosition, activity.index, isAudio, answerSeconds, finishRecording, t]);

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      setPhase("UPLOADING");
      recorder.stop();
    }
  }

  /**
   * Back to the start of a take, without the think time. Also the way out of
   * FAILED: nothing was saved there, so it costs no take, and the server counts
   * only finished recordings anyway.
   */
  function retake() {
    uploaderRef.current = null;
    recorderRef.current = null;
    beginningRef.current = false;
    setStartRequested(false);
    setError(null);
    setUpload({ uploadedBytes: 0, queuedBytes: 0, stalled: false });
    setThinkLeft(0);
    setSkipThink(true);
    setPhase("THINKING");
  }

  /*
   * The written alternative, when the manager enabled one. A candidate who
   * cannot speak or hear, or whose camera will not open, still answers the same
   * question rather than being dropped out of the process.
   */
  if (useText) {
    return (
      <div>
        <TextActivity
          token={token}
          activity={activity}
          onAnswered={onAnswered}
          asAlternative
          kicker={
            isAudio
              ? t("alternativeKickerAudio")
              : t("alternativeKickerVideo")
          }
        />
        <p className="mt-4 text-[12.5px] leading-[1.6] text-muted">
          {t("alternativeNote")}{" "}
          <button
            type="button"
            onClick={() => setUseText(false)}
            className="text-ink-2 underline decoration-line-strong underline-offset-2"
          >
            {isAudio ? t("tryAudio") : t("tryVideo")}
          </button>
        </p>
      </div>
    );
  }

  /* ---- think time: artboard A10, second board ---- */
  if (phase === "THINKING") {
    return (
      <div className="mx-auto w-full max-w-[600px] pt-4 text-center">
        <ActivityKicker>
          {t("thinkKicker", { number: activity.index + 1 })}
        </ActivityKicker>
        <div className="tnum mb-1.5 mt-4 text-[52px] font-bold leading-none tracking-[-0.03em] text-accent">
          {formatCountdown(thinkLeft)}
        </div>
        <p className="text-[13px] text-muted">
          {mediaError
            ? t("thinkCameraFailed")
            : cameraWanted && !streamReady
              ? t("thinkCameraPreparing")
              : t("thinkAutoStart")}
        </p>
        <h2 className="mt-7 text-left text-[21px] font-semibold leading-[1.45] text-ink text-pretty">
          {activity.prompt}
        </h2>
        {/* The canvas line "Not alabilirsin. Kamera şu an kapalı." is true again
            now that the camera really is closed, and it changes the moment that
            stops being true. */}
        <p className="mt-3 text-left text-[13.5px] leading-[1.6] text-muted">
          {activity.note ||
            (cameraWanted ? t("thinkNoteCameraOpening") : t("thinkNote"))}
        </p>

        {mediaError ? (
          <div className="mt-6 rounded-[10px] border border-line bg-surface px-4 py-3 text-left">
            <p className="text-[13px] leading-[1.6] text-danger">{mediaError}</p>
            {activity.config.textAlternativeEnabled ? (
              <p className="mt-2 text-[13px] leading-[1.6] text-muted">
                {t("alternativeOffer")}
              </p>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            disabled={startRequested && !streamReady}
            onClick={() => setStartRequested(true)}
            className="mt-[26px] rounded-lg border border-ink bg-surface px-[18px] py-[11px] text-[13px] font-semibold text-ink disabled:cursor-not-allowed disabled:border-line disabled:text-ink-3"
          >
            {t("startNow")}
          </button>
        )}
        {startRequested && !streamReady && !mediaError ? (
          <p className="mt-2 text-[12.5px] text-muted">{t("startDisabled")}</p>
        ) : null}
        {activity.config.textAlternativeEnabled ? (
          <button
            type="button"
            onClick={() => setUseText(true)}
            className="mt-5 block w-full text-center text-[12.5px] text-muted underline decoration-line underline-offset-2"
          >
            {t("useAlternative")}
          </button>
        ) : null}
      </div>
    );
  }

  /* ---- recording and after: artboard A10, first board ---- */
  const recording = phase === "RECORDING";
  const totalUpload = upload.uploadedBytes + upload.queuedBytes;
  const uploadRatio = totalUpload > 0 ? upload.uploadedBytes / totalUpload : 0;
  const answerRatio = Math.max(0, Math.min(1, recordLeft / (answerSeconds * 1000)));

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <ActivityKicker>
            {isAudio ? t("audioKicker") : t("videoKicker")} ·{" "}
            {activity.maxTakes > 1
              ? t("takesAllowed", { count: activity.maxTakes })
              : t("singleTake")}
          </ActivityKicker>
          <h2 className="mt-2.5 text-2xl font-semibold leading-[1.4] text-ink text-pretty">
            {activity.prompt}
          </h2>
          {activity.note ? (
            <p className="mt-2.5 text-[13.5px] leading-[1.6] text-muted">
              {activity.note}
            </p>
          ) : null}
        </div>
        {recording ? (
          <div className="w-[132px] shrink-0 text-center">
            <div className="text-[11.5px] text-muted">{t("remainingLabel")}</div>
            <div className="tnum mt-1 text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-accent">
              {formatCountdown(recordLeft)}
            </div>
            <div className="relative mt-2 h-[3px] rounded-sm bg-hairline">
              <span
                className="absolute inset-y-0 left-0 rounded-sm bg-accent transition-[width] duration-300"
                style={{ width: `${answerRatio * 100}%` }}
              />
            </div>
            <p className="mt-2 text-[11.5px] leading-[1.4] text-ink-3">
              {t("autoStopNote")}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl bg-ink">
        <div className="relative h-[360px] bg-gradient-to-b from-panel-top to-panel-bottom">
          {!isAudio ? (
            <video
              ref={videoRef}
              muted
              playsInline
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-[12.5px] text-white/[0.42]">
              {recording ? t("audioRecording") : t("audioReady")}
            </div>
          )}

          {recording ? (
            <>
              <div className="absolute left-4 top-3.5 flex items-center gap-[7px] rounded-[14px] bg-black/40 px-[11px] py-1.5">
                <span className="size-2 rounded-full bg-accent" />
                <span className="text-[11.5px] font-semibold text-white">
                  {t("recording")}
                </span>
                <span className="tnum font-mono text-[11.5px] font-medium text-white/70">
                  {formatCountdown(elapsed)}
                </span>
              </div>
              <div className="absolute right-4 top-3.5 text-[11.5px] font-medium text-white/[0.55]">
                {activity.maxTakes > 1
                  ? t("takesLeft", { count: activity.maxTakes - takes })
                  : t("noRetake")}
              </div>
            </>
          ) : null}

          {phase === "DONE" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-center">
              <span className="text-sm font-semibold text-white">
                {t("savedOverlay")}
              </span>
              <span className="text-[12.5px] text-white/60">
                {takes > 0 && activity.maxTakes > 1
                  ? t("takesTaken", { takes, max: activity.maxTakes })
                  : t("takeDone")}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3.5 bg-panel px-4 py-[13px]">
          <span className="flex-1 text-[11.5px] font-medium text-white/[0.62]">
            {phase === "DONE"
              ? t("uploadDone")
              : upload.stalled
                ? t("uploadStalled")
                : t("uploadProgress", { percent: Math.round(uploadRatio * 100) })}
          </span>
          <span className="relative h-[3px] w-[150px] rounded-sm bg-white/[0.16]">
            <span
              className="absolute inset-y-0 left-0 rounded-sm bg-white/[0.85] transition-[width] duration-300"
              style={{ width: `${(phase === "DONE" ? 1 : uploadRatio) * 100}%` }}
            />
          </span>
          <span className="text-[11.5px] font-medium text-white/[0.42]">
            {t("uploadResumeNote")}
          </span>
        </div>
      </div>

      <div className="mt-[18px] flex items-center justify-between gap-4">
        <span className="text-[12.5px] text-muted">
          {recording
            ? t("hintRecording")
            : phase === "UPLOADING"
              ? t("hintUploading")
              : phase === "DONE"
                ? t("hintDone")
                : phase === "FAILED"
                  ? t("hintFailed")
                  : t("hintPreparing")}
        </span>
        <div className="flex items-center gap-3">
          {phase === "DONE" && takes < activity.maxTakes ? (
            <button
              type="button"
              onClick={retake}
              className="rounded-lg border border-ink bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink"
            >
              {t("retake")}
            </button>
          ) : null}
          {phase === "FAILED" && !exhausted ? (
            <button
              type="button"
              onClick={retake}
              className="rounded-lg border border-ink bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink"
            >
              {t("tryAgain")}
            </button>
          ) : null}
          {recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="rounded-lg border border-ink bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink"
            >
              {t("finishAnswer")}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}

      {/* Only once the take has failed. While recording or uploading the
          switch would stop the tracks, which fires the recorder's onstop and
          saves the half-finished clip as the answer, take included. */}
      {activity.config.textAlternativeEnabled && phase === "FAILED" ? (
        <button
          type="button"
          onClick={() => setUseText(true)}
          className="mt-4 text-[12.5px] text-muted underline decoration-line underline-offset-2"
        >
          {t("useAlternative")}
        </button>
      ) : null}
    </div>
  );
}
