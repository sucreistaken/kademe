// kademe-owned
import { formatCountdown } from "@/lib/timer";
import { ringGeometry, ringMilestone } from "./ring";

/**
 * K4, 3.8: the think and answer clock. Accent (the timer is one of the
 * accent's three places), whole seconds, no slide, never red. One image to a
 * screen reader; its label is spoken by the polite region beside it at the
 * milestones only (each whole minute, 30 and 10 seconds; HIRING-UX 8.7), and
 * the region is empty in between, so nothing is read every second.
 */
export function TimerRing({ remainingMs, totalMs, label, caption, size = 128 }: { remainingMs: number; totalMs: number; label: string; caption: string; size?: 96 | 128 }) {
  const g = ringGeometry({ remainingMs, totalMs, size });
  const c = size / 2;
  return (
    <>
      <div role="img" aria-label={label} className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" focusable="false" className="-rotate-90">
          <circle cx={c} cy={c} r={g.radius} fill="none" stroke="var(--color-hairline)" strokeWidth={6} />
          <circle cx={c} cy={c} r={g.radius} fill="none" stroke="var(--color-accent)" strokeWidth={6} strokeLinecap="round" strokeDasharray={g.circumference} strokeDashoffset={g.offset} />
        </svg>
        <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-[24px] leading-8 font-semibold text-accent">{formatCountdown(g.seconds * 1000)}</span>
          <span className="text-[13px] leading-5 text-muted">{caption}</span>
        </span>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {ringMilestone({ remainingMs, totalMs }) ? label : ""}
      </p>
    </>
  );
}
