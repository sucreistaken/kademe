"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Captions, CaptionsOff, Pause, Play, RotateCcw, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";
import { DemoStage, STAGE_H, STAGE_W } from "./DemoStage";
import type { TutorialScript } from "./script-types";
import { createClipRegistry } from "./audio-refs";
import { formatPlayTime, stateAtTimeline, stepIndexAt } from "./timeline";
import { useTutorial } from "./use-tutorial";

/**
 * The "how it works" player: a dialog with the demo stage, the captions and
 * the controls (play and pause with Space, watch again, close, a progress bar
 * with a tick per step that seeks to the start of a step, the time). Each step
 * has its own narration file; the clock drives the stage and each step's audio
 * starts with its step, so pausing or seeking keeps both together. Without a
 * file a step is timed from its caption and plays as captions only.
 */

const CONTROL = cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-11 shrink-0 gap-2 px-4 text-[15px]");
const ICON_CONTROL = cn(buttonVariants({ variant: "secondary", size: "lg" }), "size-11 shrink-0 p-0");

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);
  return reduced;
}

export function TutorialPlayer({
  script,
  open,
  onOpenChange,
  note,
}: {
  script: TutorialScript;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One extra line under the title, e.g. that the exam clock keeps running. */
  note?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0" />
        <DialogPrimitive.Content
          translate="no"
          className="notranslate fixed inset-3 z-50 flex flex-col overflow-hidden rounded-[16px] bg-paper shadow-modal outline-none sm:inset-4"
        >
          {open ? <PlayerBody script={script} note={note} /> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function PlayerBody({ script, note }: { script: TutorialScript; note?: string }) {
  const tt = useTranslations("tutorial");
  const sec = useT("section");
  const { captions, narration, timeline } = useTutorial(script);
  const reducedMotion = usePrefersReducedMotion();
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(true);
  /** Bumped on every seek and replay: the cursor then jumps and the step's audio restarts. */
  const [jump, setJump] = useState(0);
  const total = timeline.total;
  const state = useMemo(() => stateAtTimeline(script, timeline, t), [script, timeline, t]);
  const step = timeline.steps[state.step];

  // The clock: one frame at a time while playing; it stops at the end.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = Math.min(total, tRef.current + (now - last));
      last = now;
      tRef.current = next;
      setT(next);
      if (next >= total) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, total]);

  // Narration: the current step's file plays from where the step is; every other one is still.
  // One stable ref callback per clip (see audio-refs.ts): the frame-by-frame re-render must not detach them.
  const [clips] = useState(() => createClipRegistry<HTMLAudioElement>());
  useEffect(() => () => clips.pauseAll(), [clips]);
  const stepId = step?.id ?? "";
  useEffect(() => {
    for (const [id, el] of Object.entries(clips.current())) {
      if (!el) continue;
      if (id !== stepId || !playing) {
        el.pause();
        continue;
      }
      const offset = Math.max(0, (tRef.current - (step?.start ?? 0)) / 1000);
      if (Math.abs(el.currentTime - offset) > 0.3) el.currentTime = Math.min(offset, Number.isFinite(el.duration) ? el.duration : offset);
      if (el.paused && !el.ended) void el.play().catch(() => undefined);
    }
  }, [clips, stepId, playing, jump, step?.start]);

  const seek = useCallback(
    (to: number) => {
      const index = stepIndexAt(timeline, Math.min(Math.max(0, to), total));
      const at = timeline.steps[index]?.start ?? 0;
      for (const el of Object.values(clips.current())) if (el) el.currentTime = 0;
      tRef.current = at;
      setT(at);
      setJump((j) => j + 1);
    },
    [clips, timeline, total],
  );
  const ended = t >= total;
  const togglePlay = useCallback(() => {
    if (ended) {
      seek(0);
      setPlaying(true);
    } else setPlaying((p) => !p);
  }, [ended, seek]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== " " || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    // A focused button takes Space itself (and the seek bar handles its own).
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    togglePlay();
  };

  const title = tt("title", { section: sec(script.section) });
  const caption = captions[state.caption] ?? "";
  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-hairline px-5">
        <DialogPrimitive.Title className="text-title text-ink">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">{tt("description")}</DialogPrimitive.Description>
        <span className="tnum shrink-0 text-[14px] text-muted">{tt("step", { n: state.step + 1, total: timeline.steps.length })}</span>
      </div>
      {note ? <p className="shrink-0 border-b border-hairline bg-cream px-5 py-2 text-[14px] text-ink-2">{note}</p> : null}

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <ScaledStage>
          <DemoStage script={script} state={state} jump={jump} reducedMotion={reducedMotion} />
        </ScaledStage>
        <div className={cn("flex w-[300px] shrink-0 flex-col justify-center", !captionsOn && "sr-only")}>
          <p role="status" aria-live="polite" className="text-[19px] font-semibold leading-[1.5] text-ink">
            {caption}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-hairline px-5 py-3">
        <button type="button" onClick={togglePlay} aria-label={playing ? tt("pause") : tt("play")} title={playing ? tt("pause") : tt("play")} className={ICON_CONTROL}>
          {playing ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="size-5" />}
        </button>
        <button
          type="button"
          onClick={() => {
            seek(0);
            setPlaying(true);
          }}
          className={CONTROL}
        >
          <RotateCcw aria-hidden className="size-4" />
          {tt("replay")}
        </button>
        <Progress t={t} total={total} starts={timeline.steps.map((s) => s.start)} label={tt("seek")} valueText={tt("time", { current: formatPlayTime(t), total: formatPlayTime(total) })} onSeek={seek} onToggle={togglePlay} />
        <span className="tnum shrink-0 text-[14px] text-ink-2">{tt("time", { current: formatPlayTime(t), total: formatPlayTime(total) })}</span>
        <button
          type="button"
          aria-pressed={captionsOn}
          onClick={() => setCaptionsOn((c) => !c)}
          aria-label={tt("captions")}
          title={tt("captions")}
          className={ICON_CONTROL}
        >
          {captionsOn ? <Captions aria-hidden className="size-5" /> : <CaptionsOff aria-hidden className="size-5" />}
        </button>
        <DialogPrimitive.Close asChild>
          <button type="button" className={CONTROL}>
            <X aria-hidden className="size-4" />
            {tt("close")}
          </button>
        </DialogPrimitive.Close>
      </div>

      {script.steps.map((s) => {
        const entry = narration[s.id];
        return entry ? (
          <audio
            key={s.id}
            ref={clips.ref(s.id)}
            src={entry.src}
            preload="auto"
          />
        ) : null;
      })}
    </div>
  );
}

