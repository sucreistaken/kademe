import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouteTabs } from "./route-tabs";
import { tabClearsHash } from "./route-tab-link";

/**
 * B-M8: a route tab to the page already shown, pressed while a hash step is
 * open there (settings#team-members, the overview's #publish): next/link
 * changes the address without a hashchange, so the step would stay on screen.
 * The tab takes the hash away instead, and the page's view comes back.
 */
describe("a route tab pressed on its own page while a hash step is open", () => {
  it("clears the hash only for a tab to this very path while the address has one", () => {
    const here = (pathname: string, hash: string) => ({ pathname, hash });
    expect(tabClearsHash("/hiring/openings/o1/settings", here("/hiring/openings/o1/settings", "#team-members"))).toBe(true);
    expect(tabClearsHash("/hiring/openings/o1", here("/hiring/openings/o1", "#publish"))).toBe(true);
    expect(tabClearsHash("/hiring/openings/o1/settings", here("/hiring/openings/o1/settings", ""))).toBe(false);
    expect(tabClearsHash("/hiring/openings/o1/candidates", here("/hiring/openings/o1/settings", "#team-members"))).toBe(false);
    expect(tabClearsHash("/hiring/openings/o1", here("/hiring/openings/o1/settings", "#team-members"))).toBe(false);
  });

  it("draws the tabs with the same markup as before", () => {
    const html = renderToStaticMarkup(
      createElement(RouteTabs, {
        label: "Alım sekmeleri",
        items: [
          { href: "/x", label: "Genel bakış", active: true },
          { href: "/x/settings", label: "Ekip ve kurallar", active: false },
        ],
      }),
    );
    expect(html).toBe(
      '<nav aria-label="Alım sekmeleri" class="flex gap-6 overflow-x-auto border-b border-line">' +
        '<a aria-current="page" class="-mb-px shrink-0 border-b-2 transition-colors py-3 text-[14px] border-accent font-medium text-accent" href="/x">Genel bakış</a>' +
        '<a class="-mb-px shrink-0 border-b-2 transition-colors py-3 text-[14px] border-transparent text-muted hover:text-ink" href="/x/settings">Ekip ve kurallar</a>' +
        "</nav>",
    );
  });
});
