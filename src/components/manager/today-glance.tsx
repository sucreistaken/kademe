// kademe-owned
import Link from "next/link";
import { cn } from "@/lib/cn";

export type GlanceTile = {
  key: string;
  label: string;
  sub: string;
  count: number;
  href: string;
  /** The one tile that asks something of the manager; it gets the soft shadow (the accent is not used for borders or numbers). */
  emphasis?: boolean;
};

/**
 * Today at one look: how much waits for the manager, how much the AI is still
 * preparing, who is in an exam and which links run out. Each tile is a link to
 * its own part of the page, so the number always leads somewhere.
 */
export function TodayGlance({ tiles, label }: { tiles: GlanceTile[]; label: string }) {
  return (
    <nav aria-label={label} className={cn("grid grid-cols-2 gap-3", tiles.length > 4 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
      {tiles.map((tile) => (
        <Link
          key={tile.key}
          href={tile.href}
          className={cn(
            "rounded-2xl border bg-surface px-[18px] py-4 hover:bg-canvas",
            "border-line", tile.emphasis && tile.count > 0 && "shadow-panel-soft",
          )}
        >
          <span className="block text-[13px] font-medium text-ink-2">{tile.label}</span>
          <span className={cn("tnum mt-1 block text-[32px] leading-9 font-semibold", tile.count > 0 ? "text-ink" : "text-muted")}>{tile.count}</span>
          <span className="mt-0.5 block text-[12.5px] text-muted">{tile.sub}</span>
        </Link>
      ))}
    </nav>
  );
}