/** Fits the fixed-size stage into the room it is given, never larger than its own size. */
function ScaledStage({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / STAGE_W, el.clientHeight / STAGE_H));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} className="relative min-h-0 min-w-0 flex-1">
      <div
        className="absolute overflow-hidden rounded-[12px] border border-line shadow-panel"
        style={{
          width: STAGE_W * scale,
          height: STAGE_H * scale,
          left: `calc(50% - ${(STAGE_W * scale) / 2}px)`,
          top: `calc(50% - ${(STAGE_H * scale) / 2}px)`,
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      >
        {/* Placed from the physical top left, so an Arabic page does not push the wide stage out to the left before it is scaled. */}
        <div style={{ position: "absolute", left: 0, top: 0, width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>{children}</div>
      </div>
    </div>
  );
}

/** The seek bar: a tick at every step, a click or the arrow keys go to the start of a step. */
function Progress({
  t,
  total,
  starts,
  label,
  valueText,
  onSeek,
  onToggle,
}: {
  t: number;
  total: number;
  starts: number[];
  label: string;
  valueText: string;
  onSeek: (to: number) => void;
  onToggle: () => void;
}) {
  const track = useRef<HTMLDivElement | null>(null);
  const pct = (ms: number) => (total > 0 ? Math.min(100, (ms / total) * 100) : 0);
  const current = stepAt(starts, t);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === "rtl";
    const fraction = Math.min(1, Math.max(0, (rtl ? r.right - e.clientX : e.clientX - r.left) / r.width));
    onSeek(fraction * total);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let to: number | null = null;
    if (e.key === forward || e.key === "ArrowUp") to = starts[Math.min(starts.length - 1, current + 1)];
    else if (e.key === back || e.key === "ArrowDown") to = t - starts[current] > 1500 ? starts[current] : starts[Math.max(0, current - 1)];
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = starts[starts.length - 1];
    else if (e.key === " ") {
      e.preventDefault();
      onToggle();
      return;
    }
    if (to === null) return;
    e.preventDefault();
    onSeek(to);
  };
  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(total / 1000)}
      aria-valuenow={Math.floor(t / 1000)}
      aria-valuetext={valueText}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="group relative flex h-11 min-w-0 flex-1 cursor-pointer items-center rounded-full"
    >
      <div className="relative h-2 w-full rounded-full bg-line">
        <div className="absolute inset-y-0 start-0 rounded-full bg-accent" style={{ width: `${pct(t)}%` }} />
        {starts.slice(1).map((s) => (
          <span key={s} aria-hidden className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink-3" style={{ insetInlineStart: `calc(${pct(s)}% - 1px)` }} />
        ))}
        <span
          aria-hidden
          className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-paper bg-accent shadow"
          style={{ insetInlineStart: `calc(${pct(t)}% - 8px)` }}
        />
      </div>
    </div>
  );
}

function stepAt(starts: number[], t: number): number {
  let i = 0;
  for (let k = 0; k < starts.length; k++) if (starts[k] <= t) i = k;
  return i;
}
