// kademe-owned
import type { LucideIcon } from "lucide-react";

/** 3.1, 3.5: two or three facts the candidate plans with; the value first, its meaning under it. */
export function FactTiles({ items }: { items: Array<{ icon: LucideIcon; value: string; label: string }> }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map(({ icon: Icon, value, label }) => (
        <div key={label} className="flex min-w-0 flex-col-reverse gap-1 rounded-xl border border-line bg-surface p-3">
          <dt className="text-[13px] leading-5 text-muted">{label}</dt>
          <dd className="tnum flex items-center gap-2 text-[16px] leading-6 font-semibold text-ink">
            <Icon className="size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
            <span className="truncate">{value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
