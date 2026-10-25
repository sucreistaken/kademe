"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";
import { formatCountdown } from "@/lib/timer";
import { crossedCue, TIME_NOTICE_MS, timeCue, timeCueKey, type TimeCue } from "@/lib/exam/time-cue";

function readShown(key: string): string[] {
  try {
    const raw = window.sessionStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeShown(key: string, shown: string[]): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(shown));
  } catch {
    // Storage can be blocked; the notice then simply may show again after a reload.
  }
}

/**
 * The exam clock, centered in the top bar: a white pill that turns yellow-soft
 * when time runs low, never red and never blinking. When the clock steps into
 * "low" or "last" a small callout under it says so once per section run.
 * `aside` hangs on the pill's trailing side (the recording chip), so the clock
 * itself stays exactly in the middle of the bar.
 */
export function TimerPill({
  remainingMs,
  sectionMs,
  token,
  sectionPosition,
  aside,
}: {
  remainingMs: number;
  sectionMs: number;
  token: string;
  sectionPosition: number;
  aside?: React.ReactNode;
}) {
  const t = useT("exam");
  const cue = timeCue(remainingMs, sectionMs);
  const prev = useRef<TimeCue>("normal");
  const [notice, setNotice] = useState<{ cue: "low" | "last"; minutes: number } | null>(null);
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));

  useEffect(() => {
    const crossed = crossedCue(prev.current, cue);
    prev.current = cue;
    if (!crossed) return;
    const key = timeCueKey(token, sectionPosition);
    const shown = readShown(key);
    if (shown.includes(crossed)) return;
    writeShown(key, [...shown, crossed]);
    setNotice({ cue: crossed, minutes });
    // `minutes` is read at the moment of crossing only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue, token, sectionPosition]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), TIME_NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [notice]);

  const warm = cue === "low" || cue === "last";
  return (
    <div className="absolute inset-y-0 start-1/2 flex -translate-x-1/2 items-center rtl:translate-x-1/2">
      <span className="sr-only">{t("timeLeft")}</span>
      <span
        data-cue={cue}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-full border-2 px-4 shadow-lip-soft",
          warm ? "border-sun-fill bg-sun-soft" : "border-line bg-surface",
        )}
      >
        <Clock aria-hidden className="size-5 text-ink-2" strokeWidth={2} />
        <span className="tnum text-button-lg text-ink">{formatCountdown(remainingMs)}</span>
      </span>
      {aside ? <div className="absolute start-full top-1/2 ms-3 w-max -translate-y-1/2">{aside}</div> : null}
      <div role="status" aria-live="polite" className="absolute start-1/2 top-full -translate-x-1/2 rtl:translate-x-1/2">
        {notice ? (
          <div className="mt-2 flex w-max max-w-[360px] items-center gap-3 rounded-[12px] border border-sun-fill bg-sun-soft px-4 py-2 text-[14px] font-semibold text-ink shadow-lip-soft">
            <span>{notice.cue === "low" ? t("timeNoticeLow", { minutes: notice.minutes }) : t("timeNoticeLast")}</span>
            <Button type="button" size="sm" onClick={() => setNotice(null)}>
              {t("timeNoticeOk")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
