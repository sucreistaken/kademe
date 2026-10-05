// kademe-owned
"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/cn";

/** G7: detail and legal text one click away; the label says what is behind it. Nothing is hidden for good. */
export function Disclosure({
  label,
  icon: Icon,
  defaultOpen = false,
  variant = "row",
  children,
  className,
}: {
  label: ReactNode;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  variant?: "row" | "inline";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn(variant === "row" && "border-y border-line", className)}>
      <CollapsibleTrigger
        className={cn(
          "group flex min-h-12 items-center gap-2 text-left text-[16px] text-ink",
          variant === "row" ? "w-full justify-between font-medium" : "underline decoration-underline underline-offset-4 hover:decoration-ink",
        )}
      >
        <span className="flex items-center gap-2">
          {Icon ? <Icon className="size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden /> : null}
          {label}
        </span>
        <ChevronDown className="size-4 shrink-0 transition-transform duration-[180ms] ease-soft group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
