"use client";

import { cn } from "@/lib/cn";
import { useMT } from "@/i18n/manager-client";

/**
 * Tag text is bilingual data, resolved to the reader's language on the server,
 * so this control receives a plain string.
 */
export type Observation = {
  id: string;
  polarity: "POSITIVE" | "NEGATIVE";
  label: string;
  /** Archived tags stay visible while selected so history stays readable, but
   *  are never offered as a new choice. */
  archived?: boolean;
};

/**
 * Clicking beats typing. These reusable observations are what makes it possible
 * to evaluate four stages in five minutes without every candidate getting a
 * different vocabulary. The manager can still add a free note underneath.
 *
 * Polarity is carried by the leading sign and by weight, not by colour: the
 * accent is reserved for the primary action, and a wall of red and green chips
 * would read as a verdict the system is not entitled to give.
 */
export function ObservationChips({
  options,
  selected,
  onToggle,
}: {
  options: Observation[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const t = useMT("rail");
  // An archived tag is shown only when this evaluation already carries it.
  const visible = options.filter((o) => !o.archived || selected.includes(o.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((option) => {
        const on = selected.includes(option.id);
        const sign = option.polarity === "POSITIVE" ? "+" : "−";
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            title={option.archived ? t("archivedTag") : undefined}
            onClick={() => onToggle(option.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-1",
              "text-[12.5px] leading-tight transition-colors",
              on
                ? "border-ink/25 bg-ink/[0.055] font-medium text-ink"
                : "border-line bg-surface text-muted hover:border-muted/40 hover:text-ink",
            )}
          >
            <span aria-hidden className="text-muted">
              {sign}
            </span>
            {option.label}
            {option.archived ? (
              <span className="text-[11px] text-muted">{t("removedTag")}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
