import type { KeyboardEvent } from "react";

/** Pieces shared by the item renderers. */

export function Instruction({ text }: { text: string }) {
  return <p className="whitespace-pre-line border-s-[3px] border-brand ps-3 text-[16px] leading-[1.55] text-ink">{text}</p>;
}

/**
 * Arrow keys, Home and End move through one radio group and pick, the way
 * native radio buttons do. Only the picked radio (or the first) is a tab stop.
 */
export function radioKeys(e: KeyboardEvent<HTMLButtonElement>) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key] ?? 0;
  if (!step && e.key !== "Home" && e.key !== "End") return;
  const group = e.currentTarget.closest('[role="radiogroup"]');
  const radios = [...(group?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)') ?? [])];
  const at = radios.indexOf(e.currentTarget);
  if (at < 0) return;
  e.preventDefault();
  const next =
    e.key === "Home" ? radios[0] : e.key === "End" ? radios[radios.length - 1] : radios[(at + step + radios.length) % radios.length];
  next.focus();
  next.click();
}

/**
 * Two-column task screen (writing, speaking) from lg width: the task on the
 * left, the answer controls on the right, the pair as tall as the room between
 * the header and the bottom bar so the answer field never starts below the
 * fold. Below lg the columns simply stack. The 8.5rem is the sticky header
 * (57px), the screen padding and the question heading above the pair.
 */
export const TASK_SPLIT =
  "lg:grid lg:h-[max(24rem,calc(100dvh-8.5rem-var(--step-footer-space,112px)-var(--step-notice-space,0px)))] lg:grid-cols-2 lg:gap-8";
export const TASK_LEFT = "lg:min-h-0 lg:overflow-y-auto lg:pe-2";
export const TASK_RIGHT = "mt-5 lg:mt-0 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto";
