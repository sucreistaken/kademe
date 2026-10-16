// kademe-owned
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type TileColor = "accent" | "neutral" | "sky" | "grape" | "sun" | "coral";

const SOFT: Record<TileColor, string> = {
  accent: "bg-accent-soft text-accent",
  neutral: "bg-cream text-ink",
  sky: "bg-sky-soft text-sky",
  grape: "bg-grape-soft text-grape",
  sun: "bg-sun-soft text-sun",
  coral: "bg-coral-soft text-coral",
};

/**
 * The icon tile, a soft rounded square with the icon in its tone: 40px in
 * rows and cards, 52px on the big start cards. "dashed" marks a card that
 * adds something new. `color` picks a family (globals.css): the legacy family
 * names (sky, grape, sun, coral) now resolve to neutrals and yellow, so use the
 * icon and the word, not the colour, to tell categories apart. Decorative: the
 * row's own words carry the meaning, so the tile is hidden from assistive technology.
 */
export function IconTile({ icon: Icon, size = "md", tone = "soft", color = "accent", className }: { icon: LucideIcon; size?: "md" | "lg"; tone?: "soft" | "dashed"; color?: TileColor; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center",
        size === "lg" ? "size-[52px] rounded-xl" : "size-10 rounded-lg",
        tone === "soft" ? SOFT[color] : "border-[1.5px] border-dashed border-underline text-muted",
        className,
      )}
    >
      <Icon className={size === "lg" ? "size-[26px]" : "size-[18px]"} strokeWidth={1.75} />
    </span>
  );
}
