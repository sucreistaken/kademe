"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Opens the browser's print dialog; "Save as PDF" there makes the file. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(buttonVariants({ variant: "primary", size: "lg" }), "h-11 px-5")}
    >
      {label}
    </button>
  );
}
