// kademe-owned
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Manager mockup (2026-10-06): the panel's icon tile, a soft square with the
 * icon in the accent: 40px in rows and cards, 52px on the big start cards.
 * "dashed" marks a card that adds something new. color "neutral" draws the
 * tile in bg-secondary and ink (the warm clock tile is never amber). Decorative: the row's own
 * words carry the meaning, so the tile is hidden from assistive technology.
 */
export function IconTile({ icon: Icon, size = "md", tone = "soft", color = "accent", className }: { icon: LucideIcon; size?: "md" | "lg"; tone?: "soft" | "dashed"; color?: "accent" | "neutral"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center",
        size === "lg" ? "size-[52px] rounded-xl" : "size-10 rounded-[10px]",
        tone === "soft" ? (color === "neutral" ? "bg-secondary text-ink" : "bg-accent-soft text-accent") : "border-[1.5px] border-dashed border-underline text-muted",
        className,
      )}
    >
      <Icon className={size === "lg" ? "size-[26px]" : "size-[18px]"} strokeWidth={1.75} />
    </span>
  );
}
