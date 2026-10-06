"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/visual/disclosure";
import { Illustration } from "@/components/visual/illustrations";
import { PathSteps } from "@/components/visual/path-steps";
import { StepFooter } from "@/components/visual/step-footer";
import { StepScreen } from "@/components/visual/step-screen";
import { stepFocusController, useStepFocus } from "@/hooks/use-step-focus";
import { apiSend, candidateApiBase } from "@/lib/client/api";
import { CHUNK_MS, pickRecorderMime } from "@/lib/client/recorder";
import { nextPath } from "@/lib/candidate-routes";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { mailTo } from "./closed";
import { HEARD_AT, deniedKind, deviceRows, fixKeyFor, formatMbps, isQuiet, mediaConstraints, peakLevel, uploadSpeed, type DeniedKind, type Permission, type Trial } from "./device-rows";
import { checkMemoryKey, contextStalled, deviceStep, focusLost, NO_REPORTS, quietCopy, readCheckMemory, rememberCheck, shouldAutoOpen, splitFix, unsupportedSteps, waitReasonKey, withReport, type ReportKind, type ReportState } from "./device-steps";
import { sessionDrafts } from "./draft-store";
import { serverMessage } from "./server-message";
import { openTracked, stopAllStreams } from "./streams";
import { useJourney } from "./use-journey";

const TRIAL_MS = 5000;
const PROBE_BYTES = 512 * 1024;
/** A probe that has not answered by then is "Ölçülemedi"; the connection row never waits longer. */
const PROBE_TIMEOUT_MS = 10_000;

type Bandwidth = { state: "measuring" | "unknown" } | { state: "ok" | "low"; mbps: number };

function newSoundContext(): AudioContext {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctx();
}

async function permissionOf(name: "camera" | "microphone"): Promise<PermissionState | null> {
  try {
    return (await navigator.permissions?.query({ name: name as PermissionName }))?.state ?? null;
  } catch {
    // Firefox does not know "camera": unknown is never taken as allowed.
    return null;
  }
}

/**
 * HIRING-VISUAL-FLOW 3.3: three sub-steps (turn the devices on, a 5 second
 * test, "can you see and hear yourself?"), the candidate's own picture as the
 * screen's picture on the right, a short checklist on the left. The filled
 * button is always the next real action (G2); it goes on only where the rows
 * model says nothing blocks (device-steps tests it). Nothing here is a
 * proctoring check; the test recording stays in this tab.
 *
 * Kept from plan 2 (Task 12 and its review): the sound context is made inside
 * the click; an unheard microphone lets the trial prove itself after 8 s; a
 * refusal, a missing device, a busy device and a browser without camera
 * access each get their own next step; every stream is registered and stopped
 * when the candidate goes on, the screen goes or the page is hidden.
 */
