// kademe-owned
import { BookOpen, Headphones, Mic, PenLine, Puzzle, type LucideIcon } from "lucide-react";
import { IconTile, type TileColor } from "./icon-tile";

/**
 * The exam's section names, spelled out here rather than imported: visual
 * blocks are core and may not reach into the exam engine (solutions/boundary
 * test). An exam `Section` is assignable to it.
 */
export type SectionKey = "GRAMMAR" | "READING" | "LISTENING" | "WRITING" | "SPEAKING";

/**
 * Each exam section keeps one icon wherever it appears; the tile is neutral
 * (Campus German redesign: sections are icon + word, never five colours).
 * It shows in the intro list, the finish screen and a section's own start
 * screen, so a student learns the five parts by icon as well as by name. A
 * category marker only: it never says how a section went.
 */
export const SECTION_LOOK: Record<SectionKey, { color: TileColor; icon: LucideIcon }> = {
  GRAMMAR: { color: "neutral", icon: Puzzle },
  READING: { color: "neutral", icon: BookOpen },
  LISTENING: { color: "neutral", icon: Headphones },
  WRITING: { color: "neutral", icon: PenLine },
  SPEAKING: { color: "neutral", icon: Mic },
};

/** The section's icon tile; decorative (the section's name next to it is what a reader hears). */
export function SectionTile({ section, size = "md", className }: { section: SectionKey; size?: "md" | "lg"; className?: string }) {
  const look = SECTION_LOOK[section];
  return <IconTile icon={look.icon} color={look.color} size={size} className={className} />;
}
