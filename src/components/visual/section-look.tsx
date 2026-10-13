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
 * Each exam section keeps one pastel family and one icon wherever it appears
 * (the intro list, the finish screen, a section's own start screen), so a
 * student learns the five parts by colour as well as by name. A category
 * colour only: it never says how a section went.
 */
export const SECTION_LOOK: Record<SectionKey, { color: Exclude<TileColor, "neutral">; icon: LucideIcon }> = {
  GRAMMAR: { color: "grape", icon: Puzzle },
  READING: { color: "sky", icon: BookOpen },
  LISTENING: { color: "coral", icon: Headphones },
  WRITING: { color: "sun", icon: PenLine },
  SPEAKING: { color: "accent", icon: Mic },
};

/** The section's icon tile; decorative (the section's name next to it is what a reader hears). */
export function SectionTile({ section, size = "md", className }: { section: SectionKey; size?: "md" | "lg"; className?: string }) {
  const look = SECTION_LOOK[section];
  return <IconTile icon={look.icon} color={look.color} size={size} className={className} />;
}
