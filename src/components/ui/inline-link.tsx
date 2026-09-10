import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * An inline text link.
 *
 * The accent colour is reserved for exactly three things: the primary call to
 * action, an active state, and a running timer. Text links are none of those,
 * so the canvas draws them as ink with a quiet underline instead. Eight links
 * had drifted to `text-accent` before this component existed; route new ones
 * through here rather than reaching for the colour again.
 */
export function InlineLink({
  href,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      className={cn(
        "font-medium text-ink underline decoration-underline underline-offset-[3px]",
        "hover:decoration-ink",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

/** Same treatment for a button that reads as a link rather than a control. */
export function InlineButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={props.type ?? "button"}
      className={cn(
        "font-medium text-ink underline decoration-underline underline-offset-[3px]",
        "hover:decoration-ink disabled:text-muted disabled:no-underline",
        className,
      )}
      {...props}
    />
  );
}
