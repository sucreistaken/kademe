// kademe-owned
import { cn } from "@/lib/cn";

/**
 * Kademe means "step": three rounded steps rising, in the brand green and two
 * of its soft tones, on a soft rounded tile. Decorative; the word next to it
 * is the name. Drawn on the candidate frame and at the top of the panel menu.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false" className={cn("size-7 shrink-0", className)}>
      <rect width="28" height="28" rx="9" className="fill-accent-soft" />
      <rect x="5.5" y="15" width="5" height="7.5" rx="2.5" className="fill-mint-fill" />
      <rect x="11.5" y="11" width="5" height="11.5" rx="2.5" className="fill-accent/70" />
      <rect x="17.5" y="6" width="5" height="16.5" rx="2.5" className="fill-accent" />
    </svg>
  );
}

/**
 * The mark, the name and its maker underneath. Kademe is presented as a Campus
 * German product (user decision 2026-10-15) on the front doors and frames: the
 * login, the invite page, the panel menu and the candidate bar. Not on the
 * running exam's bar, where a question is the only thing to read.
 */
export function BrandLockup({ byline, markClassName }: { byline: string; markClassName?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className={markClassName} />
      <span className="flex flex-col">
        <span className="text-[17px] font-extrabold leading-[1.1] tracking-[-0.01em] text-ink">Kademe</span>
        <span className="text-[11px] font-semibold leading-[1.3] text-muted">{byline}</span>
      </span>
    </span>
  );
}
