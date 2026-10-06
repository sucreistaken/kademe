// kademe-owned
"use client";

import Link from "next/link";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type RowMenuItem = { label: string; detail?: string; href?: string; onSelect?: () => void; disabledReason?: string };

/**
 * P2, P5: the secondary actions of a header, a card or a table row behind
 * "⋯". A closed item shows its reason inside the menu (RULES 5); an item that
 * leads somewhere is a real link.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const body = (item: RowMenuItem) => (
    <span className="flex flex-col items-start">
      <span>{item.label}</span>
      {item.disabledReason || item.detail ? <span className="text-[12px] leading-4 text-muted">{item.disabledReason ?? item.detail}</span> : null}
    </span>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" aria-label={label}>
          <Ellipsis className="size-4" strokeWidth={1.75} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {items.map((item) =>
          item.disabledReason ? (
            <DropdownMenuItem key={item.label} disabled>
              {body(item)}
            </DropdownMenuItem>
          ) : item.href ? (
            <DropdownMenuItem key={item.label} asChild>
              <Link href={item.href}>{body(item)}</Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
              {body(item)}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
