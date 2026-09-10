"use client";

import { NextIntlClientProvider } from "next-intl";
import { managerMessagesFor } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";

/**
 * Wraps the manager tree with its dictionary. A client component for the same
 * reason as `CandidateIntl`: there is deliberately no request-level i18n config
 * in this application, and looking the dictionary up here keeps it out of the
 * RSC payload.
 */
export function ManagerIntl({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={managerMessagesFor(locale)}>
      {children}
    </NextIntlClientProvider>
  );
}
