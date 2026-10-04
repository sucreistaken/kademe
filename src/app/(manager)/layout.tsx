import Link from "next/link";
import { requireUser } from "@/server/session";
import { ManagerNav } from "@/components/manager/nav";
import { LangSwitch } from "@/components/manager/lang-switch";
import { ManagerIntl } from "@/components/manager/Intl";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

/**
 * Teacher panel shell. Five items, one per job: what to review today, the
 * students, the exams, the question bank, settings. Dense by design: the
 * student side is the calm one.
 *
 * NAV deliberately lists only routes that exist. A navigation item that lands
 * on a 404 is a dead end, and dead ends are the one thing the design rules do
 * not allow. Add the entry in the same commit as the screen.
 */
const NAV = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/exam/students", key: "students" },
  { href: "/exam/exams", key: "exams" },
  { href: "/exam/bank", key: "bank" },
  { href: "/settings", key: "settings" },
] as const;

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <div className="min-h-screen" lang={locale}>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-8 px-6">
          <Link href="/dashboard" className="text-[15px] font-semibold tracking-tight">
            Kademe
          </Link>
          <ManagerNav
            items={NAV.map((item) => ({
              href: item.href,
              label: t(`nav.${item.key}`),
            }))}
          />
          <div className="ml-auto flex items-center gap-2.5">
            <LangSwitch locale={locale} />
            <span className="text-[13.5px] text-muted">{user.name}</span>
            <span
              className="grid size-7 place-items-center rounded-full bg-canvas
                         text-[11px] font-semibold text-muted"
              aria-hidden
            >
              {initials}
            </span>
          </div>
        </div>
      </header>
      <ManagerIntl locale={locale}>{children}</ManagerIntl>
    </div>
  );
}
