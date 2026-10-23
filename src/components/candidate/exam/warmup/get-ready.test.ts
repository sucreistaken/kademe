import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type FC, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/candidate.en.json";
import { TutorialButton } from "@/components/candidate/exam/tutorial/TutorialButton";
import { TUTORIAL_SCRIPTS } from "@/components/candidate/exam/tutorial/scripts";
import { WarmupOffer } from "./Warmup";
import type { WarmupState } from "./warmup-state";

const Provider = NextIntlClientProvider as unknown as FC<{ locale: string; messages: Record<string, unknown>; timeZone: string; children?: ReactNode }>;
const noop = () => {};

function row(state: WarmupState, withVideo = true) {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale: "en", messages: en as unknown as Record<string, unknown>, timeZone: "Europe/Istanbul" },
      createElement(WarmupOffer, {
        state,
        onTry: noop,
        onSkip: noop,
        video: withVideo ? createElement(TutorialButton, { script: TUTORIAL_SCRIPTS.READING, onOpen: noop }) : undefined,
        videoLead: withVideo ? en.tutorial.watchLead : undefined,
      }),
    ),
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the get-ready row on a section introduction", () => {
  it("puts the how-it-works button, with the tutorial's own length, before Try and Skip", () => {
    const t = text(row({ phase: "offer" }));
    expect(t).toMatch(/Watch how it works \(0:[34]\d\) Try Skip/);
  });

  it("keeps the button when the offer is gone: with the ready line after practice, with its own line after a skip", () => {
    expect(text(row({ phase: "done" }))).toMatch(/When you are ready, start the section\. Watch how it works/);
    expect(text(row({ phase: "skipped" }))).toContain(`${en.tutorial.watchLead} Watch how it works`);
  });

  it("never adds a filled button: Start section stays the only primary action", () => {
    for (const state of [{ phase: "offer" }, { phase: "done" }, { phase: "skipped" }] as WarmupState[]) {
      expect(row(state)).not.toContain("bg-brand ");
    }
  });

  it("draws exactly as before without a video", () => {
    expect(row({ phase: "skipped" }, false)).toBe("");
    expect(text(row({ phase: "offer" }, false))).not.toContain("Watch");
  });
});

describe("the section introduction", () => {
  const src = readFileSync(path.resolve(__dirname, "../SectionIntro.tsx"), "utf8");

  it("opens the section's tutorial and pauses voice detection and the big warnings while it is open", () => {
    expect(src).toContain("<TutorialPlayer script={TUTORIAL_SCRIPTS[cur.section]} open={watching} onOpenChange={setWatching} />");
    expect(src).toContain('useTutorialSuppression(watching);');
  });
});
