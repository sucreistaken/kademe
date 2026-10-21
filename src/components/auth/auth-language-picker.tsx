"use client";

import { Check, ChevronDown } from "lucide-react";
import { setManagerLocale } from "@/app/(manager)/locale-action";
import { LanguageFlag } from "@/components/candidate/LanguageFlag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AUTH_LOCALES, CANDIDATE_LANGUAGE_NAME, type AuthLocale } from "@/i18n/locale";

/**
 * The sign-in screen's language choice: the same flag and name button the
 * student's exam frame uses, so the two front doors look alike. Each choice
 * submits a small form that writes the `kademe-lang` cookie. The forms sit
 * outside the menu, which is portalled, and the menu items point at them by id.
 */
export function AuthLanguagePicker({ current, label }: { current: AuthLocale; label: string }) {
  return (
    <>
      {AUTH_LOCALES.map((locale) => (
        <form key={locale} id={`auth-lang-${locale}`} action={setManagerLocale} hidden>
          <input type="hidden" name="locale" value={locale} />
        </form>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger
          lang={current}
          aria-label={`${label}: ${CANDIDATE_LANGUAGE_NAME[current]}`}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-subtle px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-track focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=open]:bg-track motion-reduce:transition-none"
        >
          <LanguageFlag locale={current} />
          <span>{CANDIDATE_LANGUAGE_NAME[current]}</span>
          <ChevronDown aria-hidden className="size-4 text-ink-2" strokeWidth={2.25} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-auto min-w-[180px] p-1.5">
          {AUTH_LOCALES.map((locale) => (
            <DropdownMenuItem key={locale} asChild className="gap-3 px-2.5 py-2 text-[14px] font-semibold text-ink">
              <button
                type="submit"
                form={`auth-lang-${locale}`}
                lang={locale}
                aria-current={locale === current ? "true" : undefined}
                className="w-full"
              >
                <LanguageFlag locale={locale} />
                <span className="flex-1 text-start">{CANDIDATE_LANGUAGE_NAME[locale]}</span>
                {locale === current ? <Check aria-hidden className="size-4 text-accent" strokeWidth={2.5} /> : null}
              </button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
