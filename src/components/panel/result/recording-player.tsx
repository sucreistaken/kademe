"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";
import type { RecordingKind } from "@/lib/proctor/recording-rules";
import {
  buildTracks,
  coverage,
  formatClock,
  nextRecordedAt,
  nextSegmentIndex,
  offsetSeconds,
  recordedMs,
  segmentIndexAt,
  timelineBounds,
  type PlaySegment,
} from "@/lib/proctor/recording-timeline";

/**
 * The whole exam, played back: camera and screen side by side on one clock,
 * the sections and the proctoring flags on one timeline under them.
 *
 * Why segments played one after another rather than MediaSource: every
 * segment is a complete file, so each pane keeps two <video> elements, plays
 * one and loads the next segment into the other, and swaps on the boundary.
 * That needs no codec string, works for WebM and MP4 alike, and a missing or
 * broken segment costs its own fifteen seconds and nothing around it. A
 * MediaSource buffer in "sequence" mode would close the gaps instead, sliding
 * camera, screen and flags out of step after the first lost upload or reload.
 *
 * The clock is the exam's own wall time. When a pane has no segment for the
 * moment it says so instead of showing the wrong picture; when neither has
 * one, playback jumps to the next recorded moment.
 */

const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];
type PaneState = "play" | "gap" | "wait";

export type RecordingPlayerProps = {
  attemptId: string;
  segments: Array<{ id: string; kind: RecordingKind; start: number; durationMs: number }>;
  window: { start: number; end: number };
  sections: Array<{ key: string; label: string; start: number; end: number }>;
  /** Already grouped (same type within 30 s is one marker); `count` above 1 is drawn as a small number. */
  markers: Array<{ id: string; label: string; at: number; severity: "HIGH" | "MEDIUM" | "LOW"; count?: number }>;
  /** Already formatted for the viewer, or null when no purge date is set. */
  purgeOn: string | null;
};

const srcFor = (id: string) => `/api/panel/recordings/${id}`;

/** Two elements per pane: one shows the current segment, the other loads the next. */
class TrackDriver {
  private holds: [number, number] = [-1, -1];
  visible: 0 | 1 | null = null;
  state: PaneState = "gap";

  constructor(
    private readonly els: [HTMLVideoElement, HTMLVideoElement],
    private readonly track: PlaySegment[],
  ) {}

  private load(slot: 0 | 1, index: number) {
    if (this.holds[slot] === index) return;
    this.holds[slot] = index;
    const el = this.els[slot];
    el.preload = "auto";
    el.src = srcFor(this.track[index].id);
  }

  private slotFor(index: number): 0 | 1 {
    if (this.holds[0] === index) return 0;
    if (this.holds[1] === index) return 1;
    // Load into the element that is not on screen, so the old frame stays until the new one is ready.
    const slot: 0 | 1 = this.visible === 0 ? 1 : 0;
    this.load(slot, index);
    return slot;
  }

  tick(t: number, playing: boolean, rate: number, muted: boolean, jump: boolean) {
    const i = segmentIndexAt(this.track, t);
    if (i < 0) {
      for (const el of this.els) if (!el.paused) el.pause();
      const next = nextSegmentIndex(this.track, t);
      if (next >= 0) this.slotFor(next);
      this.visible = null;
      this.state = "gap";
      return;
    }
    const slot = this.slotFor(i);
    const el = this.els[slot];
    const other = this.els[slot === 0 ? 1 : 0];
    if (!other.paused) other.pause();
    if (i + 1 < this.track.length && this.holds[slot === 0 ? 1 : 0] !== i + 1) this.load(slot === 0 ? 1 : 0, i + 1);

    el.muted = muted;
    if (el.playbackRate !== rate) el.playbackRate = rate;
    if (el.readyState >= 1) {
      const target = offsetSeconds(this.track[i], t);
      // Small drift is left alone (seeking stutters); a jump or a large drift is corrected.
      if (jump || Math.abs(el.currentTime - target) > 0.75 + 0.5 * rate) {
        try {
          el.currentTime = target;
        } catch {
          /* not seekable yet; the next tick tries again */
        }
      }
    }
    if (playing && el.paused && !el.ended) void el.play().catch(() => undefined);
    if (!playing && !el.paused) el.pause();
    if (el.readyState >= 2) this.visible = slot;
    this.state = playing && el.readyState < 3 && !el.ended ? "wait" : "play";
  }

  release() {
    for (const el of this.els) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
  }
}

