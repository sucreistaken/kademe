"use client";

import { useCallback, useImperativeHandle, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { useMT } from "@/i18n/manager-client";

/**
 * The review player.
 *
 * Native `<video controls>` gets the manager 90 percent of the way there, but
 * not the parts that make reviewing fast: jumping back fifteen seconds to hear
 * a sentence again, and running at 1.5x through the parts that are going
 * nowhere. Those live behind browser menus or nowhere at all, so the bar is
 * built here. Keyboard shortcuts already existed; this gives the same actions
 * to someone using a mouse.
 */

export type PlayerHandle = {
  seekTo: (ms: number) => void;
  togglePlay: () => void;
};

const SPEEDS = [1, 1.25, 1.5, 2] as const;

function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPlayer({
  src,
  onTimeUpdate,
  handleRef,
  transcriptText,
  transcriptName,
}: {
  src: string;
  onTimeUpdate: (ms: number) => void;
  handleRef?: React.Ref<PlayerHandle>;
  /** When present, the manager can take the text away and read it elsewhere. */
  transcriptText?: string;
  transcriptName?: string;
}) {
  const t = useMT("player");
  const locale = useLocale();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<number>(1);

  useImperativeHandle(handleRef, () => ({
    seekTo(ms: number) {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = ms / 1000;
      void video.play().catch(() => {});
    },
    togglePlay() {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) void video.play().catch(() => {});
      else video.pause();
    },
  }));

  const nudge = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(
      0,
      Math.min(video.duration || 0, video.currentTime + seconds),
    );
  }, []);

  const scrub = (event: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    video.currentTime = Math.max(0, Math.min(1, ratio)) * video.duration;
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  const download = () => {
    if (!transcriptText) return;
    const blob = new Blob([transcriptText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${transcriptName ?? t("transcriptFile")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-[10px] bg-panel">
      <video
        ref={videoRef}
        src={src}
        // Without this the browser is free to fetch nothing until the first
        // play, and the bar then shows "0:00 / 0:00" for a video that is
        // perfectly fine. The duration is part of deciding whether to watch.
        preload="metadata"
        playsInline
        className="block w-full bg-panel"
        onClick={() => {
          const video = videoRef.current;
          if (!video) return;
          if (video.paused) void video.play().catch(() => {});
          else video.pause();
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          setCurrent(e.currentTarget.currentTime);
          onTimeUpdate(e.currentTarget.currentTime * 1000);
        }}
      />

      {/* scrubber */}
      <div
        role="slider"
        tabIndex={0}
        aria-label={t("position")}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(current)}
        onClick={scrub}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") nudge(-5);
          if (e.key === "ArrowRight") nudge(5);
        }}
        className="group relative h-1.5 cursor-pointer bg-white/15"
      >
        <div
          className="absolute inset-y-0 left-0 bg-accent"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style={{ left: `${progress}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            if (video.paused) void video.play().catch(() => {});
            else video.pause();
          }}
          aria-label={playing ? t("pause") : t("play")}
          className="grid size-7 place-items-center rounded-[6px] text-[13px] text-white hover:bg-white/10"
        >
          {playing ? "❙❙" : "▶"}
        </button>

        <span className="text-[12.5px] text-white/85 tnum">
          {clock(current)} / {clock(duration)}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <PlayerButton onClick={() => nudge(-15)}>{t("back15")}</PlayerButton>
          <PlayerButton onClick={() => nudge(15)}>{t("forward15")}</PlayerButton>
          <PlayerButton
            onClick={() => {
              const next = SPEEDS[(SPEEDS.indexOf(speed as 1) + 1) % SPEEDS.length];
              setSpeed(next);
              if (videoRef.current) videoRef.current.playbackRate = next;
            }}
            active={speed !== 1}
          >
            {locale === "tr" ? String(speed).replace(".", ",") : String(speed)}×
          </PlayerButton>
          {transcriptText ? (
            <PlayerButton onClick={download}>{t("downloadTranscript")}</PlayerButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PlayerButton({
  onClick,
  children,
  active = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[6px] px-2 py-1 text-[12px] transition-colors",
        active
          ? "bg-white/15 font-medium text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
