"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { stepFocusController, useStepFocus } from "@/hooks/use-step-focus";
import { apiSend, candidateApiBase } from "@/lib/client/api";
import { pickRecorderMime } from "@/lib/client/recorder";
import { nextPath } from "@/lib/candidate-routes";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { ActionBar } from "./action-bar";
import {
  HEARD_AT,
  deniedKind,
  deviceBlocker,
  deviceRows,
  fixKeyFor,
  formatMbps,
  mediaConstraints,
  peakLevel,
  uploadSpeed,
  type Permission,
  type RowId,
  type Trial,
} from "./device-rows";
import { serverMessage } from "./server-message";
import { openTracked, stopAllStreams } from "./streams";

const TRIAL_MS = 5000;
const PROBE_BYTES = 512 * 1024;

type Bandwidth = { state: "measuring" | "unknown" } | { state: "ok" | "low"; mbps: number };
type ReportState = "idle" | "sending" | "sent" | "failed";

/**
 * HIRING-UX 6.3: camera (if a video question exists), microphone, a 5 second
 * trial the candidate plays back (kept in this tab only, never sent), and the
 * connection as information. One row is open at a time; finished rows fold
 * into "Hazır". Nothing here is a proctoring check (plan 2 has none).
 *
 * Two rows stay open past "Hazır" on purpose: the camera keeps its live
 * preview until a trial take exists (the candidate sees their framing while
 * speaking and recording), and the trial keeps its player and "Tekrar kaydet"
 * (the candidate may listen and re-record as often as they like).
 *
 * Every stream is registered (streams.ts) and stopped when the candidate goes
 * on or the screen goes away; a permission answered after that is stopped at
 * once. When the open row changes and focus was on a control that went away
 * (or inside the rows), focus moves to the new row's heading; the reason
 * under the button is a polite live region.
 */
