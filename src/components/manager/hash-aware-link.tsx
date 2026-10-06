// kademe-owned
import Link from "next/link";
import type { AnchorHTMLAttributes, Ref } from "react";

/**
 * A link inside the panel (B-M6: the one place for this switch). A target
 * with a hash (a step of team and rules' flow, the publish summary) is a
 * plain <a>: next/link fires no hashchange, so the page there would not hear
 * the hash (W3). Any other target is a Next link. Every other prop (class,
 * click handler, a Slot's ref when drawn asChild) reaches the anchor. No hook:
 * server pages and client components both draw it.
 */
export function HashAwareLink({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; ref?: Ref<HTMLAnchorElement> }) {
  return href.includes("#") ? <a href={href} {...rest} /> : <Link href={href} {...rest} />;
}
