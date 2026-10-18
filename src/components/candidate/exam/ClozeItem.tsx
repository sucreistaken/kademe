"use client";

import { useEffect, useId, useRef, useState } from "react";
import { splitInstruction } from "@/lib/exam/prompt-instruction";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";
import { activeGap, clozeParts, gapOrder, nextAfterPick, optionOfKey } from "./cloze-model";
import { Instruction, radioKeys } from "./item-parts";
import type { ItemProps } from "./ItemView";

/**
 * Multiple-choice cloze: the German text on the left with numbered gaps, the
 * four words of the open gap on the right. A pick fills the gap and moves on to
 * the next empty one; a filled gap opens again when clicked. Keys 1-4 pick.
 * The panel sticks while a long text scrolls, so the options stay in reach.
 */
export function ClozeItem({ item, answer, onChange, disabled }: ItemProps) {
  const t = useT("exam");
  const ti = useT("examItems");
  const root = useRef<HTMLDivElement | null>(null);
  const headingId = useId();
  // The gap the student clicked; without one the first empty gap is open.
  const [clicked, setClicked] = useState<string | null>(null);

  const content = item.content.kind === "GAP" ? item.content : null;
  const gaps = new Map((content?.gaps ?? []).map((g) => [g.id, g]));
  const { instruction, content: passage } = splitInstruction(item.prompt, "stem");
  const parts = clozeParts(passage);
  const order = gapOrder(parts, new Set(gaps.keys()));
  const open = activeGap(order, answer.gaps, clicked);
  const openGap = open ? gaps.get(open) : undefined;
  const options = openGap?.choices ?? [];

  const pickOption = (index: number) => {
    if (disabled || !open || index >= options.length) return;
    const next = { ...(answer.gaps ?? {}), [open]: options[index] };
    onChange({ gaps: next });
    setClicked(nextAfterPick(order, next, open));
  };

  // Keys 1-4 pick for the open gap. A warning covering the page, a dialog or a modifier key is left alone.
  const latest = useRef(pickOption);
  useEffect(() => {
    latest.current = pickOption;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.defaultPrevented) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      // Typing in a field, or a dialog (finish, leave) asking something on top of the exam.
      if (el?.closest('input, textarea, select, [contenteditable], [role="dialog"], [role="alertdialog"]')) return;
      if (root.current?.closest("[inert]")) return;
      const index = optionOfKey(e.key, 4);
      if (index === null) return;
      e.preventDefault();
      latest.current(index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!content) return null;
  const number = (id: string) => order.indexOf(id) + 1;
  const label = (id: string) => ti("gapLabel", { n: number(id) });
  const chosen = open ? (answer.gaps?.[open] ?? "") : "";
  const widest = (id: string) => Math.max(3, ...(gaps.get(id)?.choices ?? []).map((c) => c.length)) + 2;

  return (
    <div ref={root}>
      {instruction ? (
        <div lang="de" className="mb-4">
          <Instruction text={instruction} />
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <p lang="de" className="whitespace-pre-line rounded-[14px] border border-line bg-surface p-6 text-[17px] font-medium leading-[2.2] text-ink">
          {parts.map((part, i) => {
            if ("text" in part) return <span key={i}>{part.text}</span>;
            const gap = gaps.get(part.gapId);
            if (!gap) return <span key={i}>____</span>;
            const value = answer.gaps?.[gap.id] ?? "";
            const isOpen = gap.id === open;
            return (
              <button
                key={i}
                type="button"
                lang="de"
                disabled={disabled}
                aria-label={`${label(gap.id)}: ${value || ti("gapEmpty")}`}
                aria-pressed={isOpen}
                data-cloze-gap={gap.id}
                onClick={() => setClicked(gap.id)}
                // Wide enough for the longest of its words, so a pick never moves the text.
                style={{ minWidth: `${widest(gap.id)}ch` }}
                className={cn(
                  "mx-0.5 inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[6px] border px-2 align-middle text-[16px] font-medium leading-none",
                  value ? "border-line-strong bg-surface text-ink" : "border-dashed border-line-strong bg-canvas text-muted",
                  isOpen && "border-solid border-accent bg-accent-soft text-ink ring-2 ring-accent",
                )}
              >
                {value || number(gap.id)}
              </button>
            );
          })}
        </p>
        {openGap && open ? (
          <div className="rounded-[14px] border border-line bg-surface p-5 lg:sticky lg:top-24">
            <h3 id={headingId} className="tnum text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">
              {label(open)}
            </h3>
            <div role="radiogroup" aria-labelledby={headingId} className="mt-3 flex flex-col gap-2">
              {options.map((word, i) => {
                const on = word === chosen;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={disabled}
                    tabIndex={on || (!chosen && i === 0) ? 0 : -1}
                    onKeyDown={radioKeys}
                    onClick={() => pickOption(i)}
                    className={cn(
                      "flex min-h-12 w-full items-center gap-3 rounded-[10px] border bg-surface px-4 py-3 text-left text-[16px] transition-colors",
                      on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink hover:border-line-strong",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                        on ? "bg-accent text-white" : "border border-line-strong text-muted",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span lang="de">{word}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[12.5px] text-muted">{t("clozeKeys")}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
