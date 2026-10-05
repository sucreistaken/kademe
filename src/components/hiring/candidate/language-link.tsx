"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { Locale } from "@/i18n/locale";
import { subscribeHash } from "@/lib/client/hash-step";
import { langHref } from "./lang-href";

const currentHash = () => window.location.hash;
const noHash = () => "";

/**
 * The frame's link to the other language. A plain link on purpose: the server
 * applies `?lang=` and answers with a redirect, and only a document navigation
 * keeps the hash across it (a client navigation drops it, checked in Chrome),
 * so a switch on Consent stays on Consent. Never prefetched: `?lang=` writes the
 * choice to the invitation, which only a click may do.
 */
export function LanguageLink({ locale, className, children }: { locale: Locale; className: string; children: ReactNode }) {
  const hash = useSyncExternalStore(subscribeHash, currentHash, noHash);
  return (
    <a href={langHref(locale, hash)} lang={locale} className={className}>
      {children}
    </a>
  );
}
