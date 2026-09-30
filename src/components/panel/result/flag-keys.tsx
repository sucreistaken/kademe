"use client";

import { useEffect } from "react";

/**
 * J / K move between flags, C confirms and D dismisses the focused one. Keys
 * are ignored while typing, so a note can contain those letters.
 */
export function FlagKeys() {
  useEffect(() => {
    let index = -1;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const flags = [...document.querySelectorAll<HTMLElement>("[data-flag]")];
      if (flags.length === 0) return;
      const key = e.key.toLowerCase();
      if (key === "j" || key === "k") {
        index = key === "j" ? Math.min(flags.length - 1, index + 1) : Math.max(0, index - 1);
        flags[index].scrollIntoView({ block: "center" });
        flags.forEach((f, i) => f.classList.toggle("ring-2", i === index));
        flags[index].classList.add("ring-line-strong");
      } else if ((key === "c" || key === "d") && index >= 0) {
        flags[index].querySelector<HTMLButtonElement>(`button[data-key="${key}"]`)?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
