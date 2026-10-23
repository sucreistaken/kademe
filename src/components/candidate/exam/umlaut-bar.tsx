"use client";

import { useT } from "@/i18n/candidate-client";

const UMLAUTS = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"];

/** Inserts a character at the caret of the last focused field. */
export function UmlautBar({ onInsert }: { onInsert: (ch: string) => void }) {
  const t = useT("exam");
  return (
    <div className="mt-3 flex items-center gap-1.5" aria-label={t("umlautBar")}>
      {UMLAUTS.map((ch) => (
        <button
          key={ch}
          type="button"
          // Keep focus in the field so the character lands at the caret.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(ch)}
          className="size-8 rounded-[6px] border border-line bg-surface text-[15px] text-ink hover:bg-canvas"
        >
          {ch}
        </button>
      ))}
    </div>
  );
}

export function insertAt(el: HTMLInputElement | HTMLTextAreaElement | null, ch: string, current: string) {
  if (!el) return current + ch;
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + ch + current.slice(end);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + ch.length, start + ch.length);
  });
  return next;
}
