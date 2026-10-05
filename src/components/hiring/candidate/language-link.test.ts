import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LANGUAGE_WAIT_ID, LanguageLinkView, onLanguageClick } from "./language-link";

const view = (held: boolean) =>
  renderToStaticMarkup(createElement(LanguageLinkView, { href: "?lang=en#consent", locale: "en", held, waitReason: "Kayıt bitince dili değiştirebilirsin.", className: "x" }, "English"));

describe("the language link during a recording or an upload (Task 5 fix round 2, RULES 5)", () => {
  it("is inert while a capture holds the page: aria-disabled, its reason visible next to it and linked", () => {
    const html = view(true);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain(`aria-describedby="${LANGUAGE_WAIT_ID}"`);
    expect(html).toContain(`id="${LANGUAGE_WAIT_ID}"`);
    expect(html).toContain("Kayıt bitince dili değiştirebilirsin.");
    expect(html).toContain('href="?lang=en#consent"');
  });

  it("is a plain live link again once released, with no reason", () => {
    const html = view(false);
    expect(html).not.toContain("aria-disabled");
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("Kayıt bitince");
    expect(html).toContain('href="?lang=en#consent"');
  });

  it("stops the click while held and lets it through after (no confirm, no beforeunload)", () => {
    const held = { preventDefault: vi.fn() };
    onLanguageClick(true, held);
    expect(held.preventDefault).toHaveBeenCalledTimes(1);
    const free = { preventDefault: vi.fn() };
    onLanguageClick(false, free);
    expect(free.preventDefault).not.toHaveBeenCalled();
  });
});
