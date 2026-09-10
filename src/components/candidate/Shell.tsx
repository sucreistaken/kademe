import Link from "next/link";
import { candidateT } from "@/i18n/candidate";
import type { Locale } from "@/i18n/locale";

/**
 * The candidate frame, straight off artboards A8, A9 and A12: a 56px bar over a
 * 1000px column on the paper ground. Vertical padding belongs to the screen,
 * not to the frame, because each artboard sets its own.
 *
 * `lang` sits on the subtree rather than only on <html>: the document is Turkish
 * for the manager panel, and CSS `text-transform: uppercase` follows the
 * element's language, so an English kicker under a Turkish root would render as
 * "WRİTTEN ANSWER". Screen readers pick the right voice from the same attribute.
 */
export function CandidateShell({
  locale,
  meta,
  language,
  header = true,
  children,
}: {
  locale: Locale;
  meta?: React.ReactNode;
  language?: React.ReactNode;
  /**
   * The closing cards on artboard A12 stand on the paper with no bar above
   * them. Nothing on those screens belongs in a frame: the flow is over, and
   * the bar would offer a brand and a language switch for a page with no next
   * question to read.
   */
  header?: boolean;
  children: React.ReactNode;
}) {
  const t = candidateT(locale);
  return (
    <div lang={locale} className="min-h-dvh bg-paper">
      {header ? (
      <header className="flex h-14 items-center justify-between gap-4 border-b border-hairline bg-surface px-7">
        <span className="text-sm font-bold tracking-[-0.02em] text-ink">
          {t("common.brand")}
        </span>
        <span className="flex items-center gap-4">
          {meta ? <span className="text-[12.5px] text-muted">{meta}</span> : null}
          {language}
        </span>
      </header>
      ) : null}
      <main className="mx-auto w-full max-w-[1000px]">{children}</main>
    </div>
  );
}

const LABEL: Record<Locale, string> = { tr: "Türkçe", en: "English" };

/**
 * Language is settled before the questions start, so the switch lives in the
 * frame rather than in the stage bar: changing language halfway through an
 * answer would move the ground under the candidate.
 */
export function LanguageSwitch({
  locales,
  current,
}: {
  locales: Locale[];
  current: Locale;
}) {
  if (locales.length < 2) return null;
  return (
    <span className="flex items-center gap-2 text-[12.5px]">
      {locales.map((locale) =>
        locale === current ? (
          <span key={locale} className="font-medium text-ink">
            {LABEL[locale]}
          </span>
        ) : (
          <Link
            key={locale}
            href={`?lang=${locale}`}
            className="text-muted underline decoration-underline underline-offset-2 hover:text-ink"
          >
            {LABEL[locale]}
          </Link>
        ),
      )}
    </span>
  );
}

/**
 * The reading column. Each artboard fixes its own width: 600 for the intro,
 * 720 for the device check and the written answer, 760 for the video answer,
 * 490 for the closing cards.
 */
export function CandidateColumn({
  width,
  padding = "px-7 pt-[52px] pb-[60px]",
  children,
}: {
  width: number;
  padding?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex justify-center ${padding}`}>
      <div className="w-full" style={{ maxWidth: width }}>
        {children}
      </div>
    </div>
  );
}
