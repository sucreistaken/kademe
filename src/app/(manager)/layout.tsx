import Link from "next/link";
import { requireUser } from "@/server/session";
import { ManagerNav } from "@/components/manager/nav";
import { LangSwitch } from "@/components/manager/lang-switch";
import { ManagerIntl } from "@/components/manager/Intl";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { buildNav } from "@/solutions/registry";

/**
 * Panel shell (HIRING-UX 4.1): a 240px grouped side menu (Today, one group per
 * solution, the shared Library, Settings) and the page. Below 1024px the menu
 * becomes a sheet opened from a top bar. The menu comes from the solution registry and lists
 * only routes that exist; a test checks every entry against its page file.
 */
export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  // Locale aware on purpose: `toUpperCase()` turns "İpek" into "IPEK".
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase(locale === "tr" ? "tr" : "en");
  const groups = buildNav(locale, {
    today: t("nav.dashboard"),
    settings: t("nav.settings"),
    library: { label: t("nav.library"), positions: t("nav.positions"), competencies: t("nav.competencies") },
  });

  return (
    <SidebarProvider lang={locale} style={{ "--sidebar-width": "240px" } as React.CSSProperties}>
      <ManagerNav
        groups={groups}
        mobileTitle={t("nav.menuTitle")}
        mobileDescription={t("nav.menuDescription")}
        footer={
          <div className="flex items-center gap-2.5">
            <LangSwitch locale={locale} />
            <span className="truncate text-[13px] text-muted">{user.name}</span>
            <span
              className="ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-canvas text-[11px] font-semibold text-muted"
              aria-hidden
            >
              {initials}
            </span>
          </div>
        }
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
          <SidebarTrigger aria-label={t("nav.openMenu")} />
          <Link href="/dashboard" className="text-[15px] font-semibold tracking-tight">
            Kademe
          </Link>
        </header>
        <ManagerIntl locale={locale}>{children}</ManagerIntl>
      </div>
    </SidebarProvider>
  );
}
