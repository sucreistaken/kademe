import { cn } from "@/lib/cn";

/**
 * A status: a coloured dot plus a word, or (`pill`) the same inside a soft
 * pill. The word always carries the meaning; the colour only helps a glance.
 *
 * Tones (globals.css, Campus German look):
 *  - active: a bright cyan dot (something is happening now).
 *  - done: a deep-cyan dot, or a cream pill with ink text (finished; unlike
 *    active it does not look live).
 *  - neutral: grey.
 *  - warn: yellow (needs a person's attention).
 * No red tone: a status is never a verdict.
 */
export type StatusTone = "active" | "done" | "neutral" | "warn";

const dots: Record<StatusTone, string> = {
  active: "bg-brand",
  done: "bg-accent",
  neutral: "bg-line-mute",
  warn: "bg-sun-fill",
};

const pills: Record<StatusTone, string> = {
  active: "bg-accent-soft text-accent",
  done: "bg-cream text-ink",
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
        pill && cn("w-fit gap-1.5 rounded-full px-2.5 py-0.5 font-semibold", pills[tone]),
        className,
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", dots[tone])} aria-hidden />
      {children}
    </span>
  );
}
