"use client";

import { NextIntlClientProvider } from "next-intl";
import { messagesFor } from "@/i18n/candidate";
import type { Locale } from "@/i18n/locale";

/**
 * Wraps the candidate tree with its dictionary.
 *
 * It is a client component on purpose: the server variant of the provider
 * reaches for a request-level i18n config, and the candidate locale does not
 * come from the request, it comes from the assessment the token resolves to.
 * Looking the dictionary up here also keeps it out of the RSC payload.
 */
export function CandidateIntl({
  locale,
  timeZone,
  children,
}: {
  locale: Locale;
  /** ORG_TIMEZONE, read on the server: the browser has no access to it. */
  timeZone: string;
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messagesFor(locale)} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
