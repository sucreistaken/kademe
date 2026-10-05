// kademe-owned
"use client";

import { useEffect, useRef } from "react";
import { shortcutChoice } from "./choice-keys";

/**
 * Task 4 carry 7: the one listener behind every choice card group that shows
 * key hints (ChoiceCardGroup's `shortcut`): the digit 1-9 picks the choice in
 * that place, never while the candidate types into a field (shortcutChoice).
 * A closed group listens to nothing. `onPick` is read through a ref, so the
 * listener is bound once per group and size.
 */
export function useChoiceShortcuts(input: { count: number; disabled: boolean; onPick: (index: number) => void }) {
  const { count, disabled, onPick } = input;
  const latest = useRef(onPick);
  useEffect(() => {
    latest.current = onPick;
  });
  useEffect(() => {
    if (disabled || count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? { tagName: e.target.tagName, type: (e.target as HTMLInputElement).type, isContentEditable: e.target.isContentEditable } : null;
      const index = shortcutChoice({ key: e.key, target, defaultPrevented: e.defaultPrevented, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey }, count);
      if (index === null) return;
      e.preventDefault();
      latest.current(index);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count, disabled]);
}
