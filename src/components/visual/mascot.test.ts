import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Mascot, MASCOT_POSES } from "./mascot";

const render = (props: Parameters<typeof Mascot>[0]) => renderToStaticMarkup(createElement(Mascot, props));

describe("Mascot (RULES rule 9)", () => {
  it.each(MASCOT_POSES)("%s is hidden from assistive tech, inline, and uses tokens only", (pose) => {
    const html = render({ pose });
    expect(html).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(html).toContain('focusable="false"');
    expect(html).not.toMatch(/<image|<img|href=|<text|<foreignObject|<style|<script|\sstyle=|url\(/i);
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("has four distinct poses", () => {
    expect(new Set(MASCOT_POSES.map((pose) => render({ pose }))).size).toBe(4);
  });

  it("only celebrate moves, and only when motion is allowed", () => {
    expect(render({ pose: "celebrate" })).toContain("motion-safe:animate-[pop-in");
    for (const pose of ["wave", "think", "rest"] as const) expect(render({ pose })).not.toContain("animate");
  });

  it("sizes by role like Illustration: hero, spot 160, small 96", () => {
    expect(render({ pose: "wave", size: "hero" })).toContain("max-w-[260px]");
    expect(render({ pose: "wave", size: "spot" })).toContain("w-[160px]");
    expect(render({ pose: "wave", size: "small" })).toContain("w-24");
  });
});
