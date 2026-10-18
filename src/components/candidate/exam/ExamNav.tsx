"use client";

import { useEffect, useRef, type Ref } from "react";
import { CircleHelp, Flag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { progressState } from "@/components/candidate/exam/answer-progress";
import type { NavEntry } from "@/lib/exam/navigation";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * The parts of a navigable (fixed-form) section that are not the question:
 * the progress strip in the bottom bar, the review step and the confirmation
 * before a step that cannot be undone. The cells say what the student filled
 * in and what they flagged, never whether an answer is right.
 */

function FlagMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-4 place-items-center rounded-full border border-sun-fill bg-sun-soft", className)}>
      <Flag className="size-2.5 fill-sun-fill text-sun" strokeWidth={2} />
    </span>
  );
}

const CELL = {
  COMPLETE: "border-accent bg-accent text-white",
  PARTIAL: "border-accent bg-accent-soft text-ink",
  EMPTY: "border-line bg-surface text-ink-2 hover:border-line-strong",
} as const;

/** What the cell colours and the flag mean; the list the "?" popover and the wide strip both show. */
function Legend({ className, hidden = false }: { className?: string; hidden?: boolean }) {
  const n = useT("examNav");
  return (
    <ul aria-hidden={hidden || undefined} className={cn("flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted", className)}>
      <li className="flex items-center gap-1.5">
        <span className={cn("size-3 rounded-[3px] border", CELL.COMPLETE)} />
        {n("legendComplete")}
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn("size-3 rounded-[3px] border", CELL.PARTIAL)} />
        {n("legendPartial")}
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn("size-3 rounded-[3px] border", CELL.EMPTY)} />
        {n("legendEmpty")}
      </li>
      <li className="flex items-center gap-1.5">
        <FlagMark className="size-3.5" />
        {n("legendFlagged")}
      </li>
    </ul>
  );
}

export function NavStrip({
  entries,
  current,
  disabled,
  onJump,
  onReview,
  compact = false,
}: {
  entries: NavEntry[];
  /** The item on screen (every question of a recording's page); null on the review step. */
  current: number | readonly number[] | null;
  disabled: boolean;
  onJump: (sequence: number) => void;
  /** Shown as a link next to the strip (not in the compact bar: the bar's own button goes to the review step). */
  onReview: (() => void) | null;
  /**
   * In the one-row question bar: smaller cells on one line that scrolls sideways
   * when it is too long, the legend behind a "?" button, no review link. The
   * strip never wraps, so the bar keeps its height.
   */
  compact?: boolean;
}) {
  const n = useT("examNav");
  const status = { COMPLETE: n("statusComplete"), PARTIAL: n("statusPartial"), EMPTY: n("statusEmpty") };
  const list = useRef<HTMLOListElement>(null);
  const currentKey = Array.isArray(current) ? current.join(",") : String(current);
  // Keep the cell on screen in view when the strip scrolls (moves the strip only, never the page).
  useEffect(() => {
    if (!compact) return;
    const strip = list.current?.parentElement;
    const cell = list.current?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!strip || !cell) return;
    const stripBox = strip.getBoundingClientRect();
    const cellBox = cell.getBoundingClientRect();
    if (cellBox.left < stripBox.left) strip.scrollLeft += cellBox.left - stripBox.left - 8;
    else if (cellBox.right > stripBox.right) strip.scrollLeft += cellBox.right - stripBox.right + 8;
  }, [compact, currentKey]);
  const cells = entries.map((e) => {
    const state = progressState(e);
    const here = Array.isArray(current) ? current.includes(e.sequence) : e.sequence === current;
    const label = [n("cell", { n: e.sequence }), status[state], e.flagged ? n("statusFlagged") : null].filter(Boolean).join(", ");
    return (
      <li key={e.sequence} className="shrink-0">
        <button
          type="button"
          aria-label={label}
          title={label}
          aria-current={here ? "step" : undefined}
          disabled={disabled}
          onClick={() => (here && !Array.isArray(current) ? undefined : onJump(e.sequence))}
          className={cn(
            "tnum relative grid place-items-center rounded-[8px] border text-[13px] font-semibold transition-colors disabled:cursor-not-allowed",
            compact ? "size-7" : "size-8",
            CELL[state],
            here && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
          )}
        >
          {e.sequence}
          {e.flagged ? <FlagMark className="absolute -end-1.5 -top-1.5" /> : null}
        </button>
      </li>
    );
  });
  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <nav aria-label={n("stripLabel")} className="min-w-0 overflow-x-auto px-2 py-2">
          <ol ref={list} className="flex flex-nowrap gap-1">
            {cells}
          </ol>
        </nav>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={n("legendButton")}
              title={n("legendButton")}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-ink"
            >
              <CircleHelp className="size-5" strokeWidth={1.75} aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" sideOffset={14} className="w-auto max-w-[min(92vw,420px)] p-4">
            <Legend className="flex gap-y-2 text-[14px] text-ink" />
          </PopoverContent>
        </Popover>
      </div>
    );
  }
  return (
    <nav aria-label={n("stripLabel")} className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <ol className="flex flex-wrap gap-1.5">{cells}</ol>
      <Legend hidden className="flex" />
      {onReview ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onReview}
          className="min-h-11 whitespace-nowrap text-[15px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink disabled:cursor-not-allowed disabled:text-muted"
        >
          {n("reviewAndFinish")}
        </button>
      ) : null}
    </nav>
  );
}

