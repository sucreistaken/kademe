// kademe-owned
"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { clearHash } from "@/lib/client/hash-step";

/**
 * B-M8: true when a tab leads to the page already shown (its path) while the
 * address holds a hash step there (settings#team-members, the overview's
 * #publish). next/link would change the address without a hashchange, so
 * the step would stay on screen; the hash is taken away instead.
 */
export function tabClearsHash(href: string, here: { pathname: string; hash: string }): boolean {
  return here.hash !== "" && href.split(/[?#]/)[0] === here.pathname;
}

/**
 * One route tab (RouteTabs): a Next link that, pressed on its own page while
 * a hash step is open, leaves the step (clearHash: same path and query, a
 * hashchange the page's flow hears) instead of navigating to the address
 * already shown. A modified click (new tab, new window) is left to the browser.
 */
export function RouteTabLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  return (
    <Link
      {...rest}
      href={href}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (!tabClearsHash(href, window.location)) return;
        event.preventDefault();
        clearHash();
      }}
    />
  );
}
