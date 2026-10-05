// kademe-owned
import { cn } from "@/lib/cn";

/** G3: the preparation journey as a list of parts; numbers only, never a stage name (leak rule). */
export function JourneyProgress({ steps, current, label }: { steps: number; current: number; label: string }) {
  return (
    <ol aria-label={label} className="flex h-1 w-full gap-1">
      {Array.from({ length: steps }, (_, i) => (
        <li key={i} aria-current={i + 1 === current ? "step" : undefined} className="relative h-1 flex-1 overflow-hidden rounded-full bg-hairline">
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-0 left-0 rounded-full bg-ink-3 transition-[width] duration-[240ms] ease-soft motion-reduce:transition-none",
              i + 1 < current ? "w-full" : i + 1 === current ? "w-1/2" : "w-0",
            )}
          />
          <span className="sr-only">{i + 1}</span>
        </li>
      ))}
    </ol>
  );
}
