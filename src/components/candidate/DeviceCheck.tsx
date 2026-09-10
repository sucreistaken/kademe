"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CandidateColumn } from "@/components/candidate/Shell";
import { apiSend } from "@/lib/client/api";
import { pickRecorderMime } from "@/lib/client/recorder";
import { stepPath } from "@/lib/candidate-routes";
import { formatCountdown } from "@/lib/timer";
import type { CandidateState } from "@/lib/candidate-flow";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * Artboard A9. Early validation instead of late rescue: the camera, the
 * microphone and a real five second recording are all proved before a single
 * question is shown. The trial never leaves the device, which is why it is the
 * one recording in this product allowed to live in memory.
 */

type Permission = "asking" | "granted" | "denied";
type Trial = "none" | "recording" | "ready" | "played";

const TRIAL_MS = 5000;
const METER_BARS = 12;

export function DeviceCheck({ token }: { token: string }) {
  const router = useRouter();
  const t = useT("deviceCheck");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playbackRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const trialUrlRef = useRef<string | null>(null);

  const [permission, setPermission] = useState<Permission>("asking");
  const [deniedReason, setDeniedReason] = useState<string>("");
  const [level, setLevel] = useState(0);
  const [heardSound, setHeardSound] = useState(false);
  const [trial, setTrial] = useState<Trial>("none");
  const [trialUrl, setTrialUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playedMs, setPlayedMs] = useState(0);
  const [trialMs, setTrialMs] = useState(TRIAL_MS);
  const [labels, setLabels] = useState({ camera: "", microphone: "" });
  const [bandwidth, setBandwidth] = useState<Bandwidth>({ status: "measuring" });
  const [busy, setBusy] = useState(false);
  const [problemSent, setProblemSent] = useState(false);

  /* ---- upload bandwidth, measured once ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mbps = await measureUploadMbps(token);
        if (cancelled) return;
        setBandwidth(
          mbps >= ENOUGH_MBPS
            ? { status: "ok", mbps: formatMbps(mbps) }
            : { status: "low", mbps: formatMbps(mbps) },
        );
      } catch {
        // A probe that fails says "ölçemedik", never a number.
        if (!cancelled) setBandwidth({ status: "unknown" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const stopEverything = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioCtxRef.current?.close().catch(() => undefined);
    if (trialUrlRef.current) URL.revokeObjectURL(trialUrlRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    async function ask() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setPermission("granted");
        setLabels({
          camera: stream.getVideoTracks()[0]?.label ?? "",
          microphone: stream.getAudioTracks()[0]?.label ?? "",
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }

        const AudioCtx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const measure = () => {
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (const sample of data) {
            peak = Math.max(peak, Math.abs(sample - 128) / 128);
          }
          setLevel(peak);
          if (peak > 0.06) setHeardSound(true);
          raf = requestAnimationFrame(measure);
        };
        measure();
      } catch (err) {
        if (cancelled) return;
        setPermission("denied");
        setDeniedReason(
          err instanceof Error && err.name === "NotAllowedError"
            ? t("deniedNotAllowed")
            : t("deniedOther"),
        );
      }
    }

    void ask();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopEverything();
    };
  }, [stopEverything, t]);

  function recordTrial() {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = pickRecorderMime("video");
    chunksRef.current = [];
    const recorder = new MediaRecorder(
      stream,
      mime ? { mimeType: mime } : undefined,
    );
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
      chunksRef.current = [];
      if (trialUrlRef.current) URL.revokeObjectURL(trialUrlRef.current);
      const url = URL.createObjectURL(blob);
      trialUrlRef.current = url;
      setTrialUrl(url);
      setPlayedMs(0);
      setTrial("ready");
    };
    recorder.start();
    setTrial("recording");
    window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, TRIAL_MS);
  }

  function togglePlayback() {
    const player = playbackRef.current;
    if (!player) return;
    if (player.paused) void player.play().catch(() => undefined);
    else player.pause();
  }

  async function reportProblem() {
    await apiSend(token, "/problem", {
      area: "DEVICE_CHECK",
      message: deniedReason || t("problemMessage"),
    }).catch(() => undefined);
    setProblemSent(true);
  }

  async function proceed() {
    setBusy(true);
    try {
      const next = await apiSend<CandidateState>(token, "/device-check", {});
      stopEverything();
      router.push(stepPath(token, next));
    } catch {
      setBusy(false);
    }
  }

  const ready = permission === "granted" && trial === "played";
  const reason =
    permission !== "granted"
      ? t("reasonPermission")
      : trial === "none"
        ? t("reasonTrialNone")
        : trial === "recording"
          ? t("reasonTrialRecording")
          : t("reasonTrialListen");

  const progress = trialMs > 0 ? Math.min(1, playedMs / trialMs) : 0;

  return (
    <CandidateColumn width={720} padding="px-7 pt-11 pb-[52px]">
      <h1 className="text-[26px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm leading-[1.6] text-muted">{t("body")}</p>

      <div className="mt-[26px] grid items-start gap-4 md:grid-cols-[1fr_260px]">
        <div className="overflow-hidden rounded-xl bg-ink">
          <div className="relative h-[290px] bg-gradient-to-b from-panel-top to-panel-bottom">
            <video
              ref={videoRef}
              muted
              playsInline
              className="size-full object-cover"
            />
            {permission !== "granted" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                <span className="size-[72px] rounded-full border border-dashed border-white/[0.28] bg-white/[0.08]" />
                <span className="mt-3 text-[12.5px] text-white/50">
                  {permission === "denied"
                    ? `${deniedReason} ${t("deniedHelp")}`
                    : t("previewNotRecording")}
                </span>
              </div>
            ) : null}
            <div className="absolute left-3.5 top-3 flex items-center gap-1.5 text-[11.5px] font-medium text-white/70">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  permission === "granted" ? "bg-accent" : "bg-white/40",
                )}
              />
              {permission === "granted"
                ? labels.camera
                  ? t("cameraConnectedNamed", { label: labels.camera })
                  : t("cameraConnected")
                : t("cameraWaiting")}
            </div>
          </div>
          <div className="bg-panel px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="w-16 text-[11.5px] font-medium text-white/[0.66]">
                {t("micLabel")}
              </span>
              <span className="flex h-4 flex-1 items-end gap-[3px]">
                {Array.from({ length: METER_BARS }, (_, i) => {
                  const on = level * METER_BARS > i;
                  return (
                    <span
                      key={i}
                      className={cn(
                        "flex-1 rounded-[1px]",
                        on ? "bg-accent" : "bg-white/20",
                      )}
                      style={{ height: on ? `${Math.min(16, 5 + i * 2)}px` : "5px" }}
                    />
                  );
                })}
              </span>
              <span className="text-[11.5px] font-medium text-white/50">
                {heardSound ? t("micGood") : t("micWaiting")}
              </span>
            </div>
            <p className="mt-2 text-[11.5px] text-white/[0.42]">{t("micHint")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <CheckRow
            ok={permission === "granted"}
            title={t("checkCamera")}
            body={permission === "granted" ? t("checkCameraOk") : t("checkCameraWaiting")}
          />
          <CheckRow
            ok={heardSound}
            title={t("checkMic")}
            body={heardSound ? t("checkMicOk") : t("checkMicWaiting")}
          />
          {/* Artboard A9 has four rows. This is the fourth, and it is a real
              measurement: a made up number on a screen that tells a candidate
              their connection is fine would be worse than no row at all. It
              never blocks anyone, because a slow link is not a failed check. */}
          <CheckRow
            ok={bandwidth.status === "ok"}
            title={t("checkConnection")}
            body={
              bandwidth.status === "measuring"
                ? t("checkConnectionMeasuring")
                : bandwidth.status === "unknown"
                  ? t("checkConnectionUnknown")
                  : bandwidth.status === "ok"
                    ? t("checkConnectionOk", { mbps: bandwidth.mbps })
                    : t("checkConnectionLow", { mbps: bandwidth.mbps })
            }
          />
          <CheckRow
            ok={trial === "played"}
            title={t("checkTrial")}
            body={
              trial === "played"
                ? t("checkTrialPlayed")
                : trial === "ready"
                  ? t("checkTrialReady")
                  : t("checkTrialNone")
            }
          />
          <p className="px-1 py-0.5 text-[11.5px] leading-[1.5] text-ink-3">
            {t("quietHint")}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface px-5 py-[18px]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-ink">{t("trialTitle")}</div>
            <p className="mt-1 text-[13px] leading-[1.55] text-muted">
              {t("trialBody")}
            </p>
          </div>
          <button
            type="button"
            disabled={permission !== "granted" || trial === "recording"}
            onClick={recordTrial}
            className="shrink-0 rounded-lg border border-ink bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink disabled:cursor-not-allowed disabled:border-line disabled:text-ink-3"
          >
            {trial === "recording"
              ? t("trialRecording")
              : trial === "none"
                ? t("trialRecord")
                : t("trialRetake")}
          </button>
        </div>

        {trialUrl ? (
          <div className="mt-3.5 flex items-center gap-3.5 rounded-[9px] border border-hairline bg-paper px-3.5 py-[11px]">
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={playing ? t("pause") : t("play")}
              className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-ink text-white"
            >
              {playing ? (
                <span className="flex gap-[2px]">
                  <span className="block h-[9px] w-[2px] bg-white" />
                  <span className="block h-[9px] w-[2px] bg-white" />
                </span>
              ) : (
                <span className="ml-[2px] size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
              )}
            </button>
            <span className="relative h-[3px] flex-1 rounded-sm bg-line">
              <span
                className="absolute inset-y-0 left-0 rounded-sm bg-ink"
                style={{ width: `${progress * 100}%` }}
              />
            </span>
            <span className="tnum font-mono text-[12px] font-medium text-muted">
              {formatCountdown(playedMs)}
            </span>
            <button
              type="button"
              onClick={recordTrial}
              className="text-[12.5px] font-medium text-ink"
            >
              {t("trialRetake")}
            </button>
            <video
              ref={playbackRef}
              src={trialUrl}
              playsInline
              className="hidden"
              onPlay={() => {
                setPlaying(true);
                setTrial("played");
              }}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onTimeUpdate={(e) =>
                setPlayedMs(e.currentTarget.currentTime * 1000)
              }
              onLoadedMetadata={(e) => {
                const seconds = e.currentTarget.duration;
                if (Number.isFinite(seconds) && seconds > 0) {
                  setTrialMs(seconds * 1000);
                }
              }}
            />
          </div>
        ) : null}
      </div>

      <button
        type="button"
        id="check-next"
        disabled={!ready || busy}
        onClick={proceed}
        aria-describedby={!ready ? "check-next-why" : undefined}
        className={
          ready && !busy
            ? "mt-[18px] w-full rounded-[10px] border border-accent bg-accent px-4 py-[15px] text-[14.5px] font-semibold text-white transition-colors hover:bg-accent-hover"
            : "mt-[18px] w-full cursor-not-allowed rounded-[10px] border border-line bg-disabled px-4 py-[15px] text-[14.5px] font-semibold text-ink-3"
        }
      >
        {busy ? t("nextPreparing") : t("next")}
      </button>
      {!ready ? (
        <p
          id="check-next-why"
          className="mt-[9px] text-center text-[12.5px] text-muted"
        >
          {reason}
        </p>
      ) : null}

      {permission === "denied" ? (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-[10px] border border-line bg-surface px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[13px] text-muted">
            <span className="size-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />
            {problemSent ? t("problemSent") : t("problemHint")}
          </span>
          {!problemSent ? (
            <button
              type="button"
              onClick={reportProblem}
              className="shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink hover:bg-paper"
            >
              {t("reportProblem")}
            </button>
          ) : null}
        </div>
      ) : null}
    </CandidateColumn>
  );
}

