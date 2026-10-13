// kademe-owned
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * A soft pill for a short label: a count, a duration, a category, a level.
 * The pastel families come from globals.css; every text tone reads at 4.5:1
 * or more on its own ground. Not for a status (StatusDot) and never for
 * whether an answer was right.
 */
export const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-full font-bold whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-subtle text-ink-2",
        mint: "bg-mint-soft text-mint",
        sky: "bg-sky-soft text-sky",
        grape: "bg-grape-soft text-grape",
        sun: "bg-sun-soft text-sun",
        coral: "bg-coral-soft text-coral",
        outline: "border border-line bg-surface text-ink-2",
      },
      size: {
        sm: "h-6 px-2.5 text-[12px]",
        md: "h-7 px-3 text-[13px]",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

export function Badge({
  className,
  tone,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
