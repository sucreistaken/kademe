import { existsSync } from "node:fs";
import path from "node:path";
import { createElement, type FC, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

// Desktop Chrome has the Highlight API, so the reading pane draws its note tools (the "notes" target).
vi.mock("@/components/candidate/exam/notes/use-notes", () => {
  const noop = () => {};
  return {
    UNDO_MS: 8000,
    hasCustomHighlights: () => true,
    useNotes: () => ({
      supported: true,
      data: { marks: [], strokes: [] },
      setData: noop,
      tool: "none",
      setTool: noop,
      color: "yellow",
      setColor: noop,
      canUndo: false,
      clear: noop,
      undo: noop,
    }),
  };
});

import { candidateMessages } from "@/i18n/candidate";
import { CANDIDATE_LOCALES } from "@/i18n/locale";
import { SECTIONS } from "@/lib/exam/types";
import { VOICES } from "@/lib/tts";
import { DemoStage, DEMO_IMAGES } from "./DemoStage";
import { NARRATION, narrationFor, stepDurations } from "./narration";
import { narrationHash } from "./narration-hash";
import { targetQuery, ITEM_ATTR } from "./resolve-target";
import type { DemoAction, Target } from "./script-types";
import { TUTORIAL_SCRIPTS } from "./scripts";
import { buildTimeline, stateAtTimeline } from "./timeline";

const Provider = NextIntlClientProvider as unknown as FC<{ locale: string; messages: Record<string, unknown>; timeZone: string; children?: ReactNode }>;

const captionsOf = (locale: (typeof CANDIDATE_LOCALES)[number], section: (typeof SECTIONS)[number]) =>
  (candidateMessages[locale].tutorial as unknown as Record<string, Record<string, string>>)[section] ?? {};

const words = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;

const targetsOf = (a: DemoAction): Target[] => {
  switch (a.do) {
    case "spotlight":
      return a.on ? [a.on] : [];
    case "move":
      return [a.to];
    case "click":
      return [a.on];
    case "drag":
      return [a.from, a.to];
    case "type":
      return [a.into];
    case "wait":
      return [];
  }
};

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Whether the stage's markup shows the target, the way resolveTarget finds it in the browser. */
function shows(html: string, target: Target): boolean {
  const q = targetQuery(target);
  let scope = html;
  if (q.scope !== null) {
    const start = html.indexOf(`${ITEM_ATTR}="${q.scope}"`);
    if (start < 0) return false;
    const next = html.indexOf(`${ITEM_ATTR}="`, start + 1);
    scope = html.slice(start, next < 0 ? undefined : next);
  }
  return q.anyOf.some((m) => {
    if ("tag" in m) return new RegExp(`<${m.tag}[\\s>]`).test(scope);
    if (m.value === null) return new RegExp(`\\s${m.attr}(=|\\s|>)`).test(scope);
    return scope.includes(`${m.attr}="${escapeAttr(m.value)}"`);
  });
}

describe.each(SECTIONS)("the %s tutorial", (section) => {
  const script = TUTORIAL_SCRIPTS[section];

  it("is a script for its own section with 6 to 8 steps and unique step ids", () => {
    expect(script.section).toBe(section);
    expect(script.steps.length).toBeGreaterThanOrEqual(6);
    expect(script.steps.length).toBeLessThanOrEqual(8);
    expect(new Set(script.steps.map((s) => s.id)).size).toBe(script.steps.length);
    for (const it of script.stage.items) expect(it.section).toBe(section);
  });

  it("has a caption for every step in every candidate language", () => {
    for (const locale of CANDIDATE_LOCALES) {
      const captions = captionsOf(locale, section);
      for (const step of script.steps) expect(captions[step.id]?.trim(), `${locale} ${section}.${step.id}`).toBeTruthy();
      expect(Object.keys(captions).sort(), `${locale} has no caption for a step that is gone`).toEqual(script.steps.map((s) => s.id).sort());
    }
  });

  it("says it in simple language: 75 to 110 words in English", () => {
    const total = script.steps.reduce((n, s) => n + words(captionsOf("en", section)[s.id] ?? ""), 0);
    expect(total).toBeGreaterThanOrEqual(75);
    expect(total).toBeLessThanOrEqual(110);
  });

  it.each(CANDIDATE_LOCALES)("lasts 30 to 45 seconds in %s, with its recordings and as captions only", (locale) => {
    const captions = captionsOf(locale, section);
    for (const narration of [narrationFor(locale, section), {}]) {
      const total = buildTimeline(script, stepDurations(script, captions, narration, locale)).total;
      expect(total).toBeGreaterThanOrEqual(30_000);
      expect(total).toBeLessThanOrEqual(45_000);
    }
  });

  it("has every recorded narration on disk and saying the current caption", () => {
    for (const locale of CANDIDATE_LOCALES) {
      const captions = captionsOf(locale, section);
      for (const [id, entry] of Object.entries(narrationFor(locale, section))) {
        expect(script.steps.some((s) => s.id === id), `${locale} ${section}.${id} is a step`).toBe(true);
        expect(entry.src).toBe(`/tutorial/${locale}/${section}/${id}.mp3`);
        expect(existsSync(path.resolve(process.cwd(), "public", `.${entry.src}`)), entry.src).toBe(true);
        expect(entry.hash, `${entry.src} says an older caption: run pnpm tutorial:tts`).toBe(narrationHash(captions[id] ?? "", VOICES.A));
        expect(entry.ms).toBeGreaterThan(500);
      }
    }
  });

  it("finds every target of its script on the stage at the moment it is used", () => {
    const timeline = buildTimeline(script);
    const missing: string[] = [];
    for (const step of timeline.steps) {
      for (const { action, start } of step.actions) {
        const targets = targetsOf(action);
        if (targets.length === 0) continue;
        const state = stateAtTimeline(script, timeline, start);
        const html = renderToStaticMarkup(
          createElement(
            Provider,
            { locale: "en", messages: candidateMessages.en as unknown as Record<string, unknown>, timeZone: "Europe/Istanbul" },
            createElement(DemoStage, { script, state, jump: 0, reducedMotion: true }),
          ),
        );
        for (const target of targets) if (!shows(html, target)) missing.push(`${step.id}: ${JSON.stringify(target)}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("draws pictures from static files that exist, never from an exam route", () => {
    if (!("demo" in DEMO_IMAGES)) throw new Error("the stage must use the demo picture resolver");
    const demo = DEMO_IMAGES.demo;
    for (const item of script.stage.items) {
      const c = item.content;
      const images = [...(c.kind === "CHOICE" ? c.options.flatMap((o) => (o.image ? [o.image] : [])) : []), ...((c.kind === "WRITING" || c.kind === "SPEAKING") && c.images ? c.images : [])];
      for (const im of images) {
        const src = demo(item.sequence, im.slot);
        expect(src).toMatch(/^\/tutorial\/img\//);
        expect(existsSync(path.resolve(process.cwd(), "public", `.${src}`)), src).toBe(true);
      }
    }
  });
});

describe("narration.json", () => {
  it("only names candidate languages and sections", () => {
    for (const [locale, sections] of Object.entries(NARRATION)) {
      expect(CANDIDATE_LOCALES as readonly string[]).toContain(locale);
      for (const s of Object.keys(sections)) expect(SECTIONS as readonly string[]).toContain(s);
    }
  });
});

describe("the stage", () => {
  it("is inert, hidden from screen readers and shows no right or wrong", () => {
    const script = TUTORIAL_SCRIPTS.READING;
    const timeline = buildTimeline(script);
    const html = renderToStaticMarkup(
      createElement(
        Provider,
        { locale: "en", messages: candidateMessages.en as unknown as Record<string, unknown>, timeZone: "Europe/Istanbul" },
        createElement(DemoStage, { script, state: stateAtTimeline(script, timeline, timeline.total), jump: 0, reducedMotion: true }),
      ),
    );
    expect(html).toMatch(/<div inert="" aria-hidden="true"/);
    expect(html).not.toMatch(/\/api\/c\//);
    expect(html).not.toMatch(/\b(correct|incorrect|richtig gelöst|falsch gelöst)\b/i);
  });
});
