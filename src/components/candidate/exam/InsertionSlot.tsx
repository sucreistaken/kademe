"use client";

import { ChevronDown } from "lucide-react";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";
import { LetterDisc, MatchPicker } from "./MatchPicker";
import { useMatchUi } from "./match-ui";
import type { PickerChoice, TargetView } from "./match-targets";

/**
 * One gap of a text-insertion item, drawn in the reading text where its
 * marker stood: a small slot with the gap's number. Empty it is dashed with a
 * blank; filled it shows the sentence's letter and the start of the sentence.
 * Clicking it opens the list of sentences (MatchPicker).
 */
export function InsertionSlot({
  rowId,
  number,
  chosen,
  choices,
  disabled,
  onPick,
}: {
  rowId: string;
  number: number;
  chosen: TargetView | undefined;
  choices: readonly PickerChoice[];
  disabled?: boolean;
  onPick: (targetId: string | null) => void;
}) {
  const ti = useT("examItems");
  const ui = useMatchUi();
  const open = ui.openRow === rowId && !disabled;
  const gap = ti("gapLabel", { n: number });
  return (
    <MatchPicker
      rowId={rowId}
      choices={choices}
      clearLabel={chosen ? ti("matchClear") : null}
      listLabel={`${gap}: ${ti("matchTargets")}`}
      disabled={disabled}
      onPick={onPick}
      triggerLabel={`${gap}, ${chosen ? ti("clozeChosen", { word: chosen.badge }) : ti("gapEmpty")}`}
      triggerAttrs={{ "data-match-trigger": rowId }}
      triggerClassName={cn(
        "mx-0.5 inline-flex h-7 max-w-full items-center gap-1.5 rounded-[8px] border px-2 align-middle text-[14px] font-bold leading-none text-ink transition-colors disabled:cursor-not-allowed",
        open ? "border-accent bg-accent-soft" : chosen ? "border-ink-2 bg-surface hover:border-accent" : "border-dashed border-line-strong bg-canvas hover:border-accent",
      )}
      triggerChildren={
        <>
          <span aria-hidden className="tnum text-ink-2">
            {number}
          </span>
          {chosen ? (
            <>
              <LetterDisc badge={chosen.badge} tone={chosen.disc} small />
              <span lang="de" className="min-w-0 max-w-[13rem] truncate font-semibold">
                {chosen.label}
              </span>
            </>
          ) : (
            <span aria-hidden className="h-0.5 w-7 rounded-full bg-line-strong" />
          )}
          <ChevronDown aria-hidden className="size-3.5 shrink-0 text-ink-3" strokeWidth={2.5} />
        </>
      }
      keepOpenFor="[data-insert-list]"
    />
  );
}
