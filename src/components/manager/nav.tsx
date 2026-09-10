"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * The active item is one of the three places the accent colour is allowed to
 * appear. It is a text colour plus a soft background, never a filled pill that
 * would compete with the screen's single primary button.
 */
export function ManagerNav({
  items,
}: {
  items: Array<{ href: string; label: string }>;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-[8px] px-3 py-1.5 text-[13.5px]",
              active
                ? "bg-accent-soft text-accent font-medium"
                : "text-muted hover:bg-canvas hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
