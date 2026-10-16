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

  it("tells done from active in both the dot and the pill form", () => {
    const dotOf = (tone: StatusTone) => render(tone).match(/<span class="size-2[^"]*"/)?.[0];
    expect(dotOf("done")).toBeDefined();
    expect(dotOf("done")).not.toBe(dotOf("active"));
    expect(render("done", true)).not.toBe(render("active", true));
    expect(render("done", true)).not.toContain("bg-accent-soft");
    // The mint family resolves to the same cyan as active, so done must not use it.
    expect(render("done")).not.toContain("mint");
    expect(render("done", true)).not.toContain("mint");
  });

  it("draws the done pill on cream with ink text and a deep-cyan dot", () => {
    expect(render("done", true)).toContain("bg-cream text-ink");
    expect(render("done")).toContain("bg-accent");
  });
});
