import Link from "next/link";
import { BrandLockup } from "@/components/visual/brand-mark";
import { candidateT } from "@/i18n/candidate";
import { dirOf, type CandidateLocale } from "@/i18n/locale";

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
  wide = false,
  children,
}: {
  locale: CandidateLocale;
  meta?: React.ReactNode;
  language?: React.ReactNode;
  /**
   * The closing cards on artboard A12 stand on the paper with no bar above
   * them. Nothing on those screens belongs in a frame: the flow is over, and
   * the bar would offer a brand and a language switch for a page with no next
   * question to read.
   */
  header?: boolean;
  /**
   * No 1000px cap on the main area. The exam page uses it so the two-column
   * reading view can use the width it asks for; every other screen of the exam
   * centres its own column.
   */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const t = candidateT(locale);
  return (
    <div lang={locale} dir={dirOf(locale)} className="min-h-dvh bg-paper">
      {header ? (
      <header className="flex h-16 items-center justify-between gap-4 border-b border-hairline bg-surface px-5 sm:px-7">
        <BrandLockup byline={t("common.byline")} />
        <span className="flex min-w-0 items-center gap-3">
          {meta ? (
            <span className="hidden min-w-0 truncate rounded-full bg-subtle px-3 py-1 text-[12.5px] font-semibold text-ink-2 md:inline">{meta}</span>
          ) : null}
          {language}
        </span>
      </header>
      ) : null}
      <main className={wide ? "mx-auto w-full" : "mx-auto w-full max-w-[1000px]"}>{children}</main>
    </div>
  );
}

const LABEL: Record<CandidateLocale, string> = {
  tr: "Türkçe",
  en: "English",
  de: "Deutsch",
  es: "Español",
  ar: "العربية",
};

/**
 * Language is settled before the questions start, so the switch lives in the
 * frame rather than in the stage bar: changing language halfway through an
 * answer would move the ground under the candidate.
 */
export function LanguageSwitch({
  locales,
  current,
}: {
  locales: CandidateLocale[];
  current: CandidateLocale;
}) {
  if (locales.length < 2) return null;
  // A small segmented control: the current language is the raised pill.
  return (
    <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-subtle p-0.5 text-[12.5px]">
      {locales.map((locale) =>
        locale === current ? (
          <span key={locale} className="rounded-full bg-surface px-3 py-1 font-bold text-ink shadow-lip-soft">
            {LABEL[locale]}
          </span>
        ) : (
          <Link
            key={locale}
            href={`?lang=${locale}`}
            lang={locale}
            className="rounded-full px-3 py-1 font-semibold text-muted transition-colors hover:text-ink"
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
