import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * The soft card (globals.css): round corners from `--card-radius` (20px, set
 * on :root; a screen may set its own), a light border and a solid lip under
 * it (shadow-card) instead of a blurred shadow. `elevated` is for a card that
 * floats over the page (sticky panels).
 *
 * The sub-parts below are shadcn's (HIRING-UX 8.1), for new screens. They read
 * `--card-spacing`, set on the root to 20px (HIRING-UX 8.3: panel card padding);
 * existing cards do not use the sub-parts.
 */
export function Card({
  className,
  elevated = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-[var(--card-radius,20px)] border border-line bg-surface shadow-card [--card-spacing:--spacing(5)]",
        elevated && "shadow-panel",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min items-start gap-1 px-(--card-spacing) pt-(--card-spacing)",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("text-[16px] font-semibold text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-[13px] text-muted", className)} {...props} />;
}

export function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-(--card-spacing)", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center border-t border-line px-(--card-spacing) py-4", className)}
      {...props}
    />
  );
}
