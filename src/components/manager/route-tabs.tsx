import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Tabs that are routes (HIRING-UX 5.4 "route sekmeleri"). The active tab is one
 * of the three places accent may appear.
 */
export function RouteTabs({
  label,
  items,
  size = "md",
}: {
  label: string;
  items: Array<{ href: string; label: string; active: boolean }>;
  size?: "md" | "sm";
}) {
  return (
    <nav aria-label={label} className="flex gap-6 overflow-x-auto border-b border-line">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 transition-colors",
            size === "md" ? "py-3 text-[14px]" : "py-2 text-[13px]",
            item.active ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
