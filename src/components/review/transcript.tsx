"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { useMT } from "@/i18n/manager-client";
import type { TranscriptWord } from "@/db/schema/types";

/**
 * Reading is faster than watching, so the transcript is a first class part of
 * the review rather than a download. Clicking a line seeks the video, and the
 * line playing right now is highlighted, which is what lets a manager skim a
 * three minute answer in twenty seconds and still quote it accurately.
 */
export type Segment = { startMs: number; endMs: number; text: string };

/** Words to a readable paragraph. Breaks on sentence ends, or every 22 words. */
export function toSegments(words: TranscriptWord[], fallbackText: string): Segment[] {
  if (words.length === 0) {
    return fallbackText ? [{ startMs: 0, endMs: 0, text: fallbackText }] : [];
  }
  const out: Segment[] = [];
  let buf: TranscriptWord[] = [];
  const flush = () => {
    if (buf.length === 0) return;
    out.push({
      startMs: buf[0].startMs,
      endMs: buf[buf.length - 1].endMs,
      text: buf.map((w) => w.text).join(" ").replace(/\s+([.,!?])/g, "$1"),
    });
    buf = [];
  };
  for (const word of words) {
    buf.push(word);
    if (/[.!?]$/.test(word.text) || buf.length >= 22) flush();
  }
  flush();
  return out;
}

function stamp(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** How much of a transcript is worth showing before the manager asks for more. */
const VISIBLE_SEGMENTS = 4;

export function Transcript({
  words,
  text,
  currentMs,
  onSeek,
}: {
  words: TranscriptWord[];
  text: string;
  currentMs: number;
  onSeek: (ms: number) => void;
}) {
  const t = useMT("transcript");
  const [expanded, setExpanded] = useState(false);
  const segments = useMemo(() => toSegments(words, text), [words, text]);
  if (segments.length === 0) {
    return <p className="text-[13px] text-muted">{t("notReady")}</p>;
  }

  const hasTimings = segments.some((s) => s.endMs > 0);
  // A three minute answer is a wall of text. Show the opening, then let the
  // manager ask for the rest: skimming is the job, reading every word is not.
  const hidden = expanded ? 0 : Math.max(0, segments.length - VISIBLE_SEGMENTS);
  const shown = hidden > 0 ? segments.slice(0, VISIBLE_SEGMENTS) : segments;

  return (
    <div>
      <p className="mb-2 text-[12px] text-muted">
        {hasTimings ? t("clickToSeek") : t("noTimings")}
      </p>
      <ol className="space-y-1">
        {shown.map((segment, i) => {
          const active =
            hasTimings && currentMs >= segment.startMs && currentMs < segment.endMs;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!hasTimings}
                onClick={() => onSeek(segment.startMs)}
                className={cn(
                  "flex w-full gap-3 rounded-[6px] px-2 py-1.5 text-left",
                  "text-[13px] leading-relaxed transition-colors",
                  hasTimings && "hover:bg-canvas",
                  active ? "bg-accent-soft text-ink" : "text-ink/85",
                  !hasTimings && "cursor-default",
                )}
              >
                {hasTimings ? (
                  <span className="shrink-0 pt-px text-[11.5px] text-muted tnum">
                    {stamp(segment.startMs)}
                  </span>
                ) : null}
                <span>{segment.text}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1.5 px-2 text-[12.5px] text-muted hover:text-ink"
        >
          {t("showRest", { count: hidden })} ⌄
        </button>
      ) : null}
    </div>
  );
}
