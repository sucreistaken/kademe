// kademe-owned
import { cn } from "@/lib/cn";

/** 3.6: one part per question of the stage; the words "Soru n / m" next to it are what a reader hears. */
export function QuestionProgress({ total, current }: { total: number; current: number }) {
  return (
    <div aria-hidden className="flex h-1 w-full gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-1 flex-1 rounded-full", i + 1 < current ? "bg-ink-3" : i + 1 === current ? "bg-ink-3/60" : "bg-hairline")} />
      ))}
    </div>
  );
}
