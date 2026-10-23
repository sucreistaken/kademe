import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/candidate-client", () => ({ useT: () => (key: string) => key }));
vi.mock("@/components/candidate/proctor/ProctorProvider", () => ({ useProctor: () => ({ snap: null }) }));
vi.mock("@/components/candidate/LanguagePicker", () => ({ LanguagePicker: () => null }));

import { readFileSync } from "node:fs";
import path from "node:path";
import { ExamTopBar } from "./ExamTopBar";

describe("ExamTopBar left group", () => {
  it("truncates a long section name, keeps its full text in title and the counter unshrinkable", () => {
    const name = "Schreiben: Ein formeller Brief an die Hausverwaltung";
    const html = renderToStaticMarkup(
      createElement(ExamTopBar, {
        inQuestion: true,
        sectionName: name,
        counter: "Frage 3 von 20",
        wide: false,
        showLanguagePicker: false,
        lang: "de",
        locales: [],
        proctored: false,
        recLabel: null,
        screenShare: false,
        remainingMs: 600_000,
        sectionMs: 1_200_000,
        token: "t",
        sectionPosition: 1,
      } as never),
    );
    expect(html).toMatch(new RegExp(`<span title="${name}" class="[^"]*\\bmin-w-0\\b[^"]*\\btruncate\\b`));
    expect(html).toContain("max-w-[calc(50%-6rem)]");
    expect(html).toMatch(/<span class="tnum shrink-0 whitespace-nowrap[^"]*">Frage 3 von 20/);
  });
});

const base = {
  sectionName: "Lesen",
  counter: "Frage 3 von 20",
  wide: false,
  showLanguagePicker: false,
  lang: "de",
  locales: [],
  proctored: false,
  recLabel: null,
  screenShare: false,
  remainingMs: 600_000,
  sectionMs: 1_200_000,
  token: "t",
  sectionPosition: 1,
};
const bar = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(ExamTopBar, { ...base, ...props } as never));

describe("ExamTopBar how-it-works button", () => {
  it("shows on a question screen, icon-only below lg, and not on the introduction", () => {
    const html = bar({ inQuestion: true, onWatchTutorial: () => {} });
    expect(html).toMatch(/<button type="button" title="howItWorks"/);
    expect(html).not.toContain("aria-label");
    expect(html).toMatch(/<span class="sr-only xl:not-sr-only[^"]*">howItWorks<\/span>/);
    expect(bar({ inQuestion: false, onWatchTutorial: () => {} })).not.toContain("howItWorks");
  });

  it("is absent in the tutorial's own demo bar (no handler)", () => {
    expect(bar({ inQuestion: true })).not.toContain("howItWorks");
  });
});

describe("the exam runner's how-it-works video", () => {
  const here = (f: string) => readFileSync(path.resolve(__dirname, f), "utf8");

  it("opens the current section's player with the clock note, only on the question screen", () => {
    const runner = here("ExamRunner.tsx");
    expect(runner).toContain("onWatchTutorial={() => setReplayFor(cur.position)}");
    expect(runner).toContain('<TutorialReplay section={cur.section} open={replayFor === cur.position && state.step === "ITEM" && !timeUp}');
    const replay = here("tutorial/TutorialReplay.tsx");
    expect(replay).toContain("script={TUTORIAL_SCRIPTS[section]}");
    expect(replay).toContain('note={tt("clockRunning")}');
  });

  it("uses the shared suppression hook and closes the dialog when the section time runs out", () => {
    expect(here("tutorial/TutorialReplay.tsx")).toContain("useTutorialSuppression(open);");
    expect(here("ExamRunner.tsx")).toContain('open={replayFor === cur.position && state.step === "ITEM" && !timeUp}');
  });
});

describe("ExamTopBar right group", () => {
  it("is width-capped like the left one, with an unshrinkable button and a truncating recording label", () => {
    const html = bar({ inQuestion: true, proctored: true, recLabel: null, onWatchTutorial: () => {} });
    expect(html.match(/max-w-\[calc\(50%-6rem\)\]/g)).toHaveLength(2);
    expect(html).toMatch(/<div class="flex min-w-0 max-w-\[calc\(50%-6rem\)\] items-center gap-5">/);
    expect(html).toMatch(/<button[^>]*class="[^"]*\bshrink-0\b/);
    expect(html).toMatch(/<span title="cameraOn"[^>]*>.*<span class="min-w-0 truncate">cameraOn<\/span>/);
  });
});
