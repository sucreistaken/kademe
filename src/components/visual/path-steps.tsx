// kademe-owned
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";

/** What a reader hears after a step's title; the check and the grey number only show it. The current step is aria-current. */
const STATE_WORDS: Record<Locale, { done: string; todo: string }> = {
  tr: { done: "tamamlandı", todo: "sırada" },
  en: { done: "done", todo: "up next" },
};

/**
 * "Nasıl gidecek", "Sırada ne var", the phone screen's steps and the panel's
 * setup list: numbered, the current one marked. A step with no state is a plain
 * numbered line and says nothing more.
 */
export function PathSteps({
  steps,
  label,
  locale = DEFAULT_LOCALE,
}: {
  steps: Array<{ title: ReactNode; detail?: ReactNode; state?: "done" | "current" | "todo"; action?: ReactNode }>;
  label?: string;
  locale?: Locale;
}) {
  const words = STATE_WORDS[locale];
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
            <p className={cn("text-[16px] leading-6", step.state === "todo" ? "text-ink-2" : "font-medium text-ink")}>
              {step.title}
              {step.state === "done" || step.state === "todo" ? (
                <>
                  {" "}
                  <span className="sr-only">{words[step.state]}</span>
                </>
              ) : null}
            </p>
            {step.detail ? <p className="text-[14px] leading-[22px] text-muted">{step.detail}</p> : null}
            {step.action ? <div className="mt-2">{step.action}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
