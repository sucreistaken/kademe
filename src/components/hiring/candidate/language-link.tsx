"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { Locale } from "@/i18n/locale";
import { captureHeld, captureHeldOnServer, captureUploadOnly, captureUploadOnlyOnServer, subscribeCapture } from "@/lib/client/capture-hold";
import { currentHash, noHash, subscribeHash } from "@/lib/client/hash-step";
import { cn } from "@/lib/cn";
import { langHref } from "./lang-href";

export const LANGUAGE_WAIT_ID = "language-wait";

/** Task 5 carry: the reason a held link gives names what holds the page, an upload or (otherwise) a recording. */
export function languageWaitText(uploadOnly: boolean, words: { recording: string; upload: string }): string {
  return uploadOnly ? words.upload : words.recording;
}

/** While a capture holds the page the click goes nowhere (no confirm, no beforeunload: the reason says it). */
export function onLanguageClick(held: boolean, event: { preventDefault(): void }) {
  if (held) event.preventDefault();
}

/** The link as drawn: live, or held with its reason next to it (RULES 5). */
export function LanguageLinkView({
  href,
  locale,
  held,
  waitReason,
  className,
  children,
}: {
  href: string;
  locale: Locale;
  held: boolean;
  waitReason: string;
  className: string;
  children?: ReactNode;
}) {
  return (
    <>
      {held ? (
        <span id={LANGUAGE_WAIT_ID} className="mr-2 text-[13px] leading-5 text-ink">
          {waitReason}
        </span>
      ) : null}
      <a
        href={href}
        lang={locale}
        aria-disabled={held || undefined}
        aria-describedby={held ? LANGUAGE_WAIT_ID : undefined}
        onClick={(event) => onLanguageClick(held, event)}
        className={cn(className, held && "cursor-not-allowed no-underline opacity-60 hover:text-muted")}
      >
        {children}
      </a>
    </>
  );
}

/**
 * The frame's link to the other language. A plain link on purpose: the server
 * applies `?lang=` and answers with a redirect, and only a document navigation
 * keeps the hash across it (a client navigation drops it, checked in Chrome),
 * so a switch on Consent stays on Consent. Never prefetched: `?lang=` writes the
 * choice to the invitation, which only a click may do. A full page load would
 * cut a recording or an upload, so while one runs (capture-hold) the link is
 * inert and says why.
 */
export function LanguageLink({
  locale,
  waitReason,
  uploadWaitReason,
  className,
  children,
}: {
  locale: Locale;
  /** The reason while a recording holds the page. */
  waitReason: string;
  /** The reason while only a file upload does. */
  uploadWaitReason: string;
  className: string;
  children: ReactNode;
}) {
  const hash = useSyncExternalStore(subscribeHash, currentHash, noHash);
  const held = useSyncExternalStore(subscribeCapture, captureHeld, captureHeldOnServer);
  const uploadOnly = useSyncExternalStore(subscribeCapture, captureUploadOnly, captureUploadOnlyOnServer);
  return (
    <LanguageLinkView href={langHref(locale, hash)} locale={locale} held={held} waitReason={languageWaitText(uploadOnly, { recording: waitReason, upload: uploadWaitReason })} className={className}>
      {children}
    </LanguageLinkView>
  );
}
