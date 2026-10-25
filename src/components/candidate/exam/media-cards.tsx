"use client";

import type { Ref } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * How the listening player looks, with no audio and no request behind it.
 * MediaItems drives it for the exam; the tutorial's demo stage drives the same
 * cards from its script, so the demo draws exactly what the exam shows (the
 * speaking recorder is the same kind of thing: SpeakingPanel.tsx). `press`
 * marks the card's button as the point the tutorial's cursor presses
 * (data-demo-press); the exam leaves it out.
 */

const TITLE = "text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted";

/** Listening: the player with no seek bar, its play button, progress and the plays left. */
export function ListeningPlayerCard({
  title,
  label,
  playMode,
  onPlay,
  buttonRef,
  progress,
  playsLeft,
  failure,
  note,
  press = false,
}: {
  title: string;
  /** The play button's words: play, loading, playing, try again. */
  label: string;
  playMode: "ready" | "busy" | "off";
  onPlay?: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  /** 0 to 1. */
  progress: number;
  playsLeft: number;
  /** Why the last play failed, said in full; null when it did not. */
  failure?: string | null;
  /** A calm line under the player, inside the same card. */
  note?: string;
  press?: boolean;
}) {
  const t = useT("exam");
  return (
    <div className="rounded-[14px] border border-line bg-surface p-5">
      {/* German upper case: under the Turkish page language "i" would become "İ". */}
      <div lang="de" className={TITLE}>
        {title}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <button
          ref={buttonRef}
          type="button"
          data-demo-press={press ? "" : undefined}
          onClick={playMode === "ready" ? onPlay : undefined}
          disabled={playMode === "off"}
          aria-disabled={playMode === "busy" || undefined}
          className="h-11 shrink-0 rounded-[10px] border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:text-muted aria-disabled:cursor-wait aria-disabled:text-muted aria-disabled:hover:bg-surface"
        >
          {label}
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full bg-ink-3 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
      <p className="tnum mt-2.5 text-[13px] text-muted">{playsLeft > 0 ? t("playsLeft", { n: playsLeft }) : t("noPlaysLeft")}</p>
      {failure ? (
        <p role="alert" className="mt-1 text-[13px] text-danger">
          {failure}
        </p>
      ) : null}
      {note ? <p className="mt-3 text-[13px] leading-[1.5] text-muted">{note}</p> : null}
    </div>
  );
}

/** Listening: "read the questions first", and the button that starts the recording. */
export function ListeningGateCard({ title, playsLeft, onStart, press = false }: { title: string; playsLeft: number; onStart?: () => void; press?: boolean }) {
  const t = useT("exam");
  return (
    <div className="rounded-[14px] border border-line bg-surface p-5">
      <div lang="de" className={TITLE}>
        {title}
      </div>
      <p className="mt-3 text-[15px] leading-[1.6] text-ink-2">{t("listenGate", { plays: playsLeft })}</p>
      <button type="button" data-demo-press={press ? "" : undefined} onClick={onStart} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-4 h-12 w-full")}>
        {t("listenStart")}
      </button>
    </div>
  );
}
