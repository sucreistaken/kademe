import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Canvas rule: exactly ONE filled button per screen. Everything else is outline
 * or text. The accent colour appears here, on active state, and on the timer.
 * Nowhere else.
 *
 * A disabled button must always say why it is disabled, so `disabledReason` is
 * required whenever `disabled` is set. Making the reason a separate prop stops
 * anyone shipping a dead button with no explanation.
 *
 * This is also the shadcn Button (HIRING-UX 8.1): the copied shadcn parts
 * import it, so it carries the extra variant and sizes they use (`outline`,
 * `xs`, `icon`, `icon-sm`, `icon-xs`) and the data-slot attributes. The Kademe
 * variants and sizes keep their exact class strings, so existing screens draw
 * the same pixels.
 */
const SECONDARY =
  "bg-surface text-ink border border-line hover:bg-canvas " +
  "disabled:text-muted disabled:hover:bg-surface";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium " +
    "transition-colors disabled:cursor-not-allowed select-none",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted",
        secondary: SECONDARY,
        /** shadcn's name for the same thing; used by the copied dialog footer. */
        outline: SECONDARY,
        ghost: "bg-transparent text-muted hover:text-ink hover:bg-line/50 disabled:text-line",
        danger: "bg-surface text-danger border border-line hover:bg-danger/5 disabled:text-muted",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        xs: "h-6 px-2 text-xs",
        icon: "size-10 p-0",
        "icon-sm": "size-8 p-0",
        "icon-xs": "size-6 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
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

type AnyProps = Record<string, unknown>;
type Handler = (...args: unknown[]) => unknown;

function setRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) (ref as React.RefObject<T | null>).current = node;
}

/**
 * The props an asChild Button gives its child, merged the way Radix Slot
 * merges them: the child's own props win, both event handlers run (the
 * child's first), styles combine, and both refs receive the node. Classes are
 * merged by the caller with `cn` (tailwind-merge), which Slot does not do.
 */
function mergeIntoChild(slotProps: AnyProps, childProps: AnyProps): AnyProps {
  const merged: AnyProps = { ...slotProps };
  for (const [key, childValue] of Object.entries(childProps)) {
    if (childValue === undefined) continue;
    const slotValue = slotProps[key];
    if (/^on[A-Z]/.test(key) && typeof slotValue === "function" && typeof childValue === "function") {
      merged[key] = (...args: unknown[]) => {
        const result = (childValue as Handler)(...args);
        (slotValue as Handler)(...args);
        return result;
      };
    } else if (key === "style" && slotValue && typeof slotValue === "object") {
      merged[key] = { ...slotValue, ...(childValue as object) };
    } else {
      merged[key] = childValue;
    }
  }
  return merged;
}

export function Button({
  className,
  variant = "secondary",
  size = "md",
  disabled,
  disabledReason,
  asChild = false,
  children,
  id,
  "aria-describedby": describedBy,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  const slot = { "data-slot": "button", "data-variant": variant ?? "secondary", "data-size": size ?? "md" };
  // The reason is linked only when there is an element to point at: the
  // caller renders <DisabledReason id={`${id}-why`}> next to the button.
  const whyId = disabled && disabledReason && id ? `${id}-why` : undefined;
  const ariaDescribedBy = [describedBy, whyId].filter(Boolean).join(" ") || undefined;

  if (asChild) {
    if (!React.isValidElement(children)) {
      throw new Error("Button asChild expects exactly one element child");
    }
    // Everything a caller or a Radix trigger (`<TooltipTrigger asChild>`)
    // passes reaches the child: handlers, aria-*, data-state and the ref.
    const { ref, ...rest } = props;
    const { ref: childRef, ...childProps } = children.props as AnyProps & { ref?: React.Ref<unknown> };
    const merged = mergeIntoChild(
      { ...slot, ...rest, id, "aria-describedby": ariaDescribedBy },
      childProps,
    );
    merged.className = cn(classes, childProps.className as string | undefined);
    if (ref && childRef) {
      merged.ref = (node: unknown) => {
        setRef(ref as React.Ref<unknown>, node);
        setRef(childRef, node);
      };
    } else if (ref ?? childRef) {
      merged.ref = ref ?? childRef;
    }
    return React.cloneElement(children, merged);
  }

  return (
    <button
      // Default to "button", not the HTML default of "submit". A button placed
      // inside a form to do something local (reset values, toggle a panel)
      // otherwise submits the form and silently discards its own onClick.
      type={props.type ?? "button"}
      {...slot}
      className={classes}
      disabled={disabled}
      {...props}
      id={id}
      aria-describedby={ariaDescribedBy}
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
