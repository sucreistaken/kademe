"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { moveIndex, typeaheadIndex } from "@/lib/exam/match-options";
import { cn } from "@/lib/cn";
import { useMatchUi } from "./match-ui";
import type { PickerChoice } from "./match-targets";

/**
 * The one list every matching choice opens: a gap in the reading text, or the
 * "Wählen Sie ..." button of a row. A popover holding a listbox of lettered
 * options: the options another row already holds sink to the bottom, dimmed,
 * and say where they are ("in Lücke 2"), but stay pickable (picking moves
 * them). Arrow keys, Home, End and a typed letter move, Enter or Space picks,
 * Escape closes and gives the focus back to the button that opened it.
 *
 * The list is German exam content, so it is left to right on an Arabic page.
 */

/** The letter (or 0) of a target, in the colour of its advert card when it has one. */
export function LetterDisc({ badge, tone, small = false }: { badge: string; tone: string | null; small?: boolean }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 text-ink",
        small ? "size-5 text-[12px] font-extrabold leading-none" : "size-7 text-label",
        tone ? cn("bg-surface", tone) : "border-line bg-cream",
      )}
    >
      {badge}
    </span>
  );
}

/** Keeps the list as tall as the room, scrolling inside. The popover's own variables come from Radix. */
const PANEL = "flex flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-lg bg-popover p-1.5 text-popover-foreground shadow-overlay ring-1 ring-foreground/10 outline-hidden";
const RADIX_PANEL = "max-h-[min(24rem,var(--radix-popover-content-available-height))] gap-0.5 overflow-y-auto overscroll-contain p-1.5";

/** The options of a list, as the elements the keyboard handler walks. */
function Options({ rowId, choices, clearLabel, onPick }: { rowId: string; choices: readonly PickerChoice[]; clearLabel: string | null; onPick: (targetId: string | null) => void }) {
  const row = "flex cursor-pointer items-start gap-3 rounded-[10px] px-3 py-2 text-start text-[15px] leading-[1.45] [--focus-offset:-2px]";
  return (
    <>
      {choices.map((c) => (
        <span
          key={c.id}
          role="option"
          aria-selected={c.selected}
          tabIndex={-1}
          data-badge={c.badge}
          data-demo-option={`${rowId}:${c.id}`}
          onClick={() => onPick(c.id)}
          className={cn(row, c.selected ? "bg-accent-soft" : "hover:bg-canvas focus:bg-canvas", c.hint ? "text-ink-3" : "text-ink")}
        >
          <LetterDisc badge={c.badge} tone={c.disc} />
          <span lang="de" className="min-w-0 flex-1 pt-0.5">
            {c.label}
          </span>
          {c.hint ? <span className="mt-0.5 shrink-0 rounded-full bg-cream px-2 py-0.5 text-[12px] font-bold text-ink-2">{c.hint}</span> : null}
          {c.selected ? <Check aria-hidden className="mt-1 size-4 shrink-0 text-accent" strokeWidth={3} /> : null}
        </span>
      ))}
      {clearLabel ? (
        <span
          role="option"
          aria-selected={false}
          tabIndex={-1}
          data-badge=""
          data-demo-option={`${rowId}:`}
          onClick={() => onPick(null)}
          className={cn(row, "mt-1 items-center border-t border-line pt-3 text-ink-2 hover:bg-canvas focus:bg-canvas")}
        >
          <X aria-hidden className="size-4 shrink-0" strokeWidth={2.5} />
          <span>{clearLabel}</span>
        </span>
      ) : null}
    </>
  );
}

