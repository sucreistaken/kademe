"use client";

import type { Ref } from "react";
import { Flag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
    <span aria-hidden className={cn("grid size-4 place-items-center rounded-full border border-paper bg-ink", className)}>
      <Flag className="size-2.5 fill-white text-white" strokeWidth={2} />
    </span>
  );
}

const CELL = {
  COMPLETE: "border-accent bg-accent text-white",
  PARTIAL: "border-accent bg-accent-soft text-ink",
  EMPTY: "border-line bg-surface text-ink-2 hover:border-line-strong",
} as const;

export function NavStrip({
  entries,
  current,
  disabled,
  onJump,
  onReview,
}: {
  entries: NavEntry[];
  /** The item on screen; null on the review step. */
  current: number | null;
  disabled: boolean;
  onJump: (sequence: number) => void;
  /** Shown as a link next to the strip; the bar's own button says it on the last item. */
  onReview: (() => void) | null;
}) {
  const n = useT("examNav");
  const status = { COMPLETE: n("statusComplete"), PARTIAL: n("statusPartial"), EMPTY: n("statusEmpty") };
  return (
    <nav aria-label={n("stripLabel")} className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
      <ol className="flex flex-wrap gap-1.5">
        {entries.map((e) => {
          const state = progressState(e);
          const here = e.sequence === current;
          const label = [n("cell", { n: e.sequence }), status[state], e.flagged ? n("statusFlagged") : null].filter(Boolean).join(", ");
          return (
            <li key={e.sequence}>
              <button
                type="button"
                aria-label={label}
                title={label}
                aria-current={here ? "step" : undefined}
                disabled={disabled}
                onClick={() => (here ? undefined : onJump(e.sequence))}
                className={cn(
                  "tnum relative grid size-8 place-items-center rounded-[8px] border text-[13px] font-semibold transition-colors disabled:cursor-not-allowed",
                  CELL[state],
                  here && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
                )}
              >
                {e.sequence}
                {e.flagged ? <FlagMark className="absolute -right-1.5 -top-1.5" /> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <ul aria-hidden className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
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
      {onReview ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onReview}
          className="ml-auto min-h-11 text-[15px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink disabled:cursor-not-allowed disabled:text-muted"
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

function JumpList({ title, items, disabled, onJump }: { title: string; items: Array<{ sequence: number; label: string; flagged: boolean }>; disabled: boolean; onJump: (s: number) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-[14px] font-semibold text-ink">
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
      <JumpList title={n("reviewEmpty")} items={empty} disabled={disabled} onJump={onJump} />
      <JumpList title={n("reviewPartial")} items={partial} disabled={disabled} onJump={onJump} />
      <JumpList title={n("reviewFlagged")} items={flagged} disabled={disabled} onJump={onJump} />
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
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
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
            {n("cancel")}
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
