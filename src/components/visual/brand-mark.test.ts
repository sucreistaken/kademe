import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLockup, BrandMark, PetalGlyph } from "./brand-mark";

const html = (el: unknown, props: object = {}) => renderToStaticMarkup(createElement(el as never, props));

describe("BrandMark", () => {
  it("draws three steps in cyan, red and yellow (the tallest), each on its own lip", () => {
    const h = html(BrandMark);
    for (const c of ["fill-brand", "fill-brand-lip", "fill-red", "fill-red-lip", "fill-yellow", "fill-mascot-yellow-lip"]) expect(h).toContain(c);
    expect(h).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(h).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("has a one-colour ink version for print", () => {
    const h = html(BrandMark, { tone: "ink" });
    expect(h).toContain("fill-ink");
    for (const c of ["fill-brand", "fill-red", "fill-yellow"]) expect(h).not.toContain(c);
  });

  it("draws the print mark as the spec's brand-mark-ink: white tile, 1.6px ink outline, no lip, ink steps", () => {
    const h = html(BrandMark, { tone: "ink" });
    expect(h).toContain("fill-surface");
    expect(h).toContain("stroke-ink");
    expect(h).toContain('stroke-width="1.6"');
    expect(h).not.toContain("fill-line");
    expect(h).not.toContain("stroke-line");
    expect(h).not.toContain("fill-lip");
    expect(h).not.toContain("stroke-lip");
    for (const c of ["brand", "red", "yellow", "mascot"]) expect(h).not.toContain(c);
    // Tile outline + three steps; no separate lip rect under the tile or the steps.
    expect(h.match(/<rect /g)).toHaveLength(4);
    expect(h.match(/fill-ink/g)).toHaveLength(3);
  });
});

describe("PetalGlyph", () => {
  it("is the Campus German three-petal sign in red, yellow and cyan, decorative", () => {
    const h = html(PetalGlyph);
    for (const c of ["fill-red", "fill-yellow", "fill-brand"]) expect(h).toContain(c);
    expect(h).toContain('aria-hidden="true"');
  });
});

describe("BrandLockup", () => {
  it("puts the petal glyph before the byline and keeps the name", () => {
    const h = html(BrandLockup, { byline: "bir Campus German ürünü" });
    expect(h).toContain("Kademe");
    expect(h.indexOf("fill-yellow", h.indexOf("Kademe"))).toBeGreaterThan(-1);
    expect(h).toContain("bir Campus German ürünü");
  });
});
