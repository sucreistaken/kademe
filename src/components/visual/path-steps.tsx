// kademe-owned
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** "Nasıl gidecek", "Sırada ne var", the phone screen's steps and the panel's setup list: numbered, the current one marked. */
export function PathSteps({ steps, label }: { steps: Array<{ title: ReactNode; detail?: ReactNode; state?: "done" | "current" | "todo"; action?: ReactNode }>; label?: string }) {
  return (
    <ol aria-label={label} className="space-y-1">
      {steps.map((step, i) => (
        <li key={i} aria-current={step.state === "current" ? "step" : undefined} className="relative flex gap-3 pb-3 last:pb-0">
          <span
            className={cn(
              "tnum grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-medium",
              step.state === "done" ? "bg-ink text-white" : step.state === "current" ? "border-2 border-ink bg-surface text-ink" : "border border-line bg-surface text-muted",
            )}
            aria-hidden
          >
            {step.state === "done" ? <Check className="size-4" strokeWidth={2} /> : i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className={cn("text-[16px] leading-6", step.state === "todo" ? "text-ink-2" : "font-medium text-ink")}>{step.title}</p>
            {step.detail ? <p className="text-[14px] leading-[22px] text-muted">{step.detail}</p> : null}
            {step.action ? <div className="mt-2">{step.action}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
