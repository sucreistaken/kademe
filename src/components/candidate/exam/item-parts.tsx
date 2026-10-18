import type { KeyboardEvent } from "react";

/** Pieces shared by the item renderers. */

export function Instruction({ text }: { text: string }) {
  return <p className="whitespace-pre-line border-l-[3px] border-brand pl-3 text-[15px] leading-[1.55] text-ink">{text}</p>;
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
