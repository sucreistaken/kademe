"use client";

import type { Ref } from "react";
import { Bookmark } from "lucide-react";
import { PartCounter } from "@/components/candidate/exam/PartCounter";
import type { AnswerProgress } from "@/components/candidate/exam/answer-progress";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * A question's heading ("Question 3 of 20"), with its part counter. Two
 * variants: on a group page ("group", `id` set) it carries its own flag
 * button; on a single question ("single") it shows the flagged tag instead.
 */
export function ItemHeading({
  variant,
  label,
  progress,
  headingRef,
  id,
  flagged,
  flagBusy = false,
  onToggleFlag,
  compact = false,
}: {
  variant: "group" | "single";
  /** The translated sequence label, e.g. "Question 3 of 20". */
  label: string;
  progress: AnswerProgress | null | undefined;
  /** Focus target of the step; undefined when this heading is not the one focused. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** Group variant: the id the section's aria-labelledby points to. */
  id?: string;
  flagged: boolean;
  /** Group variant: the flag button is disabled while an action is under way. */
  flagBusy?: boolean;
  /** Group variant on a navigable section: shows the flag button. */
  onToggleFlag?: () => void;
  /** Single variant: a task page (writing, speaking) uses a tighter gap below. */
  compact?: boolean;
}) {
  const n = useT("examNav");
  const cw = useT("cheatWarning");
  if (variant === "group") {
    return (
      <h2
        id={id}
        ref={headingRef}
        tabIndex={-1}
        className="tnum mb-6 flex items-center gap-2.5 text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted outline-none"
      >
        {label}
        <PartCounter progress={progress} />
        {onToggleFlag ? (
          <button
            type="button"
            aria-pressed={flagged}
            disabled={flagBusy}
            onClick={onToggleFlag}
            className={cn(
              "ms-auto inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-medium normal-case tracking-normal disabled:cursor-not-allowed",
              flagged ? "border-sun-fill bg-sun-fill text-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong",
            )}
          >
            <Bookmark aria-hidden className={cn("size-3.5", flagged && "fill-ink")} strokeWidth={2} />
            {flagged ? cw("flagSet") : n("flag")}
          </button>
        ) : null}
      </h2>
    );
  }
  return (
    <h2
      ref={headingRef}
      tabIndex={-1}
      className={cn(
        "tnum flex items-center gap-2.5 text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted outline-none",
        compact ? "mb-3" : "mb-6",
      )}
    >
      {label}
      <PartCounter progress={progress} />
      {flagged ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-sun-soft px-2 py-0.5 text-[11.5px] font-semibold normal-case tracking-normal text-sun">
          <Bookmark aria-hidden className="size-3 fill-sun-fill" strokeWidth={2} />
          {n("flaggedTag")}
        </span>
      ) : null}
    </h2>
  );
}
