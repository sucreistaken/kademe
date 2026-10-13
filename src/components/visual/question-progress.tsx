// kademe-owned
import { cn } from "@/lib/cn";

/**
 * 3.6: one part per question of the stage; the words "Soru n / m" next to it
 * are what a reader hears. It shows where you are, never how you did: every
 * part behind you is the same green, answered or not.
 */
export function QuestionProgress({ total, current }: { total: number; current: number }) {
  return (
    <div aria-hidden className="flex h-2 w-full gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-2 flex-1 rounded-full", i + 1 < current ? "bg-accent" : i + 1 === current ? "bg-mint-fill" : "bg-hairline")} />
      ))}
    </div>
  );
}
