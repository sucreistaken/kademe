"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CandidateColumn } from "@/components/candidate/Shell";
import { MobileBlock, isMobileDevice } from "@/components/candidate/MobileBlock";
import { environmentFacts, useProctor } from "@/components/candidate/proctor/ProctorProvider";
import { checkStep, planSteps, primaryEnabled, type CheckStep, type StepState, type Wait } from "@/components/candidate/proctor/check-steps";
import { buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Mascot, type MascotPose } from "@/components/visual/mascot";
import { apiSend, candidateApiBase } from "@/lib/client/api";
import { MEDIA_ERROR_KEY, mediaErrorKind } from "@/lib/client/media-error";
import { stepPath } from "@/lib/candidate-routes";
import { evaluateEnvironment } from "@/lib/proctor/environment";
import type { ProctoringPolicy } from "@/lib/proctor/policy";
import type { CandidateState } from "@/lib/exam-flow";
import { useT, type TypedT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * The system check, as a guided flow: one screen, one sentence, one big
 * button that is the next real action. Which screen is shown, and when the
 * button may be pressed, is decided by check-steps.ts (tested); what blocks
 * the start is exactly what the old checklist's rows blocked. Browser, single
 * screen and connection checks run in the background and speak only when they
 * fail.
 */

type T = TypedT<"examCheck">;

const POSE: Record<CheckStep, MascotPose> = { devices: "wave", look: "think", screen: "think", ready: "wave", blocked: "think" };

export function SystemCheck({ token, policy }: { token: string; policy: ProctoringPolicy }) {
  const router = useRouter();
  const t = useT("examCheck");
  const f = useT("examFlow");
  const cw = useT("cheatWarning");
  const { engine, snap } = useProctor();
  const [mobile, setMobile] = useState(false);
  const [bandwidth, setBandwidth] = useState<{ state: "measuring" | "ok" | "low" | "unknown"; mbps?: string }>({ state: "measuring" });
  const [quiet, setQuiet] = useState<"idle" | "working" | "done">("idle");
  const [lookConfirmed, setLookConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problemSent, setProblemSent] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const quietStarted = useRef(false);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const shownStep = useRef<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobile(isMobileDevice());
  }, []);

  useEffect(() => {
    if (engine && !engine.snapshot.ready) void engine.start(environmentFacts()).catch(() => setError(t("startFailed")));
  }, [engine, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bytes = new Uint8Array(512 * 1024);
        crypto.getRandomValues(bytes.subarray(0, 65536));
        const t0 = performance.now();
        await fetch(`${candidateApiBase(token)}/bandwidth`, { method: "POST", body: bytes });
        const secs = (performance.now() - t0) / 1000;
        const mbps = (bytes.byteLength * 8) / 1_000_000 / Math.max(secs, 0.01);
        if (!cancelled) setBandwidth({ state: mbps >= 2 ? "ok" : "low", mbps: mbps.toFixed(1) });
      } catch {
        if (!cancelled) setBandwidth({ state: "unknown" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // The preview shows the same stream the engine records. A callback ref, because the video only exists on one step.
  const cameraStream = engine?.cameraStream ?? null;
  const previewRef = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el && cameraStream && el.srcObject !== cameraStream) {
        el.srcObject = cameraStream;
        void el.play().catch(() => undefined);
      }
    },
    [cameraStream],
  );

  // Face detection starts by itself once the camera is on.
  useEffect(() => {
    if (engine && snap?.camera === "ok" && snap.model === "off") void engine.startVision();
  }, [engine, snap?.camera, snap?.model]);

  const env = useMemo(() => {
    if (typeof window === "undefined") return null;
    const brands = (navigator as Navigator & { userAgentData?: { brands?: Array<{ brand: string }> } }).userAgentData?.brands ?? [];
    return evaluateEnvironment(
      {
        mobile: isMobileDevice(),
        getDisplayMedia: !!navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices,
        isExtendedSupported: "isExtended" in window.screen,
        isExtended: snap?.isExtended ?? null,
        fullscreenEnabled: !!document.fullscreenEnabled,
        mediaRecorder: typeof MediaRecorder !== "undefined",
        wasm: typeof WebAssembly !== "undefined",
        chromium: brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand)),
      },
      policy,
    );
  }, [policy, snap?.isExtended]);

  const plan = useMemo(() => planSteps(policy), [policy]);
  const result = checkStep(plan, {
    // The old BROWSER row: any blocker except the second screen (its own rule below). Until the browser is read, the start waits.
    ready: !!snap?.ready && env !== null,
    browserBlocked: env ? env.blockers.some((b) => b !== "SECOND_SCREEN") : false,
    secondScreenBlocks: policy.secondScreen === "BLOCK_AT_CHECK",
    isExtended: snap?.isExtended ?? null,
    camera: snap?.camera ?? "idle",
    mic: snap?.mic ?? "idle",
    model: snap?.model ?? "off",
    faces: snap?.faces ?? null,
    quiet,
    screen: snap?.screen ?? "idle",
    surface: snap?.surface ?? null,
    lookConfirmed,
  } satisfies StepState);

  // The room is measured by itself when the look step opens (3 seconds); the student only sees a sentence.
  const measuring = result.step === "look" && plan.quiet && snap?.mic === "ok";
  useEffect(() => {
    if (!engine || !measuring || quietStarted.current) return;
    quietStarted.current = true;
    setQuiet("working");
    void engine
      .calibrateQuiet()
      .catch(() => null)
      .then(() => setQuiet("done"));
  }, [engine, measuring]);

  // A new screen (or a new problem on it) takes focus, so the one sentence is read.
  const screenKey = `${result.step}:${result.issue ?? ""}`;
  useEffect(() => {
    if (shownStep.current !== null && shownStep.current !== screenKey) titleRef.current?.focus();
    shownStep.current = screenKey;
  }, [screenKey]);

  async function begin() {
    if (!engine) return;
    setBusy(true);
    setError(null);
    try {
      if (policy.fullscreen) await engine.enterFullscreen();
      if (policy.camera) await engine.captureWebcam("REFERENCE");
      await engine.flush();
      const next = await apiSend<CandidateState>(token, "/device-check", {});
      engine.arm();
      router.push(stepPath(token, next));
    } catch (err) {
      // Camera and fullscreen refusals are the browser's English text: say them in the student's language.
      // A server refusal (it carries a code) already comes in the student's language.
      const kind = mediaErrorKind(err);
      const fromApi = err instanceof Error && typeof (err as { code?: unknown }).code === "string";
      setError(kind !== "generic" ? f(MEDIA_ERROR_KEY[kind]) : fromApi ? (err as Error).message : t("startFailed"));
      setBusy(false);
    }
  }

  async function reportProblem() {
    try {
      await apiSend(token, "/problem", { area: "SYSTEM_CHECK", message: `camera=${snap?.camera} screen=${snap?.screen} model=${snap?.model} err=${snap?.error}` });
      setProblemSent(true);
    } catch {
      setProblemSent(false);
    }
  }

  async function press() {
    // The second-screen permission is asked on the first click (the browser needs a click for its prompt).
    if (engine && policy.secondScreen !== "OFF" && engine.snapshot.windowManagement === "idle") {
      setBusy(true);
      try {
        await engine.requestWindowManagement();
      } finally {
        setBusy(false);
      }
    }
    switch (result.primary) {
      case "open":
      case "retry":
        if (result.step === "screen") void engine?.startScreen();
        else void engine?.startCamera();
        break;
      case "share":
        void engine?.startScreen();
        break;
      case "continue":
        setLookConfirmed(true);
        break;
      case "start":
        void begin();
        break;
    }
  }

  if (mobile && (policy.screenShare || policy.camera)) return <MobileBlock token={token} need={{ camera: policy.camera, screenShare: policy.screenShare }} />;

  const isIssue = result.issue !== null || result.step === "blocked";
  const enabled = primaryEnabled(result) && !busy;
  const extendedNote = snap?.isExtended === true && policy.secondScreen === "WARN";
  const sentence = sentenceFor(result.step, result.wait, result.issue, t);
  const notes: string[] = [];
  if (result.step === "look" && snap?.model === "unavailable") notes.push(t("faceModelDown"));
  const askWindow = policy.secondScreen !== "OFF" && snap?.windowManagement === "idle" && result.step === plan.steps[0];
  if (policy.secondScreen !== "OFF" && result.step === "ready") {
    if (snap?.windowManagement === "denied") notes.push(cw("windowDenied"));
    else if (snap?.windowManagement === "unsupported" && snap.isExtended === null) notes.push(cw("windowUnsupported"));
  }
  if (result.step === "ready") {
    if (bandwidth.state === "low") notes.push(t("connLow", { mbps: bandwidth.mbps ?? "" }));
    if (extendedNote) notes.push(t("singleExtended"));
  }

  const title: Record<CheckStep, string> = {
    devices: t("devicesTitle"),
    look: t("lookTitle"),
    screen: t("screenTitle"),
    ready: t("readyTitle"),
    blocked: result.wait === "secondScreen" ? t("blockedSecondScreenTitle") : t("blockedBrowserTitle"),
  };
  const label =
    result.primary === "retry"
      ? t("retry")
      : result.primary === "continue"
        ? t("lookAction")
        : result.primary === "share"
          ? t("screenAction")
          : result.primary === "start"
            ? busy
              ? t("starting")
              : t("cta")
            : t("devicesAction");

  return (
    <CandidateColumn width={640}>
      <div className="flex flex-col items-center text-center">
        {result.index !== null && result.total > 1 ? <Progress plan={plan.steps} current={result.index} t={t} /> : null}

        <Mascot pose={POSE[result.step]} size="small" className="mt-5" />
        <h1 ref={titleRef} tabIndex={-1} className="mt-4 text-[30px] leading-[38px] font-extrabold tracking-[-0.01em] text-ink outline-none">
          {title[result.step]}
        </h1>
        {result.step === "devices" && !isIssue ? <p className="mt-2 text-[17px] leading-[26px] text-ink-2">{t("devicesLead")}</p> : null}
        {result.step === "look" && !sentence ? <p className="mt-2 text-[17px] leading-[26px] text-ink-2">{t("lookLead")}</p> : null}
        {result.step === "screen" && !isIssue ? <p className="mt-2 text-[17px] leading-[26px] text-ink-2">{t("screenLead")}</p> : null}
        {result.step === "ready" ? <p className="mt-2 text-[17px] leading-[26px] text-ink-2">{t("readyLead")}</p> : null}

        {result.step === "look" && plan.look && policy.camera ? (
          <div className="mt-4 flex items-center gap-5">
            <video ref={previewRef} muted playsInline aria-label={t("previewLabel")} className="h-[135px] w-[180px] -scale-x-100 rounded-[14px] bg-ink object-cover" />
            {policy.microphone ? <MicMeter level={snap?.micLevel ?? 0} label={t("micLevel")} /> : null}
          </div>
        ) : null}
        {result.step === "screen" && !isIssue ? <PickerHint t={t} /> : null}
        {result.step === "ready" ? <Rules policy={policy} t={t} /> : null}

        {sentence ? (
          isIssue ? (
            <Notice role="alert" className="mt-6 max-w-[520px] text-[16px] leading-[25px]">
              {sentence}
            </Notice>
          ) : (
            <p role="status" className="mt-6 max-w-[520px] text-[16px] font-semibold leading-[25px] text-ink">
              {sentence}
            </p>
          )
        ) : result.step === "look" ? (
          <p role="status" className="mt-6 text-[16px] font-semibold text-ink">
            {t("lookOk")}
          </p>
        ) : null}
        {notes.map((n) => (
          <p key={n} className="mt-3 max-w-[520px] text-[14px] leading-[22px] text-muted">
            {n}
          </p>
        ))}

        {askWindow ? <p className="mt-4 max-w-[520px] text-[14px] leading-[22px] text-muted">{cw("windowWhy")}</p> : null}

        {result.primary ? (
          <button
            type="button"
            onClick={() => void press()}
            disabled={!enabled}
            className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-6 h-14 w-full max-w-[420px] px-6 text-[17px]")}
          >
            {result.wait === "preparing" ? t("preparing") : label}
          </button>
        ) : null}
        {result.step === "screen" && result.issue === "screenDenied" ? (
          <div className="mt-3 max-w-[520px]">
            <button type="button" onClick={() => setFixOpen((v) => !v)} className="text-[14px] font-semibold text-ink underline decoration-underline underline-offset-2">
              {t("howToFix")}
            </button>
            {fixOpen ? <p className="mt-2 text-[14px] leading-[22px] text-muted">{t("macosScreen")}</p> : null}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 max-w-[520px] text-[14px] text-danger">
            {error}
          </p>
        ) : null}

        <p className="mt-5 text-[14px] text-ink-3">
          {problemSent ? (
            t("problemSent")
          ) : (
            <button type="button" onClick={reportProblem} className={isIssue || error ? cn(buttonVariants({ variant: "secondary", size: "md" }), "text-ink") : "underline decoration-line-strong underline-offset-2"}>
              {t("reportProblem")}
            </button>
          )}
        </p>
      </div>
    </CandidateColumn>
  );
}

