"use client";

import { useEffect, useRef, useState } from "react";
import type { ProctorEngine } from "@/lib/client/proctor/engine";
import { apiSend } from "@/lib/client/api";
import { MEDIA_ERROR_KEY, mediaErrorKind } from "@/lib/client/media-error";
import { ChunkedUploader, pickRecorderMime } from "@/lib/client/recorder";
import type { CandidateItem, CandidateStimulus } from "@/lib/exam/safe";
import type { ItemAnswer } from "@/lib/exam/types";
import { formatCountdown } from "@/lib/timer";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button";
import { TASK_LEFT, TASK_RIGHT, TASK_SPLIT } from "./item-parts";
import { isGateOpen, markRevealed, playButtonMode, readRevealed } from "./listening-gate";
import { sessionStore } from "./pending-answer";
import { TaskExpectations } from "./TaskExpectations";
import { TaskPromptCard } from "./TaskPromptCard";

type PlayState = "IDLE" | "LOADING" | "PLAYING" | "FAILED";
type PlayFailure = "LOAD" | "STALLED" | "BLOCKED";

/** The signed audio URL lives 120 s on the server; reuse it a little less than that. */
const SRC_REUSE_MS = 100_000;
/** Loading or playing with no new audio for this long counts as a failed play. */
const STALL_MS = 15_000;

/**
 * Listening: a player with no seek bar. The server counts a play when it hands
 * out the audio URL (it cannot see whether the audio then started), so the
 * limit survives a reload.
 *
 * So a broken connection does not eat a play, the URL of the last counted
 * play is kept: if the audio never started, or stopped half way, "try again"
 * reuses it while it is still valid (from the start, or from where it
 * stopped) instead of asking the server for another play. Only a clip that
 * played to its end, or an expired URL, makes the next start count again.
 */
