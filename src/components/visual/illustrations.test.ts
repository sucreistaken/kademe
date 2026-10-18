import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Illustration, ILLUSTRATION_NAMES } from "./illustrations";

const ALLOWED = /^(none|var\(--color-illus-(line|fill|tint|sage|warm)\)|var\(--color-(mint|sky|sun|grape)-soft\))$/;

describe("illustrations (HIRING-VISUAL-FLOW 2.2, K1)", () => {
  it("has the eleven candidate, four panel and four block-screen drawings", () => {
    expect(ILLUSTRATION_NAMES).toHaveLength(19);
    expect(new Set(ILLUSTRATION_NAMES).size).toBe(19);
    for (const name of ["secondScreen", "shareEntireScreen", "fullscreen", "cameraFrame"]) expect(ILLUSTRATION_NAMES).toContain(name);
  });

  it.each(ILLUSTRATION_NAMES)("%s is hidden from assistive tech, inline only, and drawn with the illustration tones", (name) => {
    const html = renderToStaticMarkup(createElement(Illustration, { name }));
    expect(html).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(html).toContain('focusable="false"');
    // No file, no link, no text to translate, nothing pulled from elsewhere.
    expect(html).not.toMatch(/<image|<img|href=|<text|<foreignObject|url\(/i);
    // No styling or behaviour of its own, no reused or gradient paint: tones come only from the attributes below.
    expect(html).not.toMatch(/<style|<script|<use\b|<linearGradient|<radialGradient|\sstyle=|\son[a-z]+=/i);
    // It scales by its box, so every drawing states the box it was drawn in.
    expect(html).toMatch(/^<svg[^>]*\sviewBox="0 0 \d+ \d+"/);
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).not.toContain("--color-accent");
    const colours = [...html.matchAll(/\s(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThan(3);
    for (const colour of colours) expect(colour, `${name}: ${colour}`).toMatch(ALLOWED);
  });

  it("the block-screen pictures are 200 wide and 140 tall, so a block screen fits 650px", () => {
    const html = renderToStaticMarkup(createElement(Illustration, { name: "secondScreen", size: "block" }));
    expect(html).toContain("w-[200px]");
    for (const name of ["secondScreen", "shareEntireScreen", "fullscreen", "cameraFrame"] as const) {
      expect(renderToStaticMarkup(createElement(Illustration, { name }))).toContain('viewBox="0 0 200 140"');
    }
  });

  it("sizes by role: hero 400 wide at most, a spot 160, the phone screen 342", () => {
    expect(renderToStaticMarkup(createElement(Illustration, { name: "welcome", size: "hero" }))).toContain("max-w-[400px]");
    expect(renderToStaticMarkup(createElement(Illustration, { name: "closed", size: "spot" }))).toContain("w-[160px]");
    expect(renderToStaticMarkup(createElement(Illustration, { name: "desktopOnly", size: "phone" }))).toContain("max-w-[342px]");
  });

  it("cameraFrame: the stand's neck reaches its base and the silhouette sits in the middle of the oval", () => {
    const html = renderToStaticMarkup(createElement(Illustration, { name: "cameraFrame" }));
    const neck = html.match(/d="M100 116 V(\d+) M\d+ (\d+) H\d+"/);
    expect(neck, "stand path").not.toBeNull();
    expect(neck![1]).toBe(neck![2]);
    const oval = html.match(/<ellipse cx="100" cy="(\d+)" rx="\d+" ry="(\d+)"/)!;
    const head = html.match(/<circle cx="100" cy="(\d+)" r="(\d+)"/g)!.map((s) => s.match(/cy="(\d+)" r="(\d+)"/)!.map(Number)).find(([, , r]) => r > 5)!;
    const shoulders = html.match(/d="M\d+ (\d+) C\d+ \d+ \d+ \d+ 100 (\d+) C[^"]* Z"/)!;
    const top = head[1] - head[2];
    const bottom = Number(shoulders[1]);
    const middle = (top + bottom) / 2;
    expect(Math.abs(middle - Number(oval[1]))).toBeLessThanOrEqual(2);
    // The whole figure is inside the oval's height.
    expect(top).toBeGreaterThanOrEqual(Number(oval[1]) - Number(oval[2]));
    expect(bottom).toBeLessThanOrEqual(Number(oval[1]) + Number(oval[2]));
  });
});
