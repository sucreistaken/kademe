import type { CandidateLocale } from "@/i18n/locale";

const BOX = "h-4 w-6 shrink-0 rounded-[3px] ring-1 ring-ink/10";

/**
 * The small flag in the language picker, drawn inline so nothing is fetched.
 * Simplified on purpose: at 24x16 only the colours and the main shapes read.
 * Arabic is spoken in many countries, so it gets a letter badge instead of
 * one country's flag.
 */
export function LanguageFlag({ locale }: { locale: CandidateLocale }) {
  if (locale === "ar") {
    return (
      <span aria-hidden className={`${BOX} grid place-items-center bg-accent-soft text-[13px] font-bold leading-none text-accent-deep`} lang="ar">
        ع
      </span>
    );
  }
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 24 16" className={BOX}>
      {locale === "tr" ? (
        <>
          <rect width="24" height="16" fill="#e30a17" />
          <circle cx="9" cy="8" r="4" fill="#fff" />
          <circle cx="10.2" cy="8" r="3.2" fill="#e30a17" />
          <polygon fill="#fff" points="14.60,5.90 15.07,7.35 16.60,7.35 15.36,8.25 15.83,9.70 14.60,8.80 13.37,9.70 13.84,8.25 12.60,7.35 14.13,7.35" />
        </>
      ) : null}
      {locale === "en" ? (
        <>
          <rect width="24" height="16" fill="#012169" />
          <path d="M0 0L24 16M24 0L0 16" stroke="#fff" strokeWidth="3.2" />
          <path d="M0 0L24 16M24 0L0 16" stroke="#c8102e" strokeWidth="1.1" />
          <path d="M12 0V16M0 8H24" stroke="#fff" strokeWidth="5.2" />
          <path d="M12 0V16M0 8H24" stroke="#c8102e" strokeWidth="3" />
        </>
      ) : null}
      {locale === "de" ? (
        <>
          <rect width="24" height="16" fill="#000" />
          <rect y="5.33" width="24" height="5.34" fill="#dd0000" />
          <rect y="10.67" width="24" height="5.33" fill="#ffce00" />
        </>
      ) : null}
      {locale === "es" ? (
        <>
          <rect width="24" height="16" fill="#aa151b" />
          <rect y="4" width="24" height="8" fill="#f1bf00" />
        </>
      ) : null}
    </svg>
  );
}
