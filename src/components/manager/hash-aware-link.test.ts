import { describe, expect, it } from "vitest";
import Link from "next/link";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HashAwareLink } from "./hash-aware-link";

/**
 * B-M6: the one switch for a link inside the panel: a target with a hash is a
 * plain <a> (next/link fires no hashchange, so the flow there would not hear
 * it, W3); any other target stays a Next link. Classes and other attributes
 * reach the anchor unchanged.
 */
describe("HashAwareLink", () => {
  it("draws a hash target as a plain anchor and anything else as a Next link, with the same props", () => {
    const hash = HashAwareLink({ href: "/hiring/openings/o1/settings#team-members", className: "c", children: "Ekibi ata" }) as ReactElement<Record<string, unknown>>;
    expect(hash.type).toBe("a");
    expect(hash.props).toMatchObject({ href: "/hiring/openings/o1/settings#team-members", className: "c", children: "Ekibi ata" });
    const page = HashAwareLink({ href: "/hiring/openings/o1", className: "c", children: "Aç" }) as ReactElement<Record<string, unknown>>;
    expect(page.type).toBe(Link);
    expect(page.props).toMatchObject({ href: "/hiring/openings/o1", className: "c", children: "Aç" });
  });

  it("renders the same markup as the copies it replaced", () => {
    expect(renderToStaticMarkup(createElement(HashAwareLink, { href: "/x#publish", className: "c" }, "Yayın"))).toBe('<a href="/x#publish" class="c">Yayın</a>');
    expect(renderToStaticMarkup(createElement(HashAwareLink, { href: "/x", className: "c" }, "Aç"))).toBe(renderToStaticMarkup(createElement(Link, { href: "/x", className: "c" }, "Aç")));
  });
});
