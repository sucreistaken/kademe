// kademe-owned
import { cn } from "@/lib/cn";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

const TINT: Record<Difficulty, string> = {
  EASY: "bg-diff-easy border-diff-easy-lip",
  MEDIUM: "bg-diff-medium border-diff-medium-lip",
  HARD: "bg-diff-hard border-diff-hard-lip",
};

const STEPS: Record<Difficulty, 1 | 2 | 3> = { EASY: 1, MEDIUM: 2, HARD: 3 };

/** Three rising steps, the first `steps` filled in ink: the order without relying on colour. */
export function StepGlyph({ steps }: { steps: 1 | 2 | 3 }) {
  return (
    <svg viewBox="0 0 22 18" aria-hidden="true" focusable="false" className="h-3.5 w-auto shrink-0">
      {[
        { x: 1, y: 10, h: 7 },
        { x: 8, y: 5, h: 12 },
        { x: 15, y: 1, h: 16 },
      ].map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width="6" height={s.h} rx="2" data-step={i < steps ? "on" : "off"} className={i < steps ? "fill-ink" : "fill-ink/20"} />
      ))}
    </svg>
  );
}

/**
 * The difficulty of an invite (Kolay, Orta, Zor), teacher panel only: a soft
 * tint with ink text, the step glyph and the word (DESIGN.md "Color
 * psychology": the user kept cyan/yellow/red here; students never see it and
 * the printed level report never shows it).
 */
export function DifficultyChip({ difficulty, label, className }: { difficulty: Difficulty; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border-2 px-2.5 text-[13px] font-extrabold text-ink", TINT[difficulty], className)}>
      <StepGlyph steps={STEPS[difficulty]} />
      {label}
    </span>
  );
}