export function DeviceCheck({ token, camera, practice, locale }: { token: string; camera: boolean; practice: boolean; locale: Locale }) {
  const t = useT("hiringDevice");
  const router = useRouter();
  const list = useRef<HTMLOListElement>(null);
  const headings = useRef<Partial<Record<RowId, HTMLHeadingElement | null>>>({});
  const deniedTitle = useRef<HTMLParagraphElement>(null);
  const preview = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const meter = useRef<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const trialUrl = useRef<string | null>(null);
  const alive = useRef(false);
  const failure = useRef("");
  const [focus] = useState(stepFocusController);
  const [permission, setPermission] = useState<Permission>("idle");
  const [denied, setDenied] = useState<"notAllowed" | "other" | null>(null);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const [trial, setTrial] = useState<Trial>("none");
  const [trialFailed, setTrialFailed] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [bandwidth, setBandwidth] = useState<Bandwidth>({ state: "measuring" });
  const [report, setReport] = useState<ReportState>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The report button goes away when the report is sent: the confirmation takes focus (as in Help).
  const sentNote = useStepFocus<HTMLParagraphElement>(report === "sent" ? "sent" : "form");

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    (async () => {
      try {
        const payload = new Uint8Array(PROBE_BYTES);
        for (let offset = 0; offset < payload.length; offset += 65_536) crypto.getRandomValues(payload.subarray(offset, offset + 65_536));
        const started = performance.now();
        const res = await fetch(`${candidateApiBase(token)}/bandwidth`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: payload });
        if (!res.ok) throw new Error(String(res.status));
        const speed = uploadSpeed(PROBE_BYTES, performance.now() - started);
        if (!cancelled) setBandwidth(speed);
      } catch {
        if (!cancelled) setBandwidth({ state: "unknown" });
      }
    })();
    const refs = { timer, recorder, meter, audio, stream, trialUrl };
    return () => {
      cancelled = true;
      alive.current = false;
      if (refs.timer.current !== null) window.clearTimeout(refs.timer.current);
      const rec = refs.recorder.current;
      if (rec && rec.state !== "inactive") rec.stop();
      if (refs.meter.current !== null) window.clearInterval(refs.meter.current);
      void refs.audio.current?.close().catch(() => undefined);
      refs.audio.current = null;
      // Leaving the screen turns the camera and microphone off.
      stopAllStreams();
      refs.stream.current = null;
      if (refs.trialUrl.current) URL.revokeObjectURL(refs.trialUrl.current);
      refs.trialUrl.current = null;
    };
  }, [token]);

  // The preview element exists before the permission (the camera row is open); give it the stream once granted.
  useEffect(() => {
    const video = preview.current;
    if (permission !== "granted" || !camera || !video || !stream.current || video.srcObject === stream.current) return;
    video.srcObject = stream.current;
    void video.play().catch(() => undefined);
  }, [permission, camera]);

  /** The microphone's level until a voice is heard; then the analyser is closed (the stream stays open). */
  function listen(media: MediaStream) {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audio.current = ctx;
      // Safari starts a context made after an await suspended.
      void ctx.resume().catch(() => undefined);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const stop = () => {
        if (meter.current !== null) window.clearInterval(meter.current);
        meter.current = null;
      };
      // An interval, not animation frames: those stop in a tab the browser does not paint.
      const measure = () => {
        if (!alive.current || ctx.state === "closed") return stop();
        // A context the browser started suspended is asked again until it runs.
        if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
        analyser.getByteTimeDomainData(data);
        const peak = peakLevel(data);
        // Rounded so the screen re-renders only when the bar visibly moves.
        setLevel(Math.round(peak * 20) / 20);
        if (peak > HEARD_AT) {
          stop();
          setHeard(true);
          void ctx.close().catch(() => undefined);
          audio.current = null;
        }
      };
      meter.current = window.setInterval(measure, 50);
    } catch {
      // No level to show in this browser: the trial playback is the microphone's proof.
      setHeard(true);
    }
  }

  async function openDevices() {
    setPermission("asking");
    setDenied(null);
    try {
      const media = await openTracked(() => navigator.mediaDevices.getUserMedia(mediaConstraints(camera)), () => alive.current);
      if (!media) return;
      stream.current = media;
      setPermission("granted");
      listen(media);
    } catch (err) {
      failure.current = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "unknown";
      setPermission("denied");
      setDenied(deniedKind(err));
    }
  }

  function record() {
    const media = stream.current;
    if (!media || recorder.current) return;
    setTrialFailed(false);
    try {
      const mime = pickRecorderMime(camera ? "video" : "audio");
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      rec.onstop = () => {
        recorder.current = null;
        if (!alive.current) return;
        if (trialUrl.current) URL.revokeObjectURL(trialUrl.current);
        trialUrl.current = null;
        if (chunks.length === 0) {
          setSrc(null);
          setTrial("none");
          setTrialFailed(true);
          return;
        }
        // Kept in this tab as an object URL; it is never uploaded.
        trialUrl.current = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || mime || (camera ? "video/webm" : "audio/webm") }));
        setSrc(trialUrl.current);
        setTrial("ready");
      };
      rec.start();
      recorder.current = rec;
      setTrial("recording");
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (rec.state === "recording") rec.stop();
      }, TRIAL_MS);
    } catch {
      recorder.current = null;
      setTrialFailed(true);
    }
  }

  async function sendReport() {
    setReport("sending");
    try {
      await apiSend(token, "/problem", { area: "DEVICE_CHECK", message: `${t("reportMessage")} (${failure.current || "-"})` });
      setReport("sent");
    } catch {
      setReport("failed");
    }
  }

  async function proceed() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<HiringCandidateState>(token, "/device-check", {});
      // The check is over: the camera and microphone go off before the next screen asks again.
      stopAllStreams();
      stream.current = null;
      router.push(practice ? `/a/${encodeURIComponent(token)}/practice` : nextPath(token, next));
    } catch (err) {
      setError(serverMessage(err) ?? t("failed"));
      setBusy(false);
    }
  }

  const input = { camera, permission, heard, trial };
  const rows = deviceRows(input);
  const blocker = deviceBlocker(input);
  const active = rows.find((row) => row.state === "active")?.id ?? "none";
  const step = permission === "denied" ? `${active}:denied` : active;

  useEffect(() => {
    const focused = document.activeElement;
    const lost = !focused || focused === document.body || !!list.current?.contains(focused);
    const target = permission === "denied" ? deniedTitle.current : active === "none" ? null : (headings.current[active] ?? null);
    focus.onStep(step, lost ? target : null);
  }, [focus, step, permission, active]);

  const askText = camera ? t("cameraAsk") : t("micAsk");
  const hasTake = trial === "ready" || trial === "played";

  function permissionBody() {
    // Only shown after a refusal, which happens in the browser; the server render never reads navigator.
    const fix = permission === "denied" ? fixKeyFor(navigator.userAgent) : "other";
    return (
      <>
        <p id="check-open-why" className="text-[16px] leading-[26px] text-ink-2">
          {askText}
        </p>
        {permission === "denied" ? (
          <div className="space-y-2 rounded-xl border border-line bg-canvas p-4">
            <p ref={deniedTitle} tabIndex={-1} className="text-[16px] leading-[26px] font-medium text-ink">
              {denied === "notAllowed" ? t("deniedTitle") : t("deniedOther")}
            </p>
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center text-[16px] text-ink underline decoration-underline underline-offset-4">{t("howToFix")}</summary>
              <p className="text-[16px] leading-[26px] text-ink-2">{t(`fix${fix}`)}</p>
            </details>
            {report === "sent" ? (
              <p ref={sentNote} tabIndex={-1} role="status" className="text-[14px] leading-[22px] text-ink">
                {t("reportSent")}
              </p>
            ) : (
              <div>
                <Button className="min-h-11 scroll-mb-32 text-[16px] sm:scroll-mb-0" onClick={sendReport} disabled={report === "sending"} disabledReason={t("reporting")}>
                  {report === "sending" ? t("reporting") : t("report")}
                </Button>
                {report === "failed" ? <p role="alert" className="mt-2 text-[14px] leading-[22px] text-ink">{t("reportFailed")}</p> : null}
              </div>
            )}
          </div>
        ) : null}
        <Button id="check-open" className="min-h-11 scroll-mb-32 text-[16px] sm:scroll-mb-0" onClick={openDevices} disabled={permission === "asking"} disabledReason={askText}>
          {permission === "asking" ? t("asking") : permission === "denied" ? t("retry") : camera ? t("openDevices") : t("openMic")}
        </Button>
      </>
    );
  }

  function body(id: RowId) {
    if (id === "camera") {
      return (
        <div className="space-y-3">
          <div className={cn("relative aspect-video w-full overflow-hidden rounded-xl bg-canvas", permission === "granted" && hasTake && "hidden")}>
            <video ref={preview} muted playsInline className="size-full object-cover" />
            <span className="absolute top-3 left-3 rounded-full bg-surface/90 px-3 py-1 text-[13px] leading-5 text-ink">{t("cameraPreview")}</span>
          </div>
          {permission !== "granted" ? permissionBody() : null}
        </div>
      );
    }
    if (id === "microphone") {
      if (permission !== "granted") return <div className="space-y-3">{permissionBody()}</div>;
      return (
        <div className="space-y-2">
          <p className="text-[16px] leading-[26px] text-ink-2">{heard ? t("micHeard") : t("micHint")}</p>
          <div
            role="meter"
            aria-label={t("micLevel")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
            className="h-2 w-full overflow-hidden rounded-full bg-hairline"
          >
            <div className="h-2 rounded-full bg-accent transition-[width] duration-100 motion-reduce:transition-none" style={{ width: `${Math.min(100, Math.round(level * 250))}%` }} />
          </div>
        </div>
      );
    }
    if (id === "trial") {
      return (
        <div className="space-y-3">
          <p className="text-[16px] leading-[26px] text-ink-2">{t("trialBody")}</p>
          <Button id="check-trial" className="min-h-11 scroll-mb-32 text-[16px] sm:scroll-mb-0" onClick={record} disabled={trial === "recording"} disabledReason={t("trialRecording")}>
            {trial === "recording" ? t("trialRecording") : trial === "none" ? t("trialRecord") : t("trialAgain")}
          </Button>
          {trialFailed ? (
            <p role="alert" className="text-[14px] leading-[22px] text-ink">
              {t("failed")}
            </p>
          ) : null}
          {src && hasTake ? (
            <div className="space-y-2">
              {trial === "ready" ? <p className="text-[14px] leading-[22px] text-muted">{t("trialListen")}</p> : null}
              {camera ? (
                <video key={src} src={src} controls playsInline aria-label={t("trialPlayback")} onPlay={() => setTrial("played")} className="aspect-video w-full rounded-xl bg-canvas" />
              ) : (
                <audio key={src} src={src} controls aria-label={t("trialPlayback")} onPlay={() => setTrial("played")} className="h-12 w-full" />
              )}
            </div>
          ) : null}
        </div>
      );
    }
    return (
      <p className="tnum text-[16px] leading-[26px] text-ink-2">
        {"mbps" in bandwidth
          ? t(bandwidth.state === "ok" ? "connOk" : "connLow", { mbps: formatMbps(bandwidth.mbps, locale) })
          : bandwidth.state === "measuring"
            ? t("connMeasuring")
            : t("connUnknown")}
      </p>
    );
  }

  /** Which rows show their body: the open one, the connection, and the two that stay open past "Hazır" (see above). */
  const expanded = (id: RowId, state: string) =>
    state === "active" || state === "info" || (id === "camera" && permission === "granted") || (id === "trial" && state === "done");

  return (
    <div className="mx-auto max-w-[720px] pt-10 pb-6 sm:pt-14">
      <h1 className="text-[28px] leading-9 font-semibold text-ink">{t("title")}</h1>
      <p className="mt-3 text-[16px] leading-[26px] text-ink-2">{t("body")}</p>
      <ol ref={list} className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
        {rows.map((row) => (
          <li key={row.id} className="p-5 sm:p-card-candidate" aria-current={row.state === "active" ? "step" : undefined}>
            <div className="flex min-h-7 items-center justify-between gap-4">
              <h2
                ref={(node) => {
                  headings.current[row.id] = node;
                }}
                tabIndex={-1}
                className={cn("text-[18px] leading-7 text-ink", row.state === "active" ? "font-semibold" : "font-medium")}
              >
                {t(`row${row.id}`)}
              </h2>
              {row.state === "done" ? (
                <span className="flex items-center gap-1 text-[14px] leading-[22px] text-muted">
                  <Check className="size-4" strokeWidth={2} aria-hidden />
                  {t("ready")}
                </span>
              ) : row.state === "waiting" ? (
                <span className="text-[14px] leading-[22px] text-muted">{t("waiting")}</span>
              ) : null}
            </div>
            {expanded(row.id, row.state) ? <div className="mt-3">{body(row.id)}</div> : null}
          </li>
        ))}
      </ol>
      <ActionBar>
        <Button
          id="check-next"
          variant="primary"
          size="lg"
          className="w-full text-[16px]"
          disabled={blocker !== null || busy}
          disabledReason={blocker ? t(`block${blocker}`) : undefined}
          onClick={proceed}
        >
          {busy ? t("going") : practice ? t("toPractice") : t("toStage")}
        </Button>
        {/* The reason the button waits (C15), announced politely as it changes; "ready" when nothing is left. */}
        <div role="status">
          {blocker ? (
            <DisabledReason id="check-next-why" className="mt-2 text-center text-[14px]">
              {t(`block${blocker}`)}
            </DisabledReason>
          ) : (
            <p className="sr-only">{t("allReady")}</p>
          )}
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-center text-[14px] text-ink">
            {error}
          </p>
        ) : null}
      </ActionBar>
    </div>
  );
}
