import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Notice, NOTICE_CLASS } from "./notice";

describe("Notice", () => {
  it("warn is yellow-soft with ink text and a yellow glyph, never red", () => {
    expect(NOTICE_CLASS.warn).toContain("bg-yellow-soft");
    expect(NOTICE_CLASS.warn).toContain("text-ink");
    const h = renderToStaticMarkup(createElement(Notice, { role: "alert" } as ComponentProps<typeof Notice>, "Kamera açılamadı."));
    expect(h).toContain('role="alert"');
    // The "!" glyph itself is the yellow tile (bg-yellow-soft on the notice would not satisfy this).
    const glyph = h.match(/<span[^>]*class="([^"]*)"[^>]*>!<\/span>/);
    expect(glyph).not.toBeNull();
    expect(glyph![0]).toMatch(/\bbg-yellow\b(?!-)/);
    expect(glyph![0]).toContain('aria-hidden="true"');
    expect(h).not.toMatch(/danger|text-red|bg-red/);
  });

  it("is start-aligned by default and lets a caller's text-center win", () => {
    for (const tone of ["warn", "neutral"] as const) expect(NOTICE_CLASS[tone]).toContain("text-start");
    const h = renderToStaticMarkup(createElement(Notice, { className: "text-center" } as ComponentProps<typeof Notice>, "Hi"));
    expect(h).toContain("text-center");
    expect(h).not.toContain("text-start");
  });

  it("neutral is cream with ink text", () => {
    expect(NOTICE_CLASS.neutral).toContain("bg-cream");
  });
});
