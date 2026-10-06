import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState (P4)", () => {
  it("is a drawing, a title, one sentence and one action, never a dead end", () => {
    const out = renderToStaticMarkup(
      createElement(EmptyState, { illustration: "emptyOpenings", title: "İlk alımını aç.", body: "İlan metnini yapıştırman yeterli.", action: createElement("a", { href: "/hiring/openings/new" }, "Alım aç") }),
    );
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(out).toContain("İlk alımını aç.");
    expect(out).toContain("İlan metnini yapıştırman yeterli.");
    expect(out).toContain('href="/hiring/openings/new"');
  });

  it("names the empty list as a heading, so a screen reader can jump to it", () => {
    const out = renderToStaticMarkup(createElement(EmptyState, { illustration: "emptyOpenings", title: "Henüz alım yok." }));
    expect(out).toMatch(/<div[^>]*role="heading"[^>]*aria-level="2"[^>]*>Henüz alım yok\.<\/div>/);
    expect(out).not.toContain("data-slot=\"empty-content\"");
  });
});
