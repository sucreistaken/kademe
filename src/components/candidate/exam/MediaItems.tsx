"use client";

import { useEffect, useRef, useState } from "react";
import type { ProctorEngine } from "@/lib/client/proctor/engine";
import { apiSend } from "@/lib/client/api";
import { ChunkedUploader, pickRecorderMime } from "@/lib/client/recorder";
import type { CandidateItem, CandidateStimulus } from "@/lib/exam/safe";
import type { ItemAnswer } from "@/lib/exam/types";
import { formatCountdown } from "@/lib/timer";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * Listening: a player with no seek bar. Each start is counted by the server
 * before the audio URL is handed out, so the limit survives a reload.
 */
export function ListeningPlayer({
  token,
  sectionPosition,
  sequence,
  stimulus,
  engine,
}: {
  token: string;
  sectionPosition: number;
  sequence: number;
  stimulus: Extract<CandidateStimulus, { kind: "LISTENING" }>;
  engine: ProctorEngine | null;
}) {
  const t = useT("exam");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playsLeft, setPlaysLeft] = useState(stimulus.playsLeft);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // A new clip (next testlet) arrives with its own count.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaysLeft(stimulus.playsLeft);
  }, [stimulus.playsLeft, stimulus.title]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      engine?.suppressVoice("listening", false);
    },
    [engine],
  );

  async function play() {
    setError(null);
    try {
      const res = await apiSend<{ src: string; playsLeft: number }>(token, "/exam/listening-audio", { sectionPosition, sequence });
      setPlaysLeft(res.playsLeft);
      const audio = audioRef.current!;
      audio.src = res.src;
      engine?.suppressVoice("listening", true);
      setPlaying(true);
      await audio.play();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "PLAYS_EXHAUSTED") setPlaysLeft(0);
      setError(err instanceof Error ? err.message : String(err));
      setPlaying(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-line bg-surface p-5">
      <div className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">{stimulus.title}</div>
      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={play}
          disabled={playing || playsLeft <= 0}
          className="h-11 shrink-0 rounded-[10px] border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:text-muted"
        >
          {playing ? t("listenPlaying") : t("listenPlay")}
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full bg-ink-3 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
      <p className="tnum mt-2.5 text-[13px] text-muted">{playsLeft > 0 ? t("playsLeft", { n: playsLeft }) : t("noPlaysLeft")}</p>
      {error && playsLeft > 0 ? <p className="mt-1 text-[13px] text-danger">{error}</p> : null}
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.duration) setProgress(a.currentTime / a.duration);
        }}
        onEnded={() => {
          setPlaying(false);
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
        } catch {
          if (!cancelled) setError(t("speakingTextAlt"));
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
  }, [engine, t]);

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
          setError(err instanceof Error ? err.message : String(err));
          setPhase("FAILED");
        }
      };
      startedAt.current = Date.now();
      recorder.start(5000);
      setLeft(content.answerSeconds * 1000);
      setPhase("RECORDING");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
    <div>
      <p lang="de" className="whitespace-pre-line text-[17px] font-medium leading-[1.6] text-ink">
        {item.prompt}
      </p>
      <div className="mt-5 flex flex-col items-start gap-5 md:flex-row">
        <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full max-w-[360px] rounded-[10px] bg-ink object-cover" />
        <div className="flex-1">
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
