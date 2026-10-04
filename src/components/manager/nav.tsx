"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/cn";
import type { NavGroupView } from "@/solutions/registry";

/**
 * HIRING-UX 4.1: one panel, a grouped side menu, no mode switch. The active
 * item is one of the three places the accent colour may appear: accent text on
 * the brand-soft ground with a 2px accent line on the left. Hover is the
 * neutral sidebar ground, never green.
 *
 * The classes use the same `data-active:` variant as SidebarMenuButton's base
 * classes, so tailwind-merge replaces them instead of leaving two rules to
 * fight in the cascade. shadcn's `data-active` variant sits in `:where()` (no
 * specificity), so the base `hover:` ground would win on the active item; the
 * `data-active:hover:` pair keeps the active look under the pointer.
 */
const ACTIVE =
  "relative data-active:bg-brand-soft data-active:font-medium data-active:text-accent " +
  "data-active:hover:bg-brand-soft data-active:hover:text-accent " +
  "data-active:before:absolute data-active:before:inset-y-1.5 data-active:before:left-0 " +
  "data-active:before:w-0.5 data-active:before:rounded-full data-active:before:bg-accent";

export function ManagerNav({ groups, footer }: { groups: NavGroupView[]; footer: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <Link href="/dashboard" className="text-[15px] font-semibold tracking-tight text-ink">
          Kademe
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.key} className={group.key === "settings" ? "mt-auto border-t border-line" : undefined}>
            {group.label ? (
              <SidebarGroupLabel className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted">
                {group.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} className={cn("h-9 text-[13.5px] text-ink-2", ACTIVE)}>
                        <Link href={item.href} aria-current={active ? "page" : undefined}>
                          {item.label}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-line px-4 py-3">{footer}</SidebarFooter>
    </Sidebar>
  );
}