/** Arrow keys, Home, End and a letter move between the options; Enter and Space pick the focused one. */
function listKeys(e: KeyboardEvent<HTMLElement>) {
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')];
  const at = items.findIndex((el) => el === document.activeElement);
  if (e.key === "Enter" || e.key === " ") {
    if (at < 0) return;
    e.preventDefault();
    items[at].click();
    return;
  }
  const to = moveIndex(at, e.key, items.length);
  if (to !== null) {
    e.preventDefault();
    items[to].focus();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const hit = typeaheadIndex(items.map((el) => el.dataset.badge ?? ""), e.key, at);
  if (hit >= 0) {
    e.preventDefault();
    items[hit].focus();
  }
}

/**
 * The picked option, else the first, takes the focus when the list opens, and
 * the list scrolls to it. The list has not been placed yet at that moment, so
 * the page itself must not scroll (preventScroll); only the list does.
 */
function focusStart(list: HTMLElement | null) {
  const options = list?.querySelectorAll<HTMLElement>('[role="option"]');
  if (!list || !options || options.length === 0) return;
  const start = list.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ?? options[0];
  start.focus({ preventScroll: true });
  const box = list.getBoundingClientRect();
  const at = start.getBoundingClientRect();
  list.scrollTop += at.top - box.top - (box.height - at.height) / 2;
}

export function MatchPicker({
  rowId,
  choices,
  clearLabel,
  listLabel,
  disabled = false,
  onPick,
  triggerLabelledBy,
  triggerLabel,
  triggerId,
  triggerClassName,
  triggerAttrs,
  triggerChildren,
  wide = false,
  keepOpenFor,
}: {
  rowId: string;
  /** The options in list order. */
  choices: readonly PickerChoice[];
  /** Shown as the last option when the row holds a pick; picking it empties the row. */
  clearLabel: string | null;
  /** The listbox's accessible name. */
  listLabel: string;
  disabled?: boolean;
  onPick: (targetId: string | null) => void;
  triggerLabelledBy?: string;
  triggerLabel?: string;
  triggerId?: string;
  triggerClassName: string;
  triggerAttrs?: Record<string, string>;
  triggerChildren: ReactNode;
  /** A row's full-width button: the list is as wide as the button. Otherwise a gap in the text. */
  wide?: boolean;
  /** A selector for the parts of the page that may be clicked while the list is open without closing it. */
  keepOpenFor?: string;
}) {
  const ui = useMatchUi();
  const content = useRef<HTMLDivElement | null>(null);
  const open = ui.openRow === rowId && !disabled;
  const setOpen = (next: boolean) => (next ? ui.setOpenRow(rowId) : ui.closeRow(rowId));
  const pick = (targetId: string | null) => {
    onPick(targetId);
    ui.closeRow(rowId);
  };

  const trigger = (
    <button
      type="button"
      id={triggerId}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={triggerLabel}
      aria-labelledby={triggerLabelledBy}
      // In a popover the trigger's own click comes from Radix.
      {...(ui.inline ? { onClick: () => setOpen(!open) } : {})}
      onKeyDown={(e) => {
        if (disabled || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
        e.preventDefault();
        setOpen(true);
      }}
      className={triggerClassName}
      {...triggerAttrs}
    >
      {triggerChildren}
    </button>
  );

  if (ui.inline) {
    // The tutorial's stage: the open list sits right under its button, in the stage's own scaled box.
    return (
      <span className={cn("relative", wide ? "block" : "inline-block align-middle")}>
        {trigger}
        {open ? (
          <span role="listbox" aria-label={listLabel} dir="ltr" className={cn(PANEL, "absolute start-0 top-full z-30 mt-1.5 max-h-72", wide ? "w-full" : "w-[26rem]")}>
            <Options rowId={rowId} choices={choices} clearLabel={clearLabel} onPick={pick} />
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        ref={content}
        role="listbox"
        aria-label={listLabel}
        dir="ltr"
        translate="no"
        align="start"
        sideOffset={6}
        // The exam's header and bottom bar stay uncovered.
        collisionPadding={{ top: 72, bottom: 84, left: 12, right: 12 }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          focusStart(content.current);
        }}
        onInteractOutside={(e) => {
          const target = e.target as Element | null;
          if (keepOpenFor && target?.closest?.(keepOpenFor)) e.preventDefault();
        }}
        onKeyDown={(e) => {
          // Tab closes the list and leaves the focus on its button, like a native drop-down.
          if (e.key === "Tab") {
            e.preventDefault();
            setOpen(false);
            return;
          }
          listKeys(e);
        }}
        className={cn(
          RADIX_PANEL,
          wide ? "w-(--radix-popover-trigger-width) min-w-[18rem]" : "w-[min(36rem,var(--radix-popover-content-available-width))]",
        )}
      >
        <Options rowId={rowId} choices={choices} clearLabel={clearLabel} onPick={pick} />
      </PopoverContent>
    </Popover>
  );
}