export function DeviceCheck({
  token,
  camera,
  practice,
  locale,
  contactEmail,
}: {
  token: string;
  camera: boolean;
  practice: boolean;
  locale: Locale;
  /** Named in a report's confirmation for an urgent problem (no reply is promised). */
  contactEmail: string | null;
}) {
  const t = useT("hiringDevice");
  const router = useRouter();
  const body = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const preview = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const meter = useRef<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const trialUrl = useRef<string | null>(null);
  const alive = useRef(false);
  const failure = useRef("");
  const memoryKey = checkMemoryKey(token);
  const [focus] = useState(stepFocusController);
  const [permission, setPermission] = useState<Permission>("idle");
  const [denied, setDenied] = useState<DeniedKind | null>(null);
  const [quiet, setQuiet] = useState(false);
  const [meterless, setMeterless] = useState(false);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const [trial, setTrial] = useState<Trial>("none");
  const [trialFailed, setTrialFailed] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [bandwidth, setBandwidth] = useState<Bandwidth>({ state: "measuring" });
  const [reports, setReports] = useState<Record<ReportKind, ReportState>>(NO_REPORTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const journey = useJourney("device", { device: true, warmup: practice });
  const anySent = reports.devices === "sent" || reports.quiet === "sent" || reports.recorder === "sent";
  const sentNote = useStepFocus<HTMLParagraphElement>(anySent ? "sent" : "form");

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    const probe = new AbortController();
    const probeTimer = window.setTimeout(() => probe.abort(), PROBE_TIMEOUT_MS);
    (async () => {
      try {
        const payload = new Uint8Array(PROBE_BYTES);
        for (let offset = 0; offset < payload.length; offset += 65_536) crypto.getRandomValues(payload.subarray(offset, offset + 65_536));
        const started = performance.now();
        const res = await fetch(`${candidateApiBase(token)}/bandwidth`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: payload, signal: probe.signal });
        if (!res.ok) throw new Error(String(res.status));
        const speed = uploadSpeed(PROBE_BYTES, performance.now() - started);
        if (!cancelled) setBandwidth(speed);
      } catch {
        if (!cancelled) setBandwidth({ state: "unknown" });
      } finally {
        window.clearTimeout(probeTimer);
      }
    })();
    const onHide = () => {
      stopAllStreams();
    };
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    const refs = { timer, recorder, meter, audio, stream, trialUrl };
    return () => {
      cancelled = true;
      alive.current = false;
      probe.abort();
      window.clearTimeout(probeTimer);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
      if (refs.timer.current !== null) window.clearTimeout(refs.timer.current);
      const rec = refs.recorder.current;
      if (rec && rec.state !== "inactive") rec.stop();
      if (refs.meter.current !== null) window.clearInterval(refs.meter.current);
      void refs.audio.current?.close().catch(() => undefined);
      refs.audio.current = null;
      stopAllStreams();
      refs.stream.current = null;
      if (refs.trialUrl.current) URL.revokeObjectURL(refs.trialUrl.current);
      refs.trialUrl.current = null;
    };
  }, [token]);

  // The preview element is always mounted; it gets the stream once granted.
  useEffect(() => {
    const video = preview.current;
    if (permission !== "granted" || !camera || !video || !stream.current || video.srcObject === stream.current) return;
    video.srcObject = stream.current;
    void video.play().catch(() => undefined);
  }, [permission, camera]);

  function listen(media: MediaStream, ctx: AudioContext | null) {
    if (!ctx) {
      // No sound context: nothing to listen with, so the copy says so (Task 12 carry) and the trial is the proof.
      setMeterless(true);
      setQuiet(true);
      return;
    }
    try {
      audio.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const stop = () => {
        if (meter.current !== null) window.clearInterval(meter.current);
        meter.current = null;
      };
      const started = performance.now();
      let suspendedSince: number | null = null;
      const measure = () => {
        if (!alive.current || ctx.state === "closed") return stop();
        const now = performance.now();
        // Safari's "interrupted" is held back like "suspended" (Task 12 carry): asked again until it runs.
        if (contextStalled(ctx.state)) {
          suspendedSince ??= now;
          void ctx.resume().catch(() => undefined);
        } else suspendedSince = null;
        if (isQuiet({ heard: false, listenedMs: now - started, suspendedMs: suspendedSince === null ? 0 : now - suspendedSince })) setQuiet(true);
        analyser.getByteTimeDomainData(data);
        const peak = peakLevel(data);
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
      setMeterless(true);
      setQuiet(true);
    }
  }

  async function openDevices() {
    setDenied(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      failure.current = "NoMediaDevices";
      setPermission("denied");
      setDenied("unsupported");
      return;
    }
    setPermission("asking");
    void audio.current?.close().catch(() => undefined);
    audio.current = null;
    let ctx: AudioContext | null = null;
    try {
      ctx = newSoundContext();
      void ctx.resume().catch(() => undefined);
    } catch {
      ctx = null;
    }
    try {
      const media = await openTracked(() => navigator.mediaDevices.getUserMedia(mediaConstraints(camera)), () => alive.current);
      if (!media) {
        void ctx?.close().catch(() => undefined);
        return;
      }
      stream.current = media;
      setPermission("granted");
      // C3: this tab opened the devices; only a remount may reopen them without a click.
      rememberCheck(sessionDrafts(), memoryKey, "devicesOpened");
      // A remount (a language switch) keeps the test the candidate already played (Task 12 carry).
      if (readCheckMemory(sessionDrafts(), memoryKey).trialPlayed) setTrial((now) => (now === "none" ? "played" : now));
      listen(media, ctx);
    } catch (err) {
      void ctx?.close().catch(() => undefined);
      failure.current = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "unknown";
      setPermission("denied");
      setDenied(deniedKind(err));
    }
  }

  // Devices this browser already allows open again by themselves after a remount; a first visit still waits for the click.
  const openRef = useRef(openDevices);
  useEffect(() => {
    openRef.current = openDevices;
  });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cameraPermission, microphonePermission] = await Promise.all([camera ? permissionOf("camera") : Promise.resolve(null), permissionOf("microphone")]);
      if (!cancelled && shouldAutoOpen({ openedBefore: readCheckMemory(sessionDrafts(), memoryKey).devicesOpened, camera, cameraPermission, microphonePermission })) void openRef.current();
    })();
    // A sound context made without a click may wait for one: the first click or key lets it run.
    const wake = () => void audio.current?.resume().catch(() => undefined);
    document.addEventListener("pointerdown", wake, { once: true });
    document.addEventListener("keydown", wake, { once: true });
    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", wake);
      document.removeEventListener("keydown", wake);
    };
  }, [camera, memoryKey]);

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
        trialUrl.current = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || mime || (camera ? "video/webm" : "audio/webm") }));
        setSrc(trialUrl.current);
        setTrial("ready");
      };
      rec.start(CHUNK_MS);
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

  function played() {
    setTrial("played");
    rememberCheck(sessionDrafts(), memoryKey, "trialPlayed");
  }

  async function sendReport(kind: ReportKind) {
    setReports((now) => withReport(now, kind, "sending"));
    const message = kind === "quiet" ? t("reportQuietMessage") : kind === "recorder" ? t("reportRecorderMessage") : `${t("reportMessage")} (${failure.current || "-"})`;
    try {
      await apiSend(token, "/problem", { area: "DEVICE_CHECK", message });
      setReports((now) => withReport(now, kind, "sent"));
    } catch {
      setReports((now) => withReport(now, kind, "failed"));
    }
  }

  async function proceed() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<HiringCandidateState>(token, "/device-check", {});
      stopAllStreams();
      stream.current = null;
      router.push(practice ? `/a/${encodeURIComponent(token)}/practice` : nextPath(token, next));
    } catch (err) {
      setError(serverMessage(err) ?? t("failed"));
      setBusy(false);
    }
  }

  const input = { camera, permission, heard, quiet, trial };
  // Only read where a permission was granted (client side); the open step never depends on it.
  const recorderMissing = typeof MediaRecorder === "undefined" && permission === "granted";
  const now = deviceStep({ ...input, denied, recorder: !recorderMissing });
  const rows = deviceRows(input);
  const words = quietCopy(meterless);
  const waitKey = waitReasonKey(now.wait);
  const stepKey = permission === "denied" ? `denied:${denied}` : now.step;

  // Focus follows the step only when it was lost: on <body>, inside the step's own area, or on the footer's
  // button that stays mounted and turns disabled (fix round 1; focusLost is tested).
  useEffect(() => {
    const focused = document.activeElement;
    const lost = focusLost({
      present: !!focused,
      onBody: focused === document.body,
      inStepArea: !!focused && !!body.current?.contains(focused),
      inFooter: !!focused?.closest("[data-step-footer]"),
      disabled: !!focused?.matches(":disabled"),
    });
    focus.onStep(stepKey, lost ? title.current : null);
  }, [focus, stepKey]);

  function reportControl(kind: ReportKind) {
    const state = reports[kind];
    if (state === "sent") {
      return (
        <p ref={sentNote} tabIndex={-1} role="status" className="text-[14px] leading-[22px] text-ink">
          {contactEmail ? t.rich("reportSentContact", { email: contactEmail, mail: mailTo(contactEmail) }) : t("reportSent")}
        </p>
      );
    }
    return (
      <div>
        <Button className="min-h-11 text-[16px]" onClick={() => void sendReport(kind)} disabled={state === "sending"} disabledReason={t("reporting")}>
          {state === "sending" ? t("reporting") : t("report")}
        </Button>
        {state === "failed" ? (
          <p role="alert" className="mt-2 text-[14px] leading-[22px] text-ink">
            {t("reportFailed")}
          </p>
        ) : null}
      </div>
    );
  }

  const heading =
    now.step === "open"
      ? camera
        ? t("titleOpen")
        : t("titleOpenMic")
      : now.step === "denied"
        ? denied === "notAllowed"
          ? camera
            ? t("titleDenied")
            : t("titleDeniedMic")
          : camera
            ? t("titleUnreachable")
            : t("titleUnreachableMic")
        : now.step === "quiet"
          ? meterless
            ? t("titleNoMeter")
            : t("titleQuiet")
          : now.step === "listen"
            ? camera
              ? t("titleListen")
              : t("titleListenMic")
            : t("titleTrial");
  const lead =
    now.step === "open"
      ? camera
        ? t("leadOpen")
        : t("leadOpenMic")
      : now.step === "denied"
        ? denied === "notAllowed"
          ? t("leadDenied")
          : denied === "notFound"
            ? t("deniedNotFound")
            : denied === "busy"
              ? t("deniedBusy")
              : denied === "unsupported"
                ? t("deniedUnsupported")
                : t("deniedOther")
        : now.step === "quiet"
          ? t(words.trial)
          : now.step === "listen"
            ? null
            : camera
              ? t("leadTrial")
              : t("leadTrialMic");

  /** The short status word of a checklist row. */
  function rowWord(id: (typeof rows)[number]["id"], state: (typeof rows)[number]["state"]) {
    if (id === "connection") return "mbps" in bandwidth ? (bandwidth.state === "ok" ? t("connShortOk") : t("connShortLow")) : bandwidth.state === "measuring" ? t("connMeasuring") : t("connShortUnknown");
    if (id === "microphone" && state === "done") return t("micHeard");
    return state === "done" ? t("ready") : state === "quiet" ? t("rowQuiet") : state === "active" ? t("now") : t("waiting");
  }

  const fix = permission === "denied" && (denied === "notAllowed" || denied === "other") ? splitFix(t(`fix${fixKeyFor(navigator.userAgent, navigator.maxTouchPoints ?? 0)}`)) : null;

  const left = (
    <div ref={body} className="space-y-6">
      <ul aria-label={t("rowsLabel")} className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {rows.map((row) => (
          <li key={row.id} aria-current={row.state === "active" ? "step" : undefined} className="flex min-h-12 items-center justify-between gap-4 px-4">
            <span className={cn("text-[16px] text-ink", row.state === "active" && "font-semibold")}>{t(`row${row.id}`)}</span>
            <span className="tnum text-[14px] text-muted">{rowWord(row.id, row.state)}</span>
          </li>
        ))}
      </ul>
      {bandwidth.state === "low" ? <p className="tnum text-[14px] leading-[22px] text-ink-2">{t("connLow", { mbps: formatMbps(bandwidth.mbps, locale) })}</p> : null}

      {now.step === "open" && denied !== "unsupported" ? (
        <p className="text-[16px] leading-[26px] text-ink-2">
          {camera ? t("cameraAsk") : t("micAsk")}
        </p>
      ) : null}

      {now.step === "denied" ? (
        <div className="space-y-4">
          {fix ? (
            <>
              <PathSteps locale={locale} steps={[{ title: fix.first, state: "current" }, { title: t("stepReload") }]} />
              <Disclosure label={t("stillNot")}>
                <div className="space-y-3">
                  {fix.rest ? <p className="text-[16px] leading-[26px] whitespace-pre-line text-ink-2">{fix.rest}</p> : null}
                  {reportControl("devices")}
                </div>
              </Disclosure>
            </>
          ) : (
            <>
              {denied === "unsupported" ? <p className="text-[16px] leading-[26px] text-ink-2">{t(unsupportedSteps(navigator.userAgent, navigator.maxTouchPoints ?? 0))}</p> : null}
              {reportControl("devices")}
            </>
          )}
        </div>
      ) : null}

      {now.step === "sound" || now.step === "trial" || now.step === "quiet" ? (
        <div className="space-y-3">
          <div role="meter" aria-label={t("micLevel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} className="h-2 w-full overflow-hidden rounded-full bg-hairline">
            <div className="h-2 rounded-full bg-accent transition-[width] duration-100 motion-reduce:transition-none" style={{ width: `${Math.min(100, Math.round(level * 250))}%` }} />
          </div>
          {/* Task 12 carry: the hint is said when it appears (polite), and never claims we listened when we could not. */}
          <p role="status" className="text-[16px] leading-[26px] text-ink-2">
            {heard ? t("micHeard") : quiet ? t(words.mic) : t("micHint")}
          </p>
          {quiet && !heard ? reportControl("quiet") : null}
          {recorderMissing ? (
            <div className="space-y-3">
              <p className="text-[16px] leading-[26px] font-medium text-ink">{t("noRecorder")}</p>
              {reportControl("recorder")}
            </div>
          ) : null}
          {trialFailed ? (
            <p role="alert" className="text-[14px] leading-[22px] text-ink">
              {t("failed")}
            </p>
          ) : null}
        </div>
      ) : null}

      {now.step === "listen" ? (
        <div className="space-y-3">
          {trial === "ready" ? <p className="text-[16px] leading-[26px] text-ink-2">{t("trialListen")}</p> : null}
          {!src && trial === "played" ? <p className="text-[16px] leading-[26px] text-ink-2">{t("playedBefore")}</p> : null}
          {!camera && src ? <audio key={src} src={src} controls aria-label={t("trialPlayback")} onPlay={played} className="h-12 w-full" /> : null}
          {/* Plan 2 kept the unheard microphone's hint and report open past the trial: it stays reachable here. */}
          {quiet && !heard ? (
            <div className="space-y-3">
              <p role="status" className="text-[16px] leading-[26px] text-ink-2">
                {t(words.mic)}
              </p>
              {reportControl("quiet")}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const pictureVisible = camera && permission !== "denied" && !(now.step === "listen" && src);
  const right = camera ? (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-canvas">
      {permission === "denied" ? (
        <div className="grid size-full place-items-center p-6">
          <Illustration name="permission" size="hero" />
        </div>
      ) : null}
      {now.step === "listen" && src ? (
        <video key={src} src={src} controls playsInline aria-label={t("trialPlayback")} onPlay={played} className="size-full bg-canvas object-cover" />
      ) : null}
      <video ref={preview} muted playsInline className={cn("size-full object-cover", !pictureVisible && "hidden")} />
      {pictureVisible ? <span className="absolute top-3 left-3 rounded-full bg-surface/90 px-3 py-1 text-[13px] leading-5 text-ink">{t("cameraPreview")}</span> : null}
      {pictureVisible && permission !== "granted" ? (
        <span className="absolute inset-0 grid place-items-center text-center">
          <span className="flex flex-col items-center gap-2 text-[14px] text-muted">
            <Camera className="size-8" strokeWidth={1.5} aria-hidden />
            {t("cameraLater")}
          </span>
        </span>
      ) : null}
    </div>
  ) : (
    <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl bg-canvas">
      {permission === "denied" ? <Illustration name="permission" size="hero" /> : <Mic className="size-12 text-muted" strokeWidth={1.5} aria-hidden />}
    </div>
  );

  const primary =
    now.primary === "open"
      ? { kind: "button" as const, id: "check-open", label: camera ? t("openDevices") : t("openMic"), busy: now.wait === "asking", busyLabel: t("asking"), onClick: () => void openDevices() }
      : now.primary === "retry"
        ? { kind: "button" as const, id: "check-retry", label: t("retry"), onClick: () => void openDevices() }
        : now.primary === "trial"
          ? {
              kind: "button" as const,
              id: "check-trial",
              label: trial === "none" ? t("trialStart") : t("trialAgain"),
              busy: trial === "recording",
              busyLabel: t("trialRecording"),
              waitReason: waitKey ? t(waitKey) : null,
              onClick: record,
            }
          : now.primary === "continue"
            ? { kind: "button" as const, id: "check-next", label: t("yesContinue"), busy, busyLabel: t("going"), waitReason: waitKey ? t(waitKey) : null, onClick: () => void proceed() }
            : null;

  return (
    <>
      <StepScreen layout="split" title={heading} titleRef={title} lead={lead ? <p>{lead}</p> : undefined} aside={left}>
        {right}
      </StepScreen>
      <StepFooter
        journey={journey}
        primary={primary}
        secondary={now.step === "listen" && !busy ? { kind: "button", id: "check-again", label: t("trialAgain"), onClick: record } : null}
        note={
          error ? (
            <p role="alert" className="text-[14px] text-ink">
              {error}
            </p>
          ) : null
        }
      />
    </>
  );
}
