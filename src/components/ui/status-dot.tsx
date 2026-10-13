import { cn } from "@/lib/cn";

/**
 * A status: a coloured dot plus a word, or (`pill`) the same inside a soft
 * pill. The word always carries the meaning; the colour only helps a glance.
 *
 * Tones (globals.css, soft look):
 *  - active: something is happening right now (in the exam, recording). Sky.
 *  - done: finished and settled (scored, completed, published). Mint.
 *  - neutral: waiting, not yet acted on. Grey.
 *  - warn: needs a person's attention (expiring, half scored). Sun (amber).
 * A status is never a verdict on a candidate: there is no red tone here.
 */
export type StatusTone = "active" | "done" | "neutral" | "warn";

const dots: Record<StatusTone, string> = {
  active: "bg-sky-fill",
  done: "bg-mint-fill",
  neutral: "bg-line-mute",
  warn: "bg-sun-fill",
};

const pills: Record<StatusTone, string> = {
  active: "bg-sky-soft text-sky",
  done: "bg-mint-soft text-mint",
  neutral: "bg-subtle text-muted",
  warn: "bg-sun-soft text-sun",
};

export function StatusDot({
  tone = "neutral",
  pill = false,
  children,
  className,
}: {
  tone?: StatusTone;
  /** Draw the status as a soft pill (tables and lists where it should stand out). */
  pill?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[13px] text-muted",
        pill && cn("gap-1.5 rounded-full px-2.5 py-0.5 font-semibold", pills[tone]),
        className,
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", dots[tone])} aria-hidden />
      {children}
    </span>
  );
}
