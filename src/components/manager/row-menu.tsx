// kademe-owned
"use client";

import { HashAwareLink } from "./hash-aware-link";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type RowMenuItem = { label: string; detail?: string; href?: string; onSelect?: () => void; disabledReason?: string };

/**
 * P2, P5: the secondary actions of a header, a card or a table row behind
 * "⋯". A closed item shows its reason inside the menu (RULES 5) and stays
 * reachable by the arrow keys (aria-disabled, not Radix `disabled`, which
 * skips it); an item that leads somewhere is a real link, a plain <a> when
 * its target carries a hash (next/link fires no hashchange).
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
        <Button size="icon" className="size-11" aria-label={label}>
          <Ellipsis className="size-4" strokeWidth={1.75} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {items.map((item, i) =>
          item.disabledReason ? (
            <DropdownMenuItem key={i} aria-disabled="true" className="opacity-60" onSelect={(event) => event.preventDefault()}>
              {body(item)}
            </DropdownMenuItem>
          ) : item.href ? (
            <DropdownMenuItem key={i} asChild>
              <HashAwareLink href={item.href}>{body(item)}</HashAwareLink>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={i} onSelect={item.onSelect}>
              {body(item)}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
