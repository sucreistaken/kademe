import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusDot, type StatusTone } from "./status-dot";

const render = (tone: StatusTone, pill = false) => renderToStaticMarkup(createElement(StatusDot, { tone, pill } as ComponentProps<typeof StatusDot>, "Label"));

describe("StatusDot tones", () => {
  it("draws the active dot in the cyan brand fill", () => {
    expect(render("active")).toContain("bg-brand");
  });

  it("draws the active pill on the soft cyan ground with the accent text", () => {
    expect(render("active", true)).toContain("bg-accent-soft text-accent");
  });

  it("keeps a live status distinguishable from a waiting one", () => {
    const dotOf = (tone: StatusTone) => render(tone).match(/<span class="size-2[^"]*"/)?.[0];
    expect(dotOf("active")).toBeDefined();
    expect(dotOf("active")).not.toBe(dotOf("neutral"));
    expect(render("active", true)).not.toContain("bg-sky");
  });
});
