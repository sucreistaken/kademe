import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { buildNav } from "@/solutions/registry";
import { ManagerNav } from "./nav";

const route = vi.hoisted(() => ({ pathname: "/exam/students/abc" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

const shared = { today: "Bugün", settings: "Ayarlar", advanced: "Gelişmiş" };

function render() {
  const nav = createElement(ManagerNav as never, { groups: buildNav("tr", shared), footer: null, mobileTitle: "Menü", mobileDescription: "Panel menüsü" } as never);
  return renderToStaticMarkup(createElement(SidebarProvider, null, nav));
}

describe("ManagerNav (P1)", () => {
  it("draws a hidden icon before every item's words and keeps the links, words and order", () => {
    const out = render();
    const items = [...out.matchAll(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map((m) => ({ href: m[1], inner: m[2] }));
    expect(items.map((i) => i.href)).toEqual([
      "/dashboard",
      "/dashboard",
      "/hiring/openings",
      "/exam/students",
      "/advanced",
      "/settings",
    ]);
    // The first link is the "Kademe" brand; every menu item is an icon plus its words.
    expect(items[0].inner).toBe("Kademe");
    for (const item of items.slice(1)) {
      expect(item.inner).toMatch(/^<svg [^>]*aria-hidden="true"[^>]*>.*<\/svg>[^<]+$/);
      expect(item.inner).not.toMatch(/tabindex|focusable="true"/);
    }
    expect(items.slice(1).map((i) => i.inner.replace(/<svg.*<\/svg>/, ""))).toEqual([
      "Bugün",
      "Alımlar",
      "Öğrenciler",
      "Gelişmiş",
      "Ayarlar",
    ]);
  });

  it("sizes the icons at 18px over the sidebar button's default 16px", () => {
    const out = render();
    const links = out.match(/<a [^>]*data-sidebar="menu-button"[^>]*>/g)!;
    expect(links).toHaveLength(5);
    for (const link of links) {
      expect(link).toContain("[&amp;_svg]:size-[18px]");
      expect(link).not.toContain("[&amp;_svg]:size-4");
    }
  });

  it("marks the item of the current page, by its path prefix", () => {
    const out = render();
    expect(out.match(/<a [^>]*aria-current="page"[^>]*>/g)).toHaveLength(1);
    expect(out).toMatch(/<a [^>]*href="\/exam\/students"[^>]*aria-current="page"|<a [^>]*aria-current="page"[^>]*href="\/exam\/students"/);
  });

  it.each(["/advanced", "/library/positions", "/library/competencies/c1", "/exam/exams", "/exam/exams/b1", "/exam/bank", "/exam/bank/items/i1"])(
    "marks Advanced on %s, the pages it leads to",
    (pathname) => {
      route.pathname = pathname;
      try {
        const current = render().match(/<a [^>]*aria-current="page"[^>]*>/g);
        expect(current).toHaveLength(1);
        expect(current![0]).toContain('href="/advanced"');
      } finally {
        route.pathname = "/exam/students/abc";
      }
    },
  );

  it.each(["/exam/banking", "/advancedx", "/libraryx"])("does not mark Advanced on %s, which only shares a prefix", (pathname) => {
    route.pathname = pathname;
    try {
      expect(render()).not.toMatch(/aria-current="page"/);
    } finally {
      route.pathname = "/exam/students/abc";
    }
  });
});
