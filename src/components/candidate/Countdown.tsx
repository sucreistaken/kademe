"use client";

import { formatCountdown } from "@/lib/timer";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";

/**
 * The timer is one of the three places the accent colour is allowed to appear.
 * `.tnum` keeps the digits from jumping as the seconds change.
 */
export function Countdown({
  ms,
  label,
  size = "md",
  totalMs,
}: {
  ms: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  totalMs?: number;
}) {
  const ratio = totalMs && totalMs > 0 ? Math.min(1, ms / totalMs) : null;
  return (
    <div className="text-center">
      {label ? <div className="text-[11.5px] text-muted">{label}</div> : null}
      <div
        className={cn(
          "tnum font-bold tracking-[-0.02em] text-accent",
          size === "sm" && "text-[15px]",
          size === "md" && "mt-1 text-[34px] leading-none",
          size === "lg" && "mt-2 text-[52px] leading-none",
        )}
      >
        {formatCountdown(ms)}
      </div>
      {ratio !== null ? (
        <div className="relative mt-2 h-[3px] rounded-sm bg-line">
          <span
            className="absolute inset-y-0 left-0 rounded-sm bg-accent transition-[width] duration-300"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Stage ticks in the top bar: done, current, still to come. */
export function ProgressTicks({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  const t = useT("stage");
  return (
    <span
      className="flex gap-[3px]"
      aria-label={t("progressLabel", { current, total })}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-[3px] w-[26px] rounded-sm",
            i + 1 < current && "bg-ink",
            i + 1 === current && "bg-accent",
            i + 1 > current && "bg-line",
          )}
        />
      ))}
    </span>
  );
}
