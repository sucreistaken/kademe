"use client";

import type { ReactNode } from "react";
import { Check, RotateCcw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCountdown } from "@/lib/timer";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";
import { litBars, SPEAKING_STEPS, speakingStepState, timeLeftFraction, type SpeakingPhase } from "./speaking-flow";

/**
 * The recorder of a speaking question, drawn from its state alone: no
 * recorder, no request, no camera of its own. MediaItems drives it for the
 * exam; the tutorial's demo stage drives the same panel from its script, so
 * the demo draws exactly what the exam shows. `press` marks the panel's
 * button as the point the tutorial's cursor presses (data-demo-press).
 *
 * One panel, one step at a time: three steps on top (prepare, speak, saved),
 * the camera and the clock under them, and ONE large button for the step the
 * student is in. The camera picture is passed in (`video`), so the exam can
 * show the live camera and the demo a drawing.
 */

/** The camera picture of a speaking task (the exam puts the live camera in it). */
export const SPEAKING_VIDEO = "aspect-[4/3] w-full rounded-[14px] bg-ink object-cover";

const RING_SIZE = 124;
const RING_STROKE = 10;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_R;
const METER_BARS = 12;

const BIG_BUTTON = "h-14 w-full text-[17px]";

function Steps({ phase }: { phase: SpeakingPhase }) {
  const t = useT("exam");
  const labels = { prepare: t("speakingStepPrepare"), speak: t("speakingStepSpeak"), saved: t("speakingStepSaved") };
  return (
    <ol aria-label={t("speakingSteps")} className="flex flex-wrap items-center gap-y-2">
      {SPEAKING_STEPS.map((id, i) => {
        const state = speakingStepState(phase, i);
        return (
          <li key={id} data-step={id} data-state={state} aria-current={state === "active" ? "step" : undefined} className="flex items-center">
            {i > 0 ? <span aria-hidden className={cn("mx-2.5 h-0.5 w-6 rounded-full", state === "todo" ? "bg-line" : "bg-accent")} /> : null}
            <span
              aria-hidden
              className={cn(
                "tnum grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-extrabold",
                state === "done" && "bg-accent text-white",
                state === "active" && "bg-brand text-on-brand",
                state === "todo" && "bg-line text-ink-3",
              )}
            >
              {state === "done" ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("ms-2 text-[15px] leading-none", state === "active" ? "font-bold text-ink" : state === "done" ? "font-semibold text-ink-2" : "font-semibold text-muted")}>
              {labels[id]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The clock: a ring that empties as the time runs out, the time in its middle. */
function Clock({ label, leftMs, totalMs }: { label: string; leftMs: number; totalMs: number }) {
  const fraction = timeLeftFraction(leftMs, totalMs);
  const center = RING_SIZE / 2;
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[15px] font-bold text-ink-2">{label}</p>
      <div className="relative grid shrink-0 place-items-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg aria-hidden viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="absolute inset-0 -rotate-90">
          <circle cx={center} cy={center} r={RING_R} fill="none" strokeWidth={RING_STROKE} className="stroke-line" />
          <circle
            cx={center}
            cy={center}
            r={RING_R}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - fraction)}
            className="stroke-accent motion-safe:transition-[stroke-dashoffset] motion-safe:duration-200 motion-safe:ease-linear"
          />
        </svg>
        <span role="timer" aria-label={label} className="tnum relative text-[38px] font-extrabold leading-none text-ink">
          {formatCountdown(leftMs)}
        </span>
      </div>
    </div>
  );
}

/** The microphone level while recording: twelve bars, the lit ones follow the voice. */
function LevelMeter({ level, label }: { level: number; label: string }) {
  const lit = litBars(level, METER_BARS);
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, level * 4) * 100)} className="flex h-6 items-end gap-[3px]">
      {Array.from({ length: METER_BARS }, (_, i) => (
        <span key={i} aria-hidden className={cn("w-[5px] rounded-[2px]", i < lit ? "bg-accent" : "bg-line")} style={{ height: `${6 + i * 1.5}px` }} />
      ))}
    </div>
  );
}