/** Counts the review step and the finish confirmation both show. */
export function reviewCounts(entries: NavEntry[]) {
  const states = entries.map((e) => progressState(e));
  return {
    total: entries.length,
    answered: states.filter((s) => s !== "EMPTY").length,
    empty: states.filter((s) => s === "EMPTY").length,
    partial: states.filter((s) => s === "PARTIAL").length,
    flagged: entries.filter((e) => e.flagged).length,
  };
}

function JumpList({
  title,
  items,
  disabled,
  onJump,
  flagHeading = false,
}: {
  title: string;
  items: Array<{ sequence: number; label: string; flagged: boolean }>;
  disabled: boolean;
  onJump: (s: number) => void;
  /** The flagged list carries the flag in its heading too. */
  flagHeading?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
        {flagHeading ? <FlagMark /> : null}
        {title} <span className="tnum font-normal text-muted">({items.length})</span>
      </h2>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i.sequence}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onJump(i.sequence)}
              className="tnum inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 text-[14px] text-ink hover:border-line-strong disabled:cursor-not-allowed disabled:text-muted"
            >
              {i.label}
              {i.flagged ? <FlagMark /> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReviewScreen({
  entries,
  disabled,
  onJump,
  headingRef,
}: {
  entries: NavEntry[];
  disabled: boolean;
  onJump: (sequence: number) => void;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const n = useT("examNav");
  const counts = reviewCounts(entries);
  const cell = (e: NavEntry) => ({ sequence: e.sequence, label: n("cell", { n: e.sequence }), flagged: e.flagged });
  const empty = entries.filter((e) => progressState(e) === "EMPTY").map(cell);
  const partial = entries
    .filter((e) => progressState(e) === "PARTIAL")
    .map((e) => ({ ...cell(e), label: n("reviewPartialItem", { n: e.sequence, filled: e.filled, total: e.total }) }));
  const flagged = entries.filter((e) => e.flagged).map(cell);
  return (
    <div className="mx-auto max-w-[680px] px-7 pb-10 pt-10">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-[1.2] tracking-[-0.02em] text-ink outline-none">
        {n("reviewTitle")}
      </h1>
      <p className="tnum mt-2.5 text-[15px] leading-[1.6] text-ink-2">{n("reviewLead", { answered: counts.answered, total: counts.total })}</p>
      <JumpList title={n("reviewFlagged")} items={flagged} disabled={disabled} onJump={onJump} flagHeading />
      <JumpList title={n("reviewEmpty")} items={empty} disabled={disabled} onJump={onJump} />
      <JumpList title={n("reviewPartial")} items={partial} disabled={disabled} onJump={onJump} />
      {empty.length + partial.length + flagged.length === 0 ? <p className="mt-6 text-[14.5px] text-ink-2">{n("reviewAllDone")}</p> : null}
      <p className="mt-8 rounded-[10px] border border-line bg-surface px-4 py-3 text-[14px] leading-[1.6] text-ink-2">{n("reviewNote")}</p>
    </div>
  );
}

/** A step that cannot be undone asks once, in words, with the safe choice first. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  /** Says where the safe choice leads ("Back to the exam"); the plain "Cancel" when omitted. */
  cancelLabel?: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const n = useT("examNav");
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
      <DialogContent showCloseButton={false} className="gap-0 rounded-[14px] bg-surface p-6 sm:max-w-[460px]">
        <DialogTitle className="text-[20px] font-bold leading-[1.3] text-ink">{title}</DialogTitle>
        <DialogDescription className="mt-2 text-[14.5px] leading-[1.6] text-ink-2">{body}</DialogDescription>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onCancel} className={buttonVariants({ variant: "secondary", size: "lg" })}>
            {cancelLabel ?? n("cancel")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