export function ExamRecordingPlayer({ attemptId, segments, window: span, sections, markers, purgeOn }: RecordingPlayerProps) {
  const t = useMT("examRecording");
  const tracks = useMemo(() => buildTracks(segments), [segments]);
  const bounds = useMemo(() => timelineBounds(span, tracks), [span, tracks]);
  const kinds = useMemo(() => (["CAMERA", "SCREEN"] as const).filter((k) => tracks[k].length > 0), [tracks]);

  const [now, setNow] = useState(() => tracks.CAMERA[0]?.start ?? tracks.SCREEN[0]?.start ?? bounds.start);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<Speed>(1);
  const [muted, setMuted] = useState(false);
  const [panes, setPanes] = useState<Partial<Record<RecordingKind, { state: PaneState; visible: 0 | 1 | null }>>>({});

  const root = useRef<HTMLDivElement | null>(null);
  const videos = useRef<Partial<Record<RecordingKind, [HTMLVideoElement | null, HTMLVideoElement | null]>>>({});
  const clock = useRef(now);
  const jump = useRef(true);
  const settings = useRef({ playing, rate, muted });
  const audited = useRef(false);

  useEffect(() => {
    settings.current = { playing, rate, muted };
  }, [playing, rate, muted]);

  const seek = useCallback(
    (at: number) => {
      const clamped = Math.max(bounds.start, Math.min(bounds.end, at));
      clock.current = clamped;
      jump.current = true;
      setNow(clamped);
    },
    [bounds],
  );

  const togglePlay = useCallback(() => {
    // The first play is what the audit log calls "recording watched".
    if (!playing && !audited.current) {
      audited.current = true;
      void fetch("/api/panel/recordings/viewed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId }),
      }).catch(() => undefined);
    }
    setPlaying(!playing);
  }, [attemptId, playing]);

  // One loop drives the clock and keeps every pane on it.
  useEffect(() => {
    const drivers: Partial<Record<RecordingKind, TrackDriver>> = {};
    for (const kind of kinds) {
      const [a, b] = videos.current[kind] ?? [];
      if (a && b) drivers[kind] = new TrackDriver([a, b], tracks[kind]);
    }
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const loop = (frame: number) => {
      const dt = Math.min(250, frame - last);
      last = frame;
      const s = settings.current;
      let jumped = jump.current;
      jump.current = false;
      let stop = false;
      if (s.playing) {
        const waiting = Object.values(drivers).some((d) => d?.state === "wait");
        if (!waiting) clock.current += dt * s.rate;
        const next = nextRecordedAt(tracks, clock.current);
        if (next === null || clock.current >= bounds.end) {
          stop = true;
        } else if (next - clock.current > 1000) {
          // Nothing recorded here in any pane: go to where something is.
          clock.current = next;
          jumped = true;
        }
      }
      for (const kind of kinds) drivers[kind]?.tick(clock.current, s.playing && !stop, s.rate, s.muted, jumped);
      if (stop || jumped || frame - lastUi > 150) {
        lastUi = frame;
        setNow(clock.current);
        setPanes(Object.fromEntries(kinds.map((k) => [k, { state: drivers[k]?.state ?? "gap", visible: drivers[k]?.visible ?? null }])));
        if (stop) setPlaying(false);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      for (const kind of kinds) drivers[kind]?.release();
    };
  }, [kinds, tracks, bounds]);

  // "Watch in the recording" links elsewhere on the page carry the moment in data-rec-at.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("[data-rec-at]");
      if (!link) return;
      const at = Number(link.getAttribute("data-rec-at"));
      if (!Number.isFinite(at)) return;
      e.preventDefault();
      seek(at - 3000);
      root.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [seek]);

  const width = Math.max(1, bounds.end - bounds.start);
  const pct = (ms: number) => `${Math.max(0, Math.min(100, ((ms - bounds.start) / width) * 100))}%`;
  const scrub = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    seek(bounds.start + ((clientX - rect.left) / rect.width) * width);
  };

  return (
    <section ref={root} id="exam-recording" aria-label={t("title")} className="scroll-mt-24 rounded-[14px] border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-ink">{t("title")}</h2>
        <p className="tnum text-[12.5px] text-muted">
          {kinds.map((k) => t(k === "CAMERA" ? "coverageCamera" : "coverageScreen", { duration: formatClock(recordedMs(tracks[k])) })).join(" · ")}
          {purgeOn ? ` · ${t("purgeOn", { date: purgeOn })}` : ""}
        </p>
      </div>

      <div className={cn("mt-3 grid gap-3", kinds.length === 2 ? "md:grid-cols-[2fr_3fr]" : "max-w-[720px]")}>
        {kinds.map((kind) => {
          const pane = panes[kind];
          return (
            <figure key={kind} className="m-0">
              <div className="relative aspect-video overflow-hidden rounded-[10px] bg-panel">
                {[0, 1].map((slot) => (
                  <video
                    key={slot}
                    ref={(el) => {
                      const pair = (videos.current[kind] ??= [null, null]);
                      pair[slot] = el;
                    }}
                    playsInline
                    muted={muted}
                    preload="auto"
                    className={cn("absolute inset-0 h-full w-full object-contain", pane?.visible === slot ? "opacity-100" : "opacity-0")}
                  />
                ))}
                {pane?.state === "gap" || !pane ? (
                  <div className="absolute inset-0 grid place-items-center px-4 text-center text-[12.5px] text-white/75">
                    {t(kind === "CAMERA" ? "gapCamera" : "gapScreen")}
                  </div>
                ) : pane.visible === null || pane.state === "wait" ? (
                  <div className="absolute bottom-2 right-2 rounded-[6px] bg-black/50 px-2 py-0.5 text-[11.5px] text-white/85">{t("loading")}</div>
                ) : null}
              </div>
              <figcaption className="mt-1 text-[12px] text-muted">{t(kind === "CAMERA" ? "camera" : "screen")}</figcaption>
            </figure>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? t("pause") : t("play")}
          className="h-9 min-w-[84px] rounded-[10px] bg-accent px-4 text-[13.5px] font-semibold text-white hover:bg-accent-hover"
        >
          {playing ? t("pause") : t("play")}
        </button>
        <button type="button" onClick={() => seek(clock.current - 10_000)} className="h-9 rounded-[8px] border border-line px-3 text-[12.5px] font-medium text-ink hover:bg-canvas">
          {t("back10")}
        </button>
        <button type="button" onClick={() => seek(clock.current + 10_000)} className="h-9 rounded-[8px] border border-line px-3 text-[12.5px] font-medium text-ink hover:bg-canvas">
          {t("forward10")}
        </button>
        <span className="tnum px-1 text-[13px] text-ink-2">
          {formatClock(now - bounds.start)} / {formatClock(width)}
        </span>
        <div role="group" aria-label={t("speed")} className="ml-auto flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={rate === s}
              onClick={() => setRate(s)}
              className={cn(
                "tnum h-8 rounded-[8px] border px-2.5 text-[12.5px] font-medium",
                rate === s ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:bg-canvas",
              )}
            >
              {s}×
            </button>
          ))}
          {kinds.includes("CAMERA") ? (
            <button
              type="button"
              aria-pressed={muted}
              onClick={() => setMuted((m) => !m)}
              className="h-8 rounded-[8px] border border-line px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-canvas"
            >
              {muted ? t("unmute") : t("mute")}
            </button>
          ) : null}
        </div>
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label={t("timeline")}
        aria-valuemin={0}
        aria-valuemax={Math.round(width / 1000)}
        aria-valuenow={Math.round((now - bounds.start) / 1000)}
        aria-valuetext={formatClock(now - bounds.start)}
        onClick={(e) => scrub(e.clientX, e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") seek(clock.current - 5000);
          else if (e.key === "ArrowRight") seek(clock.current + 5000);
          else if (e.key === " " || e.key === "k") togglePlay();
          else return;
          e.preventDefault();
        }}
        className="relative mt-3 h-[72px] cursor-pointer select-none rounded-[10px] border border-line bg-canvas/40 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {sections.map((s) => (
          <div
            key={s.key}
            className="absolute top-0 h-full border-r border-line bg-surface/70"
            style={{ left: pct(s.start), width: `calc(${pct(s.end)} - ${pct(s.start)})` }}
          >
            <span className="absolute left-1 top-1 truncate text-[10.5px] text-muted">{s.label}</span>
          </div>
        ))}
        {kinds.map((kind, row) => (
          <div key={kind} className={cn("pointer-events-none absolute inset-x-0 h-[5px]", row === 0 ? "bottom-[14px]" : "bottom-[5px]")}>
            {coverage(tracks[kind]).map((c) => (
              <span
                key={c.start}
                className={cn("absolute h-full rounded-full", kind === "CAMERA" ? "bg-accent" : "bg-ink-3")}
                style={{ left: pct(c.start), width: `calc(${pct(c.end)} - ${pct(c.start)})` }}
              />
            ))}
          </div>
        ))}
        {markers.map((m) => (
          <button
            key={m.id}
            type="button"
            title={`${m.label}${m.count && m.count > 1 ? ` ×${m.count}` : ""} · ${formatClock(m.at - bounds.start)}`}
            aria-label={`${m.label}${m.count && m.count > 1 ? ` ×${m.count}` : ""} · ${formatClock(m.at - bounds.start)}`}
            data-marker-severity={m.severity}
            onClick={(e) => {
              e.stopPropagation();
              seek(m.at - 3000);
            }}
            className="group absolute top-4 -ml-[5px] flex h-[34px] w-[11px] justify-center"
            style={{ left: pct(m.at) }}
          >
            {m.count && m.count > 1 ? (
              <span
                className={cn(
                  "tnum pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-1 text-[9.5px] font-bold leading-[13px]",
                  m.severity === "HIGH" ? "bg-danger-soft text-danger" : m.severity === "MEDIUM" ? "bg-warn-soft text-warn" : "bg-subtle text-muted",
                )}
              >
                {m.count}
              </span>
            ) : null}
            <span
              className={cn(
                "block w-[3px] rounded-full group-hover:bg-accent",
                m.severity === "HIGH" ? "h-full bg-danger" : m.severity === "MEDIUM" ? "h-6 bg-warn" : "h-4 bg-line-strong",
              )}
            />
          </button>
        ))}
        <div className="pointer-events-none absolute inset-y-0 w-[2px] -translate-x-1/2 bg-accent" style={{ left: pct(now) }} />
      </div>
      <p className="mt-1.5 text-[11.5px] text-muted">
        {kinds.length === 2 ? t("legend") : t("legendOne")}
      </p>
    </section>
  );
}
