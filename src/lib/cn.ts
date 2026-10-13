import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge knows Tailwind's own shadow sizes only; the named shadows in
 * globals.css (the lips, card, panel, modal, overlay) would otherwise be read
 * as shadow colours, and `shadow-lip shadow-none` would keep both.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: { shadow: ["lip", "lip-pressed", "lip-soft", "card", "panel", "panel-soft", "modal", "overlay"] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