export function ListeningPlayer({
  token,
  sectionPosition,
  sequence,
  stimulus,
  engine,
  onActiveChange,
  className,
  note,
  heading,
  gateKey,
}: {
  token: string;
  sectionPosition: number;
  sequence: number;
  stimulus: Extract<CandidateStimulus, { kind: "LISTENING" }>;
  engine: ProctorEngine | null;
  /** True while a clip is loading or playing, so the screen can ask before leaving it. */
  onActiveChange?: (active: boolean) => void;
  className?: string;
  /** A calm line under the player, inside the same card. */
  note?: string;
  /** "Listening text 2 of 3", above the player. */
  heading?: string;
  /** Turns on the read-first gate; the flag of this recording is kept under this key. */
  gateKey?: string;
}) {
  const t = useT("exam");
  const ti = useT("examItems");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** The counted play's URL, kept for a retry that should not cost another play. */
  const issued = useRef<{ src: string; at: number } | null>(null);
  /** Where a retry of a play that stopped half way picks up. */
  const resumeAt = useRef(0);
  /** The last position heard in the current play. */
  const position = useRef(0);
  const started = useRef(false);
  const stateRef = useRef<PlayState>("IDLE");
  const watchdog = useRef<number | undefined>(undefined);
  const reuseTimer = useRef<number | undefined>(undefined);
  const [playsLeft, setPlaysLeft] = useState(stimulus.playsLeft);
  const [state, setStateValue] = useState<PlayState>("IDLE");
  const [failure, setFailure] = useState<PlayFailure | null>(null);
  const [canReuse, setCanReuse] = useState(false);
  /** The failed play had started, so a free retry resumes rather than restarts. */
  const [midway, setMidway] = useState(false);
  const [progress, setProgress] = useState(0);
  /** The student said they read the questions (or this tab remembers they did). */
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    // Read after mount: the server render has no sessionStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRevealed(!!gateKey && readRevealed(sessionStore(), gateKey));
  }, [gateKey]);
  const gated = !!gateKey && !isGateOpen({ revealed, playsLeft, maxPlays: stimulus.maxPlays });
  // The gate's button goes away on its click: the focus then moves to the play button of the player that replaces it.
  const playButton = useRef<HTMLButtonElement | null>(null);
  const focusPlayer = useRef(false);
  useEffect(() => {
    if (gated || !focusPlayer.current) return;
    focusPlayer.current = false;
    playButton.current?.focus();
  }, [gated]);

  const active = state === "LOADING" || state === "PLAYING";
  const reportActive = useRef(onActiveChange);
  useEffect(() => {
    reportActive.current = onActiveChange;
  });
  useEffect(() => {
    reportActive.current?.(active);
  }, [active]);
  useEffect(() => () => reportActive.current?.(false), []);

  const setState = (s: PlayState) => {
    stateRef.current = s;
    setStateValue(s);
  };
  const disarm = () => window.clearTimeout(watchdog.current);
  const arm = () => {
    disarm();
    watchdog.current = window.setTimeout(() => fail("STALLED"), STALL_MS);
  };
  const reusable = () => !!issued.current && Date.now() - issued.current.at < SRC_REUSE_MS;

  function fail(kind: PlayFailure) {
    if (stateRef.current === "FAILED" || stateRef.current === "IDLE") return;
    disarm();
    // An error can reset the element to 0, so the last position heard is kept separately.
    resumeAt.current = started.current ? position.current : 0;
    audioRef.current?.pause();
    engine?.suppressVoice("listening", false);
    // Nothing ever played: that is a load failure, whatever ended the wait.
    setFailure(kind === "STALLED" && !started.current ? "LOAD" : kind);
    setMidway(resumeAt.current > 0);
    setState("FAILED");
    // The retry stays free only while the URL is still valid.
    window.clearTimeout(reuseTimer.current);
    if (reusable()) {
      setCanReuse(true);
      reuseTimer.current = window.setTimeout(() => setCanReuse(false), SRC_REUSE_MS - (Date.now() - issued.current!.at));
    } else setCanReuse(false);
  }

  // A new clip (next testlet) arrives with its own count.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaysLeft(stimulus.playsLeft);
  }, [stimulus.playsLeft, stimulus.title]);

  // ...and starts from a clean player: the last clip's URL and position mean nothing for it.
  const clip = `${stimulus.title}|${stimulus.durationMs ?? ""}`;
  useEffect(() => {
    issued.current = null;
    resumeAt.current = 0;
    position.current = 0;
    started.current = false;
    window.clearTimeout(watchdog.current);
    window.clearTimeout(reuseTimer.current);
    audioRef.current?.pause();
    stateRef.current = "IDLE";
    /* eslint-disable react-hooks/set-state-in-effect */
    setStateValue("IDLE");
    setFailure(null);
    setCanReuse(false);
    setMidway(false);
    setProgress(0);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [clip]);

  useEffect(
    () => () => {
      window.clearTimeout(watchdog.current);
      window.clearTimeout(reuseTimer.current);
      audioRef.current?.pause();
      engine?.suppressVoice("listening", false);
    },
    [engine],
  );

  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    setFailure(null);
    setState("LOADING");
    let src = reusable() ? issued.current!.src : null;
    if (!src) {
      try {
        const res = await apiSend<{ src: string; playsLeft: number }>(token, "/exam/listening-audio", { sectionPosition, sequence });
        setPlaysLeft(res.playsLeft);
        issued.current = { src: res.src, at: Date.now() };
        resumeAt.current = 0;
        position.current = 0;
        started.current = false;
        src = res.src;
      } catch (err) {
        if ((err as { code?: string }).code === "PLAYS_EXHAUSTED") {
          setPlaysLeft(0);
          setState("IDLE");
        } else {
          setFailure("LOAD");
          setCanReuse(false);
          setMidway(false);
          setState("FAILED");
        }
        return;
      }
    }
    engine?.suppressVoice("listening", true);
    arm();
    // A fresh load after an error; otherwise the element continues where it is.
    // `audio.src` reads back absolute, and local storage hands out a relative URL.
    if (audio.error || audio.src !== new URL(src, window.location.href).href) audio.src = src;
    try {
      await audio.play();
    } catch (err) {
      // pause() from a failure or an unmount also rejects play(); fail() ignores that.
      fail((err as { name?: string }).name === "NotAllowedError" ? "BLOCKED" : "LOAD");
    }
  }

  const free = state === "FAILED" && canReuse;
  const playMode = playButtonMode({ state, freeRetry: free, playsLeft });
  const label =
    state === "LOADING"
      ? ti("listenLoading")
      : state === "PLAYING"
        ? t("listenPlaying")
        : free
          ? midway
            ? ti("listenResume")
            : ti("listenRetry")
          : t("listenPlay");
  const failureText =
    failure === "STALLED" ? ti("listenStalled") : failure === "BLOCKED" ? ti("listenBlocked") : ti("listenLoadFailed");

  /** One click: the player appears and the recording starts in the same user gesture. */
  function startListening() {
    if (gateKey) markRevealed(sessionStore(), gateKey);
    focusPlayer.current = true;
    setRevealed(true);
    void play();
  }

  const playerCard = (
    <div className="rounded-[14px] border border-line bg-surface p-5">
      {/* German upper case: under the Turkish page language "i" would become "İ". */}
      <div lang="de" className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">
        {stimulus.title}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <button
          ref={playButton}
          type="button"
          onClick={playMode === "ready" ? play : undefined}
          disabled={playMode === "off"}
          aria-disabled={playMode === "busy" || undefined}
          className="h-11 shrink-0 rounded-[10px] border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:text-muted aria-disabled:cursor-wait aria-disabled:text-muted aria-disabled:hover:bg-surface"
        >
          {label}
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full bg-ink-3 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
      <p className="tnum mt-2.5 text-[13px] text-muted">{playsLeft > 0 ? t("playsLeft", { n: playsLeft }) : t("noPlaysLeft")}</p>
      {state === "FAILED" && failure ? (
        <p role="alert" className="mt-1 text-[13px] text-danger">
          {failureText}
          {free ? ` ${midway ? ti("listenFreeResume") : ti("listenFreeRetry")}` : ""}
        </p>
      ) : null}
      {note ? <p className="mt-3 text-[13px] leading-[1.5] text-muted">{note}</p> : null}
    </div>
  );

  const gateCard = (
    <div className="rounded-[14px] border border-line bg-surface p-5">
      <div lang="de" className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">
        {stimulus.title}
      </div>
      <p className="mt-3 text-[15px] leading-[1.6] text-ink-2">{t("listenGate", { plays: playsLeft })}</p>
      <button type="button" onClick={startListening} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-4 h-12 w-full")}>
        {t("listenStart")}
      </button>
    </div>
  );

  return (
    <div className={className}>
      {heading ? <h2 className="mb-3 text-[17px] font-bold leading-[1.3] text-ink">{heading}</h2> : null}
      {gated ? gateCard : playerCard}
      <audio
        ref={audioRef}
        preload="auto"
        onLoadedMetadata={(e) => {
          // A reload after an error starts at 0; put a resumed play back where it stopped.
          if (resumeAt.current > 0) e.currentTarget.currentTime = resumeAt.current;
        }}
        onPlaying={() => {
          if (stateRef.current !== "LOADING" && stateRef.current !== "PLAYING") return;
          started.current = true;
          disarm();
          setState("PLAYING");
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (stateRef.current !== "PLAYING") return;
          if (a.duration) setProgress(a.currentTime / a.duration);
          // Only audio actually moving on clears a stall.
          if (!a.paused && a.currentTime > position.current) disarm();
          position.current = a.currentTime;
        }}
        onWaiting={() => {
          if (stateRef.current === "PLAYING") arm();
        }}
        onStalled={() => {
          if (stateRef.current === "LOADING" || stateRef.current === "PLAYING") arm();
        }}
        onError={() => fail("LOAD")}
        onEnded={() => {
          disarm();
          // The play is used up: the next start asks the server again.
          issued.current = null;
          resumeAt.current = 0;
          position.current = 0;
          started.current = false;
          setMidway(false);
          setState("IDLE");
          setProgress(1);
          // A short tail so the end of the clip is not taken for the student talking.
          window.setTimeout(() => engine?.suppressVoice("listening", false), 1000);
        }}
      />
    </div>
  );
}

