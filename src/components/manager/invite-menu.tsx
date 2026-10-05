"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Today's "Davet et" when the user may invite for more than one solution. */
export function InviteMenu({ label, items }: { label: string; items: Array<{ key: string; href: string; label: string }> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button id="today-invite" variant="primary">
          {label}
          <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-48">
        {items.map((item) => (
          <DropdownMenuItem key={item.key} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
