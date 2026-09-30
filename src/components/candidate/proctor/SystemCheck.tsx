"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CandidateColumn } from "@/components/candidate/Shell";
import { MobileBlock, isMobileDevice } from "@/components/candidate/MobileBlock";
import { environmentFacts, useProctor } from "@/components/candidate/proctor/ProctorProvider";
import { apiSend, candidateApiBase } from "@/lib/client/api";
import { stepPath } from "@/lib/candidate-routes";
import { evaluateEnvironment } from "@/lib/proctor/environment";
import { requiredChecks, type CheckId, type ProctoringPolicy } from "@/lib/proctor/policy";
import type { CandidateState } from "@/lib/exam-flow";
import { useT, type TypedT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * The system check. Early validation instead of late rescue: every device and
 * permission the exam needs is proved here, one row at a time, before the
 * clock of the first section can start. Each row has its own small action;
 * the screen has one filled button, and it stays off until every required row
 * is green, saying which row it waits for.
 */

type RowStatus = "waiting" | "active" | "ok" | "warn" | "fail";
type RowId = CheckId | "QUIET";

export function SystemCheck({ token, policy }: { token: string; policy: ProctoringPolicy }) {
  const router = useRouter();
  const t = useT("check");
  const { engine, snap } = useProctor();
  const [mobile, setMobile] = useState(false);
  const [bandwidth, setBandwidth] = useState<{ state: "measuring" | "ok" | "low" | "unknown"; mbps?: string }>({ state: "measuring" });
  const [quiet, setQuiet] = useState<"idle" | "working" | "done">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problemSent, setProblemSent] = useState(false);
  const previewRef = useRef<HTMLVideoElement | null>(null);

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

  // The preview shows the same stream the engine records.
  useEffect(() => {
    if (previewRef.current && engine?.cameraStream && previewRef.current.srcObject !== engine.cameraStream) {
      previewRef.current.srcObject = engine.cameraStream;
      void previewRef.current.play().catch(() => undefined);
    }
  }, [engine, snap?.camera]);

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

  const checks = requiredChecks(policy);
  const rows: Array<{ id: RowId; required: boolean }> = [];
  for (const c of checks) {
    rows.push(c);
    if (c.id === "MICROPHONE" && policy.aiSignals.voice) rows.push({ id: "QUIET", required: true });
  }

  function statusOf(id: RowId): RowStatus {
    if (!snap) return "waiting";
    switch (id) {
      case "BROWSER":
        return env && env.blockers.filter((b) => b !== "SECOND_SCREEN").length === 0 ? "ok" : "fail";
      case "SINGLE_SCREEN":
        if (snap.isExtended === true) return policy.secondScreen === "BLOCK_AT_CHECK" ? "fail" : "warn";
        return snap.isExtended === false ? "ok" : "warn";
      case "CAMERA":
        return snap.camera === "ok" ? "ok" : snap.camera === "denied" || snap.camera === "lost" ? "fail" : "active";
      case "MICROPHONE":
        return snap.mic === "ok" ? "ok" : snap.mic === "denied" ? "fail" : "active";
      case "QUIET":
        return quiet === "done" ? "ok" : "active";
      case "FACE":
        if (snap.model === "unavailable") return "warn";
        if (snap.model !== "ready") return "active";
        return snap.faces === 1 ? "ok" : snap.faces === null ? "active" : "fail";
      case "SCREEN_SHARE":
        return snap.screen === "ok" ? "ok" : snap.screen === "denied" || snap.screen === "lost" ? "fail" : "active";
      case "CONNECTION":
        return bandwidth.state === "measuring" ? "active" : bandwidth.state === "ok" ? "ok" : "warn";
    }
  }

  // Rows open in order: a row waits while a required row above it is not done.
  const firstOpen = rows.findIndex((r) => r.required && !["ok", "warn"].includes(statusOf(r.id)));
  const blocking = rows.find((r) => r.required && statusOf(r.id) !== "ok" && !(r.id === "FACE" && statusOf(r.id) === "warn") && !(r.id === "SINGLE_SCREEN" && statusOf(r.id) === "warn"));

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
      setError(err instanceof Error ? err.message : t("startFailed"));
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

  if (mobile && (policy.screenShare || policy.camera)) return <MobileBlock token={token} />;

  const label: Record<RowId, string> = {
    BROWSER: t("browser"),
    SINGLE_SCREEN: t("singleScreen"),
    CAMERA: t("camera"),
    MICROPHONE: t("camera"),
    QUIET: t("quiet"),
    FACE: t("face"),
    SCREEN_SHARE: t("screen"),
    CONNECTION: t("connection"),
  };

  return (
    <CandidateColumn width={720}>
      <h1 className="text-[26px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{t("title")}</h1>
      <p className="mt-2 text-sm leading-[1.6] text-muted">{t("body")}</p>

      <ol className="mt-7 flex flex-col gap-2.5">
        {rows
          // Camera and microphone are one permission, so one row.
          .filter((r) => r.id !== "MICROPHONE" || !rows.some((x) => x.id === "CAMERA"))
          .map((row, index) => {
            const status = statusOf(row.id);
            const locked = firstOpen >= 0 && index > firstOpen && row.required && status !== "ok";
            return (
              <li
                key={row.id}
                className={cn(
                  "rounded-[10px] border bg-surface px-[18px] py-3.5",
                  status === "fail" ? "border-line-strong" : "border-line",
                  locked && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Dot status={locked ? "waiting" : status} />
                    <span className="text-sm font-semibold text-ink">{label[row.id]}</span>
                  </div>
                  {!locked ? (
                    <RowAction id={row.id} status={status} engineReady={!!snap?.ready} quiet={quiet} t={t} onQuiet={async () => {
                      if (!engine) return;
                      setQuiet("working");
                      await engine.calibrateQuiet();
                      setQuiet("done");
                    }} onCamera={() => void engine?.startCamera()} onScreen={() => void engine?.startScreen()} />
                  ) : (
                    <span className="text-[12.5px] text-muted">{t("waiting")}</span>
                  )}
                </div>
                {!locked ? (
                  <RowDetail
                    id={row.id}
                    status={status}
                    t={t}
                    snap={snap}
                    bandwidth={bandwidth}
                    previewRef={previewRef}
                  />
                ) : null}
              </li>
            );
          })}
      </ol>

      <button
        type="button"
        onClick={begin}
        disabled={!!blocking || busy || !snap?.ready}
        aria-describedby="begin-why"
        className="mt-7 h-12 w-full rounded-[10px] bg-accent text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
      >
        {busy ? t("starting") : t("cta")}
      </button>
      {blocking ? (
        <p id="begin-why" className="mt-[9px] text-center text-[12.5px] text-muted">
          {t("ctaWaiting", { row: label[blocking.id] })}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-center text-[13px] text-danger">{error}</p> : null}
      <p className="mt-5 text-center text-[12.5px] text-ink-3">
        {problemSent ? (
          t("problemSent")
        ) : (
          <button type="button" onClick={reportProblem} className="underline decoration-line-strong underline-offset-2">
            {t("reportProblem")}
          </button>
        )}
      </p>
    </CandidateColumn>
  );
}

function Dot({ status }: { status: RowStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 rounded-full",
        status === "ok" && "bg-accent",
        status === "active" && "bg-ink-3",
        status === "warn" && "bg-ink-3",
        status === "fail" && "bg-danger",
        status === "waiting" && "bg-line-strong",
      )}
    />
  );
}

type T = TypedT<"check">;

function RowAction({
  id,
  status,
  engineReady,
  quiet,
  t,
  onCamera,
  onScreen,
  onQuiet,
}: {
  id: RowId;
  status: RowStatus;
  engineReady: boolean;
  quiet: "idle" | "working" | "done";
  t: T;
  onCamera: () => void;
  onScreen: () => void;
  onQuiet: () => void;
}) {
  const cls =
    "h-8 rounded-[8px] border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:text-muted";
  if (id === "CAMERA" && status !== "ok")
    return (
      <button type="button" className={cls} onClick={onCamera} disabled={!engineReady}>
        {t("cameraAction")}
      </button>
    );
  if (id === "SCREEN_SHARE" && status !== "ok")
    return (
      <button type="button" className={cls} onClick={onScreen} disabled={!engineReady}>
        {t("screenAction")}
      </button>
    );
  if (id === "QUIET" && quiet !== "done")
    return (
      <button type="button" className={cls} onClick={onQuiet} disabled={quiet === "working"}>
        {quiet === "working" ? t("quietWorking") : t("quietAction")}
      </button>
    );
  return null;
}

function RowDetail({
  id,
  status,
  t,
  snap,
  bandwidth,
  previewRef,
}: {
  id: RowId;
  status: RowStatus;
  t: T;
  snap: ReturnType<typeof useProctor>["snap"];
  bandwidth: { state: string; mbps?: string };
  previewRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const [fix, setFix] = useState(false);
  const line = (text: string) => <p className="mt-1.5 pl-[18px] text-[13px] leading-[1.55] text-muted">{text}</p>;
  switch (id) {
    case "BROWSER":
      return line(status === "ok" ? t("browserOk") : t("browserBad"));
    case "SINGLE_SCREEN":
      return line(snap?.isExtended === true ? t("singleExtended") : snap?.isExtended === false ? t("singleOk") : t("singleUnknown"));
    case "CAMERA":
      return (
        <div className="pl-[18px]">
          {status === "fail" ? (
            <p className="mt-1.5 text-[13px] leading-[1.55] text-muted">{t("cameraDenied")}</p>
          ) : status === "ok" ? (
            <p className="mt-1.5 text-[13px] leading-[1.55] text-muted">{t("cameraOk")}</p>
          ) : snap?.camera === "asking" ? (
            <p className="mt-1.5 text-[13px] font-medium leading-[1.55] text-ink">{t("permissionWaiting")}</p>
          ) : null}
          <div className={cn("mt-2.5 flex items-center gap-4", status !== "ok" && "hidden")}>
            <video ref={previewRef} muted playsInline className="h-[120px] w-[160px] rounded-[8px] bg-ink object-cover" />
            <MicMeter level={snap?.micLevel ?? 0} />
          </div>
        </div>
      );
    case "QUIET":
      return status === "ok" ? line(t("quietOk")) : null;
    case "FACE":
      if (snap?.model === "unavailable") return line(t("faceModelDown"));
      if (snap?.model !== "ready") return line(t("faceLoading"));
      return line(snap.faces === 1 ? t("faceOk") : (snap.faces ?? 0) > 1 ? t("faceMany") : t("faceNone"));
    case "SCREEN_SHARE":
      return (
        <div>
          {line(
            status === "ok"
              ? t("screenOk")
              : snap?.surface === "WRONG_SURFACE"
                ? t("screenWrong")
                : snap?.screen === "asking"
                  ? t("screenPicking")
                : status === "fail"
                  ? t("screenDenied")
                  : t("screenHint"),
          )}
          {status === "fail" ? (
            <div className="pl-[18px]">
              <button type="button" onClick={() => setFix((v) => !v)} className="mt-1.5 text-[12.5px] font-semibold text-ink underline decoration-underline underline-offset-2">
                {t("howToFix")}
              </button>
              {fix ? <p className="mt-1.5 text-[13px] leading-[1.55] text-muted">{t("macosScreen")}</p> : null}
            </div>
          ) : null}
        </div>
      );
    case "CONNECTION":
      return line(
        bandwidth.state === "measuring"
          ? t("connMeasuring")
          : bandwidth.state === "ok"
            ? t("connOk", { mbps: bandwidth.mbps ?? "" })
            : bandwidth.state === "low"
              ? t("connLow", { mbps: bandwidth.mbps ?? "" })
              : t("connUnknown"),
      );
    default:
      return null;
  }
}

function MicMeter({ level }: { level: number }) {
  const bars = 12;
  const lit = Math.round(Math.min(1, level * 4) * bars);
  return (
    <div className="flex h-6 items-end gap-[3px]" aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className={cn("w-[5px] rounded-[2px]", i < lit ? "bg-accent" : "bg-line")} style={{ height: `${6 + i * 1.5}px` }} />
      ))}
    </div>
  );
}