type Phase = "THINKING" | "RECORDING" | "UPLOADING" | "DONE" | "FAILED";

/**
 * Speaking: think, then record. The camera is the proctoring camera, already
 * on; recording only starts writing the answer. Parts upload while the
 * student talks, so a closed tab still leaves a playable answer.
 */
export function SpeakingItem({
  token,
  sectionPosition,
  item,
  answer,
  onChange,
  engine,
}: {
  token: string;
  sectionPosition: number;
  item: CandidateItem;
  answer: ItemAnswer;
  onChange: (a: ItemAnswer) => void;
  engine: ProctorEngine | null;
}) {
  const t = useT("exam");
  const f = useT("examFlow");
  const content = item.content.kind === "SPEAKING" ? item.content : null;
  const [phase, setPhase] = useState<Phase>(item.takesUsed && item.takesUsed > 0 ? "DONE" : "THINKING");
  const [left, setLeft] = useState((content?.thinkSeconds ?? 30) * 1000);
  const [takes, setTakes] = useState(item.takesUsed ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);

  const maxTakes = content?.maxTakes ?? 1;

  useEffect(() => {
    engine?.suppressVoice("speaking", phase === "THINKING" || phase === "RECORDING");
    return () => engine?.suppressVoice("speaking", false);
  }, [engine, phase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stream = engine?.cameraStream ?? null;
      if (!stream || stream.getTracks().every((tr) => tr.readyState === "ended")) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err) {
          if (!cancelled) setError(f(MEDIA_ERROR_KEY[mediaErrorKind(err)]));
          return;
        }
      }
      if (cancelled) return;
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engine, f]);

  // Think time, then recording starts by itself.
  useEffect(() => {
    if (phase !== "THINKING" && phase !== "RECORDING") return;
    const end = Date.now() + left;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, end - Date.now());
      setLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(id);
        if (phase === "THINKING") void begin();
        else stop();
      }
    }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function begin() {
    if (!content || !streamRef.current) {
      setPhase("FAILED");
      return;
    }
    try {
      const mime = pickRecorderMime("video");
      const uploader = await ChunkedUploader.open(token, "/exam/media/init", { sectionPosition, sequence: item.sequence }, mime || "video/webm");
      // Record a copy of the tracks so stopping the recorder never touches the proctoring camera.
      const recStream = new MediaStream(streamRef.current.getTracks().map((tr) => tr.clone()));
      const recorder = new MediaRecorder(recStream, mime ? { mimeType: mime, videoBitsPerSecond: 600_000 } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => uploader.push(e.data);
      recorder.onstop = async () => {
        recStream.getTracks().forEach((tr) => tr.stop());
        setPhase("UPLOADING");
        try {
          await uploader.finish(Date.now() - startedAt.current);
          setTakes((n) => n + 1);
          onChange({ ...answer, mediaAssetId: uploader.uploadRef });
          setPhase("DONE");
        } catch (err) {
          setError(f(MEDIA_ERROR_KEY[mediaErrorKind(err)]));
          setPhase("FAILED");
        }
      };
      startedAt.current = Date.now();
      recorder.start(5000);
      setLeft(content.answerSeconds * 1000);
      setPhase("RECORDING");
    } catch (err) {
      setError(f(MEDIA_ERROR_KEY[mediaErrorKind(err)]));
      setPhase("FAILED");
    }
  }

  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function again() {
    setError(null);
    setLeft(0);
    void begin();
  }

  if (!content) return null;
  return (
    <div className={TASK_SPLIT}>
      <div className={TASK_LEFT}>
        <TaskPromptCard text={item.prompt} points={content.studentPoints} />
        <TaskExpectations section="SPEAKING" thinkSeconds={content.thinkSeconds} answerSeconds={content.answerSeconds} />
      </div>
      <div className={cn(TASK_RIGHT, "gap-4")}>
        <video ref={videoRef} muted playsInline className="mb-4 aspect-[4/3] w-full max-w-[300px] shrink-0 rounded-[10px] bg-ink object-cover lg:mb-0" />
        <div className="shrink-0">
          {phase === "THINKING" ? (
            <>
              <div className="text-[13px] font-medium text-muted">{t("thinkTime")}</div>
              <div className="tnum mt-1 text-[32px] font-bold text-accent">{formatCountdown(left)}</div>
              <button type="button" onClick={() => void begin()} className="mt-3 h-10 rounded-[10px] border border-line-strong bg-surface px-4 text-[14px] font-medium text-ink hover:bg-canvas">
                {t("startNow")}
              </button>
            </>
          ) : null}
          {phase === "RECORDING" ? (
            <>
              <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                <span className="size-2 animate-pulse rounded-full bg-danger" aria-hidden /> {t("recordingNow")}
              </div>
              <div className="tnum mt-1 text-[32px] font-bold text-accent">{formatCountdown(left)}</div>
              <button type="button" onClick={stop} className="mt-3 h-10 rounded-[10px] border border-line-strong bg-surface px-4 text-[14px] font-medium text-ink hover:bg-canvas">
                {t("stopRecording")}
              </button>
            </>
          ) : null}
          {phase === "UPLOADING" ? <p className="text-[14px] text-muted">{t("saving")}</p> : null}
          {phase === "DONE" ? (
            <>
              <p className="text-[14px] font-medium text-ink">{t("recorded")}</p>
              {takes < maxTakes ? (
                <button type="button" onClick={again} className="mt-3 h-10 rounded-[10px] border border-line-strong bg-surface px-4 text-[14px] font-medium text-ink hover:bg-canvas">
                  {t("retake", { n: maxTakes - takes })}
                </button>
              ) : null}
            </>
          ) : null}
          {phase === "FAILED" || error ? (
            <div className="mt-2">
              {error ? <p className="text-[13px] text-danger">{error}</p> : null}
              <button type="button" onClick={() => setTyping(true)} className={cn("mt-2 text-[13px] font-semibold text-ink underline underline-offset-2", typing && "hidden")}>
                {t("speakingTextAlt")}
              </button>
              {typing ? (
                <textarea
                  lang="de"
                  aria-label={f("speakingTextLabel")}
                  rows={6}
                  value={answer.text ?? ""}
                  onChange={(e) => onChange({ ...answer, text: e.target.value, usedTextAlternative: true })}
                  className="mt-2 w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-[15px]"
                  spellCheck={false}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
