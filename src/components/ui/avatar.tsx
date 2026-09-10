import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/**
 * Initials only. No photographs anywhere in the manager UI: a face next to a
 * score invites exactly the bias structured assessment exists to reduce.
 */
export function Avatar({
  name,
  className,
}: {
  name: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
        "bg-canvas border border-line text-[12px] font-semibold text-muted",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
