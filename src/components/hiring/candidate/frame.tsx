import Link from "next/link";
import type { Locale } from "@/i18n/locale";
import { candidateT } from "@/i18n/candidate";
import { Help } from "./help";

const NAMES: Record<Locale, string> = { tr: "Türkçe", en: "English" };

/**
 * HIRING-UX 6 "Ortak kurallar": the company's name, the language and help on
 * top, one column below (1000px frame). The subtree carries `lang`, so a
 * screen reader and `uppercase` follow the candidate's language.
 *
 * The language link is never prefetched: `?lang=` writes the choice to the
 * invitation, which only a click may do.
 */
export function HiringFrame({ locale, orgName, token, children }: { locale: Locale; orgName: string; token: string; children: React.ReactNode }) {
  const t = candidateT(locale);
  return (
    <div lang={locale} className="min-h-dvh bg-paper" style={{ "--card-radius": "12px" } as React.CSSProperties}>
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1000px] items-center justify-between gap-3 px-4 sm:px-7">
          <span className="min-w-0 truncate text-[14px] font-semibold text-ink">{orgName}</span>
          <span className="flex shrink-0 items-center gap-1">
            <nav aria-label={t("hiringFrame.languages")} className="flex items-center">
              {(["tr", "en"] as const).map((l) =>
                l === locale ? (
                  <span key={l} aria-current="true" className="flex min-h-11 items-center px-2 text-[14px] font-medium text-ink">
                    {NAMES[l]}
                  </span>
                ) : (
                  <Link
                    key={l}
                    href={`?lang=${l}`}
                    prefetch={false}
                    lang={l}
                    className="flex min-h-11 items-center rounded-lg px-2 text-[14px] text-muted underline decoration-underline underline-offset-4 hover:text-ink"
                  >
                    {NAMES[l]}
                  </Link>
                ),
              )}
            </nav>
            <Help token={token} />
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1000px] px-4 sm:px-7">{children}</main>
    </div>
  );
}