function CheckRow({
  ok,
  title,
  body,
}: {
  ok: boolean;
  title: string;
  body: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[10px] border bg-surface px-3.5 py-3",
        ok ? "border-line" : "border-line-strong",
      )}
    >
      {ok ? (
        <span className="mt-px text-xs font-semibold text-ink" aria-hidden>
          ✓
        </span>
      ) : (
        <span
          className="mt-[3px] size-3 shrink-0 rounded-full border-[1.5px] border-line-mute"
          aria-hidden
        />
      )}
      <div>
        <div className="text-[13px] font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-[11.5px] text-muted">{body}</div>
      </div>
    </div>
  );
}

type Bandwidth =
  | { status: "measuring" }
  | { status: "unknown" }
  | { status: "ok" | "low"; mbps: string };

/** A 720p answer uploads while it is recorded, which needs about this much. */
const ENOUGH_MBPS = 2;

const PROBE_BYTES = 512 * 1024;

/**
 * Times one upload of half a megabyte. Upload rather than download, because
 * that is the direction a recorded answer travels.
 *
 * Random bytes, not zeros: a proxy that compresses a block of zeros would hand
 * back a flattering number the candidate's real answer will never see.
 */
async function measureUploadMbps(token: string): Promise<number> {
  const payload = new Uint8Array(PROBE_BYTES);
  for (let offset = 0; offset < payload.length; offset += 65_536) {
    crypto.getRandomValues(payload.subarray(offset, offset + 65_536));
  }

  const started = performance.now();
  const res = await fetch(`/api/c/${token}/bandwidth`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: payload,
  });
  if (!res.ok) throw new Error(`probe failed: ${res.status}`);
  await res.json();

  const seconds = (performance.now() - started) / 1000;
  if (seconds <= 0) throw new Error("probe took no time");
  return (PROBE_BYTES * 8) / seconds / 1_000_000;
}

function formatMbps(mbps: number): string {
  return mbps >= 10 ? String(Math.round(mbps)) : mbps.toFixed(1);
}
