"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Today's "Davet et" when the user may invite for more than one solution; outline while another button on the screen is the filled one. */
export function InviteMenu({
  label,
  items,
  variant = "primary",
}: {
  label: string;
  items: Array<{ key: string; href: string; label: string }>;
  variant?: "primary" | "secondary";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button id="today-invite" variant={variant}>
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

/**
 * Today's "Davet et" for a user who may invite for no solution: disabled, its
 * reason on screen and linked to the button (aria-describedby, id + -why).
 */
export function InviteUnavailable({ label, reason, variant = "primary" }: { label: string; reason: string; variant?: "primary" | "secondary" }) {
  return (
    <div className="flex flex-col items-end">
      <Button id="today-invite" variant={variant} disabled disabledReason={reason}>
        {label}
      </Button>
      <DisabledReason id="today-invite-why">{reason}</DisabledReason>
    </div>
  );
}
