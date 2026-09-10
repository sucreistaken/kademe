import { cn } from "@/lib/cn";

/**
 * Canvas rule: status is a dot plus text, never a badge pill.
 *
 * Tone hierarchy is read off the canvas and it is the opposite of the obvious
 * one: a finished, scored row gets the DARKEST dot, because that is the row the
 * manager has dealt with and wants to recognise at a glance. Pending work is
 * quieter, not louder. There is no amber anywhere; a table full of traffic
 * lights reads as a verdict the system has not earned.
 */
export type StatusTone =
  /** Something is happening right now: recording, live timer. The only accent. */
  | "active"
  /** Finished and settled: scored, completed, published. Darkest neutral. */
  | "done"
  /** Waiting, not yet acted on. */
  | "neutral"
  /** Needs attention (expiring, half scored). Still grey, just lighter. */
  | "warn";

const tones: Record<StatusTone, string> = {
  active: "bg-accent",
  done: "bg-ink",
  neutral: "bg-muted/50",
  warn: "bg-ink-3",
};

export function StatusDot({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[13px] text-muted", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", tones[tone])} aria-hidden />
      {children}
    </span>
  );
}
