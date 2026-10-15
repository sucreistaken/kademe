"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, FileText, IdCard, Library, Settings, Sun, Target, Users, type LucideIcon } from "lucide-react";
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
import { BrandLockup } from "@/components/visual/brand-mark";
import { cn } from "@/lib/cn";
import type { NavGroupView } from "@/solutions/registry";
import type { NavIcon } from "@/solutions/types";

/**
 * P1: each menu item's 18px icon, by the name the registry gives it. The size
 * goes on the button as `[&_svg]:size-[18px]` so tailwind-merge replaces
 * SidebarMenuButton's `[&_svg]:size-4`; a class on the icon alone loses to it.
 */
const ICONS: Record<NavIcon, LucideIcon> = {
  sun: Sun,
  briefcase: Briefcase,
  users: Users,
  "file-text": FileText,
  library: Library,
  "id-card": IdCard,
  target: Target,
  settings: Settings,
};

/**
 * HIRING-UX 4.1: one panel, a grouped side menu, no mode switch. The active
 * item is the current place, so it takes the accent (soft look, 2026-10-14):
 * a rounded brand-soft pill with bold accent text and a 2px accent lip under
 * it. Hover is the neutral sidebar ground, never green.
 *
 * The classes use the same `data-active:` variant as SidebarMenuButton's base
 * classes, so tailwind-merge replaces them instead of leaving two rules to
 * fight in the cascade. shadcn's `data-active` variant sits in `:where()` (no
 * specificity), so the base `hover:` ground would win on the active item; the
 * `data-active:hover:` pair keeps the active look under the pointer.
 */
const ACTIVE =
  "relative rounded-lg data-active:bg-brand-soft data-active:font-bold data-active:text-accent " +
  "data-active:hover:bg-brand-soft data-active:hover:text-accent " +
  "data-active:shadow-[0_2px_0_0_color-mix(in_srgb,var(--color-accent)_25%,transparent)]";

export function ManagerNav({
  groups,
  footer,
  mobileTitle,
  mobileDescription,
  byline,
}: {
  groups: NavGroupView[];
  footer: React.ReactNode;
  /** "a Campus German product", already in the panel's language. */
  byline: string;
  /** Screen-reader title and description of the sheet the menu becomes below 1024px. */
  mobileTitle: string;
  mobileDescription: string;
}) {
  const pathname = usePathname();
  return (
    <Sidebar mobileTitle={mobileTitle} mobileDescription={mobileDescription}>
      <SidebarHeader className="flex-row items-center px-4 py-4">
        <Link href="/dashboard">
          <BrandLockup byline={byline} />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.key} className={group.key === "settings" ? "mt-auto border-t border-line" : undefined}>
            {group.label ? (
              <SidebarGroupLabel className="text-[12px] font-bold text-muted">
                {group.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = [item.href, ...(item.activeFor ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
                  const Icon = ICONS[item.icon];
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} className={cn("h-9 text-[13.5px] text-ink-2 [&_svg]:size-[18px]", ACTIVE)}>
                        <Link href={item.href} aria-current={active ? "page" : undefined}>
                          <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
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
