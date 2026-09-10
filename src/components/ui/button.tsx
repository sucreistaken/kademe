import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Canvas rule: exactly ONE filled button per screen. Everything else is outline
 * or text. The accent colour appears here, on active state, and on the timer.
 * Nowhere else.
 *
 * A disabled button must always say why it is disabled, so `disabledReason` is
 * required whenever `disabled` is set. Making the reason a separate prop stops
 * anyone shipping a dead button with no explanation.
 */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium " +
  "transition-colors disabled:cursor-not-allowed select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted",
  secondary:
    "bg-surface text-ink border border-line hover:bg-canvas " +
    "disabled:text-muted disabled:hover:bg-surface",
  ghost:
    "bg-transparent text-muted hover:text-ink hover:bg-line/50 disabled:text-line",
  danger:
    "bg-surface text-danger border border-line hover:bg-danger/5 disabled:text-muted",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Required when disabled. Rendered next to the button, not as a tooltip. */
  disabledReason?: string;
  /**
   * Render the single child element with the button styling instead of a
   * <button>. Use it for navigation (a Link that should look like the primary
   * action) so the markup stays a real anchor and keeps middle-click, copy link
   * and keyboard behaviour.
   */
  asChild?: boolean;
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  disabled,
  disabledReason,
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if (asChild) {
    if (!React.isValidElement(children)) {
      throw new Error("Button asChild expects exactly one element child");
    }
    const child = children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      className: cn(classes, child.props.className),
    });
  }

  return (
    <button
      // Default to "button", not the HTML default of "submit". A button placed
      // inside a form to do something local (reset values, toggle a panel)
      // otherwise submits the form and silently discards its own onClick.
      type={props.type ?? "button"}
      className={classes}
      disabled={disabled}
      aria-describedby={disabled && disabledReason ? props.id + "-why" : undefined}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Renders the reason a button is disabled. Never a tooltip: it must be readable.
 *
 * `className` exists for the one case where the reason cannot take up a line of
 * its own: a disabled control inside a 90px table cell. Pass "sr-only" there and
 * make sure the same reason is already visible elsewhere in the row.
 */
export function DisabledReason({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p id={id} className={cn("text-[13px] text-muted", className)}>
      {children}
    </p>
  );
}