export function SpeakingPanel({
  phase,
  leftMs,
  totalMs,
  video,
  micLevel = null,
  retakesLeft = 0,
  onStart,
  onStop,
  onRetake,
  notice,
  fallback,
  press = false,
}: {
  phase: SpeakingPhase;
  /** The running phase's time left (preparation or speaking). */
  leftMs: number;
  /** That phase's whole length, for the ring. */
  totalMs: number;
  /** The camera picture (a live <video> in the exam). */
  video: ReactNode;
  /** The microphone's peak level (0 to 1) while it can be read; null when it cannot. */
  micLevel?: number | null;
  /** Takes left after a recording; the retake button shows only above 0. */
  retakesLeft?: number;
  onStart?: () => void;
  onStop?: () => void;
  onRetake?: () => void;
  /** Why the camera or recording failed, said in full. */
  notice?: ReactNode;
  /** What the student may do instead (type the answer); shown with a failure. */
  fallback?: ReactNode;
  press?: boolean;
}) {
  const t = useT("exam");
  const recording = phase === "RECORDING";
  // The words a screen reader hears when the phase changes (the visible words are in the panel).
  const announce = recording ? t("speakingRecording") : phase === "UPLOADING" ? t("saving") : phase === "DONE" ? t("recorded") : "";
  return (
    // No min-h-0: the panel grows into the free height but never shrinks below its content (the column scrolls instead).
    <div data-speaking-phase={phase} className="flex flex-col gap-4 rounded-[22px] border-2 border-line bg-surface p-4 lg:flex-1">
      <Steps phase={phase} />

      <div className="grid flex-1 items-center gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="relative mx-auto w-full max-w-[260px]">
          {video}
          {recording ? (
            // The one place red is allowed: the recording dot, on the camera picture where a recording light belongs.
            <p className="absolute start-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-2.5 py-1 text-[12.5px] font-bold text-white">
              <span aria-hidden className="size-2.5 rounded-full bg-danger motion-safe:animate-pulse" />
              {t("speakingRecording")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          {phase === "THINKING" ? <Clock label={t("speakingPrepareLabel")} leftMs={leftMs} totalMs={totalMs} /> : null}
          {recording ? (
            <>
              <Clock label={t("speakingSpeakLabel")} leftMs={leftMs} totalMs={totalMs} />
              {micLevel !== null ? <LevelMeter level={micLevel} label={t("speakingMic")} /> : null}
            </>
          ) : null}
          {phase === "UPLOADING" ? (
            <p className="flex items-center gap-2 text-[16px] font-semibold text-ink-2">
              <Spinner aria-hidden className="size-5" role={undefined} aria-label={undefined} />
              {t("saving")}
            </p>
          ) : null}
          {phase === "DONE" ? (
            <>
              <span aria-hidden className="grid size-14 place-items-center rounded-full bg-accent text-white">
                <Check className="size-8" strokeWidth={3} />
              </span>
              <p className="text-[19px] font-extrabold text-ink">{t("speakingSavedTitle")}</p>
              <p className="max-w-[220px] text-[14px] leading-[1.45] text-ink-2">{t("speakingSavedHint")}</p>
            </>
          ) : null}
          {phase === "FAILED" ? <p className="max-w-[220px] text-[16px] font-semibold leading-[1.4] text-ink">{t("speakingFailed")}</p> : null}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      {phase === "THINKING" ? (
        <>
          <button type="button" data-demo-press={press ? "" : undefined} onClick={onStart} className={cn(buttonVariants({ variant: "primary", size: "lg" }), BIG_BUTTON)}>
            {t("speakingStart")}
          </button>
          <p className="-mt-1 text-center text-[13px] leading-[1.4] text-ink-2">{t("speakingPrepareHint")}</p>
        </>
      ) : null}
      {recording ? (
        <button type="button" data-demo-press={press ? "" : undefined} onClick={onStop} className={cn(buttonVariants({ variant: "primary", size: "lg" }), BIG_BUTTON)}>
          {t("stopRecording")}
        </button>
      ) : null}
      {phase === "DONE" && retakesLeft > 0 ? (
        <button type="button" onClick={onRetake} className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-12 w-full text-[15px]")}>
          <RotateCcw aria-hidden className="size-4" strokeWidth={2.25} />
          {t("retake", { n: retakesLeft })}
        </button>
      ) : null}
      {notice}
      {fallback}
    </div>
  );
}