/** The one sentence the student needs now: what is being waited for, or what went wrong and how to fix it. */
function sentenceFor(step: CheckStep, wait: Wait | null, issue: string | null, t: T): string | null {
  if (issue === "denied") return t("denied");
  if (issue === "lost") return t("lost");
  if (issue === "unsupported") return t("unsupported");
  if (issue === "wrongSurface") return t("screenWrong");
  if (issue === "screenDenied") return t("screenDenied");
  switch (wait) {
    case "asking":
      return t("devicesAsking");
    case "pickScreen":
      return t("screenPicking");
    case "faceLoading":
      return t("faceLoading");
    case "faceNone":
      return t("faceNone");
    case "faceMany":
      return t("faceMany");
    case "quietWorking":
      return t("quietWorking");
    case "browser":
      return t("blockedBrowser");
    case "secondScreen":
      return t("blockedSecondScreen");
    default:
      return step === "devices" ? t("devicesHint") : null;
  }
}

function Progress({ plan, current, t }: { plan: Array<Exclude<CheckStep, "blocked">>; current: number; t: T }) {
  const names = { devices: t("stepDevices"), look: t("stepLook"), screen: t("stepScreen"), ready: t("stepReady") } as const;
  return (
    <nav aria-label={t("stepsLabel")} className="w-full">
      <p className="text-[14px] font-bold text-accent">{t("stepOf", { n: current, total: plan.length })}</p>
      <ol className="mt-3 flex items-start justify-center gap-2">
        {plan.map((id, i) => {
          const state = i + 1 < current ? "done" : i + 1 === current ? "now" : "next";
          return (
            <li key={id} aria-current={state === "now" ? "step" : undefined} className="flex w-[130px] flex-col items-center gap-1.5">
              <span className={cn("h-1.5 w-full rounded-full", state === "next" ? "bg-line" : "bg-accent")} />
              <span className={cn("text-[12.5px] leading-[17px]", state === "now" ? "font-bold text-ink" : "text-muted")}>{names[id]}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A tiny picture of the browser's share window with "Tüm ekran" lit, so the student knows what to click. */
function PickerHint({ t }: { t: T }) {
  const tiles = [
    { key: "pickEntire", on: true },
    { key: "pickWindow", on: false },
    { key: "pickTab", on: false },
  ] as const;
  return (
    <div className="mt-6 flex flex-col items-center gap-2" aria-hidden>
      <div className="flex gap-3 rounded-[16px] border-2 border-line bg-surface p-3">
        {tiles.map((x) => (
          <div
            key={x.key}
            className={cn("flex w-[110px] flex-col items-center gap-2 rounded-[10px] border-2 px-2 py-3", x.on ? "border-accent bg-accent-soft" : "border-line opacity-60")}
          >
            <span className={cn("block h-9 w-14 rounded-[5px] border-2", x.on ? "border-accent bg-accent/20" : "border-line-strong")} />
            <span className={cn("text-[12.5px]", x.on ? "font-bold text-ink" : "text-muted")}>{t(x.key)}</span>
          </div>
        ))}
      </div>
      <p className="text-[14px] font-bold text-accent">{t("screenHint")}</p>
    </div>
  );
}

function Rules({ policy, t }: { policy: ProctoringPolicy; t: T }) {
  const rules = [
    policy.fullscreen ? t("ruleFullscreen") : null,
    policy.secondScreen !== "OFF" ? t("ruleOneScreen") : null,
    t("ruleTab"),
  ].filter((r): r is string => r !== null);
  return (
    <ul className="mt-6 flex w-full max-w-[460px] flex-col gap-2.5 text-left">
      {rules.map((r) => (
        <li key={r} className="flex items-start gap-3 rounded-[14px] bg-mint-soft px-4 py-3 text-[16px] leading-[24px] text-ink">
          <span aria-hidden className="mt-[9px] size-2 shrink-0 rounded-full bg-accent" />
          {r}
        </li>
      ))}
    </ul>
  );
}

function MicMeter({ level, label }: { level: number; label: string }) {
  const bars = 12;
  const lit = Math.round(Math.min(1, level * 4) * bars);
  return (
    <div className="flex h-8 items-end gap-[3px]" role="img" aria-label={label}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className={cn("w-[5px] rounded-[2px]", i < lit ? "bg-accent" : "bg-line")} style={{ height: `${8 + i * 2}px` }} />
      ))}
    </div>
  );
}
