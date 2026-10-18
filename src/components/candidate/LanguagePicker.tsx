"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LanguageFlag } from "@/components/candidate/LanguageFlag";
import { CANDIDATE_LANGUAGE_NAME as LANGUAGE_NAME, dirOf, type CandidateLocale } from "@/i18n/locale";
import { useT } from "@/i18n/candidate-client";

/**
 * Language is settled before the questions start, so the picker lives in the
 * frame (and on the section introductions), never on a question screen:
 * changing language halfway through an answer would move the ground under the
 * candidate.
 *
 * A compact button showing the current flag and name opens a menu with every
 * language. The menu is Radix's, so the arrow keys, Home/End, typeahead,
 * Escape and focus return come with it. Each choice is a plain link to
 * `?lang=xx`, which the server applies once and strips (see `enter()`).
 */
export function LanguagePicker({
  locales,
  current,
}: {
  locales: CandidateLocale[];
  current: CandidateLocale;
}) {
  const t = useT("common");
  if (locales.length < 2) return null;
  return (
    <DropdownMenu dir={dirOf(current)}>
      <DropdownMenuTrigger
        lang={current}
        aria-label={`${t("languageLabel")}: ${LANGUAGE_NAME[current]}`}
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-subtle px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-track focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=open]:bg-track motion-reduce:transition-none"
      >
        <LanguageFlag locale={current} />
        <span>{LANGUAGE_NAME[current]}</span>
        <ChevronDown aria-hidden className="size-4 text-ink-2" strokeWidth={2.25} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-auto min-w-[180px] p-1.5">
        {locales.map((locale) => (
          <DropdownMenuItem key={locale} asChild className="gap-3 px-2.5 py-2 text-[14px] font-semibold text-ink">
            <Link href={`?lang=${locale}`} lang={locale} hrefLang={locale} aria-current={locale === current ? "true" : undefined}>
              <LanguageFlag locale={locale} />
              <span className="flex-1">{LANGUAGE_NAME[locale]}</span>
              {locale === current ? <Check aria-hidden className="size-4 text-accent" strokeWidth={2.5} /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
