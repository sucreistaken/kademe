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
    expect(h).toContain("bg-yellow");
    expect(h).not.toMatch(/danger|text-red|bg-red/);
  });

  it("neutral is cream with ink text", () => {
    expect(NOTICE_CLASS.neutral).toContain("bg-cream");
  });
});
