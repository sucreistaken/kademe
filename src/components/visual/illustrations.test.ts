import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Illustration, ILLUSTRATION_NAMES } from "./illustrations";

const ALLOWED = /^(none|var\(--color-illus-(line|fill|tint|sage|warm)\))$/;

describe("illustrations (HIRING-VISUAL-FLOW 2.2, K1)", () => {
  it("has the eleven candidate and four panel drawings", () => {
    expect(ILLUSTRATION_NAMES).toHaveLength(15);
    expect(new Set(ILLUSTRATION_NAMES).size).toBe(15);
  });

  it.each(ILLUSTRATION_NAMES)("%s is hidden from assistive tech, inline only, and drawn with the illustration tones", (name) => {
    const html = renderToStaticMarkup(createElement(Illustration, { name }));
    expect(html).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(html).toContain('focusable="false"');
    // No file, no link, no text to translate, nothing pulled from elsewhere.
    expect(html).not.toMatch(/<image|<img|href=|<text|<foreignObject|url\(/i);
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).not.toContain("--color-accent");
    const colours = [...html.matchAll(/\s(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThan(3);
    for (const colour of colours) expect(colour, `${name}: ${colour}`).toMatch(ALLOWED);
  });

  it("sizes by role: hero 400 wide at most, a spot 160, the phone screen 342", () => {
    expect(renderToStaticMarkup(createElement(Illustration, { name: "welcome", size: "hero" }))).toContain("max-w-[400px]");
    expect(renderToStaticMarkup(createElement(Illustration, { name: "closed", size: "spot" }))).toContain("w-[160px]");
    expect(renderToStaticMarkup(createElement(Illustration, { name: "desktopOnly", size: "phone" }))).toContain("max-w-[342px]");
  });
});
