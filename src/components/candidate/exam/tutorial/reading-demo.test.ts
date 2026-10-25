import { createElement, type FC, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { candidateMessages } from "@/i18n/candidate";
import { DemoStage } from "./DemoStage";
import { READING_SCRIPT } from "./scripts/reading";
import { buildTimeline, stateAtTimeline } from "./timeline";

const Provider = NextIntlClientProvider as unknown as FC<{ locale: string; messages: Record<string, unknown>; timeZone: string; children?: ReactNode }>;

const timeline = buildTimeline(READING_SCRIPT);
const stepOf = (id: string) => timeline.steps.find((s) => s.id === id)!;

/** The stage as the player draws it at a moment. */
function stageAt(time: number): string {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale: "en", messages: candidateMessages.en as unknown as Record<string, unknown>, timeZone: "Europe/Istanbul" },
      createElement(DemoStage, { script: READING_SCRIPT, state: stateAtTimeline(READING_SCRIPT, timeline, time), jump: 0, reducedMotion: true }),
    ),
  );
}

const badges = (html: string) => [...html.matchAll(/data-badge="([^"]*)"/g)].map((m) => m[1]);
const slot = (html: string, id: string) => html.match(new RegExp(`<button[^>]*data-match-trigger="${id}"[\\s\\S]*?</button>`))?.[0] ?? "";

describe("the reading tutorial shows the click-a-gap flow", () => {
  it("starts with two empty gaps in the text and the lettered sentences beside it", () => {
    const html = stageAt(0);
    expect(slot(html, "g1")).toContain('aria-label="Gap 1, empty"');
    expect(slot(html, "g2")).toContain('aria-label="Gap 2, empty"');
    expect(html).not.toContain('role="listbox"');
    expect(html.match(/data-insert-sentence="/g)).toHaveLength(3);
    expect(html).not.toContain("________");
  });

  it("opens the first gap's list under the click, every sentence free", () => {
    const click = stepOf("gap").actions[0];
    const html = stageAt(click.effect);
    expect(html.match(/role="listbox"/g)).toHaveLength(1);
    expect(slot(html, "g1")).toContain('aria-expanded="true"');
    expect(badges(html)).toEqual(["A", "B", "C"]);
    expect(html).toContain('data-demo-option="g1:rb"');
    expect(html).not.toContain("in gap");
  });

  it("fills the gap with the picked sentence and shuts the list", () => {
    const html = stageAt(stepOf("pick").actions[0].effect);
    expect(html).not.toContain('role="listbox"');
    expect(slot(html, "g1")).toContain('aria-label="Gap 1, chosen: B"');
    expect(slot(html, "g1")).toContain("Er liegt mitten in der Stadt.");
    expect(slot(html, "g2")).toContain("Gap 2, empty");
  });

  it("opens the second gap with the used sentence last, dimmed and saying where it is", () => {
    const html = stageAt(stepOf("used").actions[0].effect);
    expect(badges(html)).toEqual(["A", "C", "B"]);
    expect(html).toMatch(/data-demo-option="g2:rb"[^>]*text-ink-3[\s\S]*?in gap 1/);
  });

  it("ends with both gaps filled and the list showing where each sentence went", () => {
    const html = stageAt(timeline.steps[timeline.steps.length - 1].start);
    expect(slot(html, "g1")).toContain("Gap 1, chosen: B");
    expect(slot(html, "g2")).toContain("Gap 2, chosen: A");
    expect(html).toContain("→ 1");
    expect(html).toContain("→ 2");
    expect(html).not.toContain('role="listbox"');
  });
});
