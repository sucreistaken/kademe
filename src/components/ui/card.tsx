import { cn } from "@/lib/cn";

/**
 * Canvas rule: card borders are never accent-coloured, and shadow is reserved
 * for sticky panels and modals. A plain card gets a hairline border only.
 */
export function Card({
  className,
  elevated = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-line bg-surface",
        elevated && "shadow-[0_1px_3px_rgba(0,0,0,0.07)]",
        className,
      )}
      {...props}
    />
  );
}
