import { describe, expect, it } from "vitest";
import { buttonVariants } from "./button";
import { cn } from "@/lib/cn";

/** The exact strings the pre-shadcn Button produced (commit a99b878). */
const BEFORE = {
  base: "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors disabled:cursor-not-allowed select-none",
  primary: "bg-accent text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted",
  secondary: "bg-surface text-ink border border-line hover:bg-canvas disabled:text-muted disabled:hover:bg-surface",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-line/50 disabled:text-line",
  danger: "bg-surface text-danger border border-line hover:bg-danger/5 disabled:text-muted",
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
} as const;

describe("Button keeps its classes", () => {
  for (const variant of ["primary", "secondary", "ghost", "danger"] as const) {
    for (const size of ["sm", "md", "lg"] as const) {
      it(`${variant} ${size}`, () => {
        expect(cn(buttonVariants({ variant, size }))).toBe(cn(BEFORE.base, BEFORE[variant], BEFORE[size]));
      });
    }
  }

  it("outline is the secondary look", () => {
    expect(cn(buttonVariants({ variant: "outline", size: "md" }))).toBe(
      cn(buttonVariants({ variant: "secondary", size: "md" })),
    );
  });
});
