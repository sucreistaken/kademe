// kademe-owned
import { cn } from "@/lib/cn";

/**
 * Kademe means "step": three rounded steps rising in the Campus German colours
 * (cyan, red, yellow: the tallest), each on a solid lip, on a white tile with a
 * cream lip (DESIGN.md, Brand & Style). `tone="ink"` is the one-colour version
 * for print and the level report. Decorative; the word next to it is the name.
 */
export function BrandMark({ className, tone = "color" }: { className?: string; tone?: "color" | "ink" }) {
  const ink = tone === "ink";
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false" className={cn("size-7 shrink-0", className)}>
      <rect x="0.8" y="2.4" width="26.4" height="25" rx="9" className={ink ? "fill-line" : "fill-lip"} />
      <rect x="0.8" y="0.8" width="26.4" height="25" rx="9" strokeWidth="1.6" className={cn("fill-surface", ink ? "stroke-line" : "stroke-lip")} />
      {ink ? null : <rect x="4.4" y="16.2" width="5.6" height="8" rx="2.8" className="fill-brand-lip" />}
      <rect x="4.4" y="15" width="5.6" height="7.6" rx="2.8" className={ink ? "fill-ink" : "fill-brand"} />
      {ink ? null : <rect x="11.2" y="12.2" width="5.6" height="12" rx="2.8" className="fill-red-lip" />}
      <rect x="11.2" y="11" width="5.6" height="11.6" rx="2.8" className={ink ? "fill-ink" : "fill-red"} />
      {ink ? null : <rect x="18" y="7.2" width="5.6" height="17" rx="2.8" className="fill-mascot-yellow-lip" />}
      <rect x="18" y="6" width="5.6" height="16.6" rx="2.8" className={ink ? "fill-ink" : "fill-yellow"} />
    </svg>
  );
}

/** The Campus German petals (red, yellow, cyan) as a small sign before the byline. Decorative. */
export function PetalGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 112" aria-hidden="true" focusable="false" className={cn("h-[13px] w-auto shrink-0", className)}>
      <path d="M30.8,0 H30.8 A30.8,30.8 0 0 1 61.6,30.8 V61.6 L61.6,61.6 H30.8 A30.8,30.8 0 0 1 0,30.8 V30.8 A30.8,30.8 0 0 1 30.8,0 Z" className="fill-red" />
      <path d="M80.95,23.3 H80.95 A19.35,19.35 0 0 1 100.3,42.65 V42.65 A19.35,19.35 0 0 1 80.95,62 H61.6 L61.6,62 V42.65 A19.35,19.35 0 0 1 80.95,23.3 Z" className="fill-yellow" />
      <path d="M37.2,62.3 H61.6 L61.6,62.3 V86.7 A24.4,24.4 0 0 1 37.2,111.1 H37.2 A24.4,24.4 0 0 1 12.8,86.7 V86.7 A24.4,24.4 0 0 1 37.2,62.3 Z" className="fill-brand" />
    </svg>
  );
}

/**
 * The mark, the name and its maker underneath. Kademe is presented as a Campus
 * German product on the front doors and frames: the login, the invite page, the
 * panel menu and the candidate bar. Not on the running exam's bar.
 */
export function BrandLockup({ byline, markClassName }: { byline: string; markClassName?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className={markClassName} />
      <span className="flex flex-col">
        <span className="text-[20px] font-black leading-[1.05] tracking-[-0.015em] text-ink">Kademe</span>
        <span className="flex items-center gap-1 text-[11.5px] font-bold leading-[1.1] text-muted">
          <PetalGlyph />
          {byline}
        </span>
      </span>
    </span>
  );
}
