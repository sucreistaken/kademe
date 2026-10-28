import { readFileSync } from "node:fs";
import path from "node:path";
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

  it.each(MASCOT_POSES)("%s is the yellow tallest step on a cyan and a red step, each with its lip", (pose) => {
    const html = render({ pose });
    for (const c of ["fill-yellow", "fill-mascot-yellow-lip", "fill-brand", "fill-brand-lip", "fill-red", "fill-red-lip"]) expect(html).toContain(c);
    expect(html).not.toContain("fill-accent");
  });

  it("has five distinct poses", () => {
    expect(MASCOT_POSES).toHaveLength(5);
    expect(new Set(MASCOT_POSES.map((pose) => render({ pose }))).size).toBe(5);
  });

  it("only celebrate moves on its own, and only when motion is allowed", () => {
    expect(render({ pose: "celebrate" })).toContain("motion-safe:animate-[pop-in");
    for (const pose of ["wave", "think", "rest", "talk"] as const) expect(render({ pose })).not.toContain("animate");
  });

  it("sizes by role like Illustration: hero, spot 160, small 96", () => {
    expect(render({ pose: "wave", size: "hero" })).toContain("max-w-[260px]");
    expect(render({ pose: "wave", size: "spot" })).toContain("w-[160px]");
    expect(render({ pose: "wave", size: "small" })).toContain("w-24");
  });
});

describe("the talk pose (the speaking task of a course test, spec 2026-10-28)", () => {
  const SMILE = "M121 110 Q129 118 137 110";

  it("at rest has the closed smile, a hand lifted, and nothing that moves", () => {
    const html = render({ pose: "talk" });
    expect(html).toContain(SMILE);
    expect(html).not.toContain("data-mouth");
    expect(html).not.toContain("data-talking");
    expect(html).not.toContain("animate");
    // The lifted hand: a pose of its own, not the wave.
    expect(html).toContain('cx="176" cy="93"');
  });

  it("talking opens the mouth and the one motion is motion-safe, so reduced motion keeps it still", () => {
    const html = render({ pose: "talk", talking: true });
    expect(html).toContain('data-talking="true"');
    expect(html).toContain('data-mouth="open"');
    expect(html).not.toContain(SMILE);
    expect(html).toContain("motion-safe:animate-[mascot-talk_");
    // Every animation class on it carries the motion-safe prefix.
    expect(html.match(/(?<!motion-safe:)animate-/g)).toBeNull();
    // The mouth turns about its own centre, not about the corner of the drawing.
    expect(html).toContain("origin-center");
    expect(html).toContain("[transform-box:fill-box]");
  });

  it("is a different drawing talking and not talking, and the same again when talking ends", () => {
    expect(render({ pose: "talk", talking: true })).not.toBe(render({ pose: "talk" }));
    expect(render({ pose: "talk", talking: false })).toBe(render({ pose: "talk" }));
  });

  it("ignores `talking` on every other pose", () => {
    for (const pose of ["wave", "celebrate", "think", "rest"] as const) {
      expect(render({ pose, talking: true }), pose).toBe(render({ pose }));
    }
  });

  it("has its keyframes in the stylesheet once, scaling the mouth, and nothing starts them outside motion-safe", () => {
    const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css.match(/@keyframes mascot-talk\s*\{/g)).toHaveLength(1);
    const at = css.indexOf("@keyframes mascot-talk");
    expect(css.slice(at, at + 400)).toContain("scaleY(");
    // The stylesheet itself runs nothing: the keyframes are only referenced from the component, behind motion-safe.
    expect(css).not.toMatch(/animation:[^;]*mascot-talk/);
    const source = readFileSync(path.resolve(process.cwd(), "src/components/visual/mascot.tsx"), "utf8");
    expect(source.match(/mascot-talk_/g)).toHaveLength(1);
    expect(source).toContain("motion-safe:animate-[mascot-talk_");
  });
});
