import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { frozenMarkup } from "@/components/visual/frozen-markup";
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

describe("EmptyState's card look stays, the page look is the mockup's (screen 8)", () => {
  const CASES = [
    { illustration: "emptyOpenings", title: "İlk alımını aç.", body: "Bir cümle.", action: createElement("a", { href: "/hiring/openings/new" }, "Alım aç"), className: "mt-section" },
    { illustration: "emptyToday", title: "Bugün bekleyen iş yok." },
  ];
  const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(EmptyState as never, props as never));

  it("draws the card look exactly as before", () => {
    const now = CASES.map(html);
    expect(now).toEqual(frozenMarkup("src/components/manager/empty-state.default-markup.json", now));
  });

  it("page: no card, the big drawing, a 24px title and the sentence in ink-2", () => {
    const out = html({ variant: "page", illustration: "emptyOpenings", title: "İlk alımını aç.", body: "Bir cümle.", action: createElement("a", { href: "/x" }, "Alım aç") });
    expect(out).not.toContain("border border-line bg-surface py-14");
    expect(out).toContain("w-[380px] max-w-full");
    expect(out).toContain("mt-2 text-[24px] leading-8 font-semibold text-ink");
    expect(out).toContain("text-ink-2");
  });
});
