import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// What the proctor engine currently shows; each test sets it and afterEach clears it.
const proctor = vi.hoisted(() => ({ snap: null as unknown }));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/candidate-client", () => ({ useT: () => (key: string) => key }));
vi.mock("@/components/candidate/proctor/ProctorProvider", () => ({ useProctor: () => ({ snap: proctor.snap }) }));
vi.mock("@/components/candidate/LanguagePicker", () => ({ LanguagePicker: () => null }));

import { readFileSync } from "node:fs";
import path from "node:path";
import { CANDIDATE_LOCALES } from "@/i18n/locale";
import { messagesFor } from "@/i18n/candidate";
import { ExamTopBar, recordingChipKind } from "./ExamTopBar";

afterEach(() => {
  proctor.snap = null;
});

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
  it("is width-capped like the left one, with an unshrinkable button and no recording copy of its own", () => {
    const html = bar({ inQuestion: true, proctored: true, recLabel: null, onWatchTutorial: () => {} });
    expect(html.match(/max-w-\[calc\(50%-6rem\)\]/g)).toHaveLength(2);
    expect(html).toMatch(/<div class="flex min-w-0 max-w-\[calc\(50%-6rem\)\] items-center gap-5">/);
    expect(html).toMatch(/<button[^>]*class="[^"]*\bshrink-0\b/);
    // The small grey line at the far right is gone: the chip beside the clock replaced it.
    const right = html.split('items-center gap-5">')[1].split('<div class="absolute inset-y-0')[0];
    expect(right).not.toContain("data-recording-chip");
    expect(right).not.toContain("cameraOn");
  });
});

describe("recordingChipKind", () => {
  it("names the screen whenever the screen is recorded, otherwise the camera", () => {
    expect(recordingChipKind("cameraAudioScreen", false)).toBe("screen");
    expect(recordingChipKind("cameraScreen", false)).toBe("screen");
    expect(recordingChipKind("screen", false)).toBe("screen");
    expect(recordingChipKind("cameraAudio", true)).toBe("camera");
    expect(recordingChipKind("camera", true)).toBe("camera");
  });
  it("falls back to the policy when the engine reports nothing yet", () => {
    expect(recordingChipKind(null, true)).toBe("screen");
    expect(recordingChipKind(null, false)).toBe("camera");
  });
});

describe("ExamTopBar recording chip", () => {
  it("sits on the clock's trailing side, in the centre group, with the full text in its tooltip", () => {
    const html = bar({ inQuestion: true, proctored: true, recLabel: "cameraAudioScreen" });
    const centre = html.match(/<div class="absolute inset-y-0 start-1\/2 flex -translate-x-1\/2[^"]*">(.*)$/);
    expect(centre?.[1]).toMatch(/data-cue="normal"/);
    expect(centre?.[1]).toMatch(/<div class="absolute start-full top-1\/2 ms-3 w-max -translate-y-1\/2"><span title="cameraAudioScreen" data-recording-chip/);
    expect(html.match(/data-recording-chip/g)).toHaveLength(1);
    // Short words for the bar, the whole list for the tooltip and for a screen reader.
    expect(html).toMatch(/<span aria-hidden="true" class="min-w-0 truncate">recordingChipScreen<\/span><span class="sr-only">cameraAudioScreen<\/span>/);
  });

  it("talks about the camera when no screen is recorded", () => {
    const html = bar({ inQuestion: true, proctored: true, recLabel: "cameraAudio" });
    expect(html).toContain(">recordingChipCamera<");
    expect(html).not.toContain("recordingChipScreen");
    expect(bar({ inQuestion: true, proctored: true, recLabel: null, screenShare: true })).toContain(">recordingChipScreen<");
  });

  it("has a red dot that breathes only when motion is allowed, on an ink-on-white chip", () => {
    const html = bar({ inQuestion: true, proctored: true, recLabel: "screen" });
    expect(html).toMatch(/<span aria-hidden="true" class="size-2\.5 shrink-0 rounded-full bg-red motion-safe:animate-\[rec-pulse_1\.6s_ease-in-out_infinite\]">/);
    expect(html).not.toMatch(/(?<!motion-safe:)animate-/);
    const chip = html.match(/<span title="screen" data-recording-chip="true" class="([^"]*)"/)?.[1] ?? "";
    expect(chip).toContain("text-ink");
    expect(chip).toContain("bg-surface");
    expect(chip).not.toMatch(/danger|red/);
  });

  it("is capped and cut with an ellipsis rather than running into the neighbours, and hidden below md as before", () => {
    const html = bar({ inQuestion: true, proctored: true, recLabel: "screen" });
    const chip = html.match(/data-recording-chip="true" class="([^"]*)"/)?.[1] ?? "";
    expect(chip).toMatch(/\bhidden\b.*\bmd:inline-flex\b/);
    expect(chip).toContain("max-w-[230px]");
    expect(chip).toContain("whitespace-nowrap");
    expect(html).toMatch(/class="min-w-0 truncate">recordingChipScreen/);
  });

  it("shows only when the exam is proctored", () => {
    expect(bar({ inQuestion: true, proctored: false, recLabel: "screen" })).not.toContain("data-recording-chip");
    expect(bar({ inQuestion: false, proctored: false })).not.toContain("data-recording-chip");
  });

  it("stands alone in the middle on a section introduction, where there is no clock", () => {
    const html = bar({ inQuestion: false, proctored: true, recLabel: "screen" });
    expect(html).not.toContain("data-cue");
    expect(html).toMatch(/<div class="absolute inset-y-0 start-1\/2 flex -translate-x-1\/2 items-center rtl:translate-x-1\/2"><span title="screen" data-recording-chip/);
  });

  it("uses words short enough for the middle of a 1366px bar in all five languages", () => {
    // Room between the clock and the how-it-works button is about 200px; 24 characters at 13px stay well inside it.
    for (const locale of CANDIDATE_LOCALES) {
      const exam = messagesFor(locale).exam;
      for (const text of [exam.recordingChipScreen, exam.recordingChipCamera]) {
        expect(text.length, `${locale}: ${text}`).toBeLessThanOrEqual(24);
        expect(text).not.toContain("\u2014");
      }
    }
  });

  it("follows the text direction: logical offsets only, so Arabic mirrors the centre group", () => {
    expect(readFileSync(path.resolve(__dirname, "TimerPill.tsx"), "utf8")).toContain("absolute start-full top-1/2 ms-3");
    expect(readFileSync(path.resolve(__dirname, "ExamTopBar.tsx"), "utf8")).toContain("start-1/2 flex -translate-x-1/2 items-center rtl:translate-x-1/2");
  });
});

describe("ExamTopBar proctor notice (voice, no face)", () => {
  const show = (banner: unknown, props: Record<string, unknown> = {}) => {
    proctor.snap = { banner };
    return bar({ inQuestion: true, proctored: true, recLabel: "screen", ...props });
  };

  it("keeps an empty live region in the page while nothing is wrong, so the first notice is announced", () => {
    const html = bar({ inQuestion: true, proctored: true, recLabel: "screen" });
    expect(html).toMatch(/<div role="status" aria-live="polite" aria-atomic="true" class="pointer-events-none absolute inset-x-0 top-full flex justify-center px-7"><\/div>/);
    expect(html).not.toContain("data-proctor-notice");
  });

  it("shows a voice as a large card with a mic, a 19px semibold line and a second line", () => {
    const html = show({ kind: "act", reason: "VOICE" });
    const card = html.match(/<div data-proctor-notice="VOICE" class="([^"]*)">(.*?)<\/div><\/div><\/div>/);
    expect(card?.[1]).toContain("bg-yellow-soft");
    expect(card?.[1]).toContain("border-2 border-yellow-lip");
    expect(card?.[1]).toContain("shadow-overlay");
    expect(card?.[1]).toContain("py-4");
    expect(card?.[2]).toContain("lucide-mic");
    expect(card?.[2]).toMatch(/<p class="text-\[19px\] font-semibold leading-\[26px\] text-ink">VOICE<\/p>/);
    expect(card?.[2]).toMatch(/<p class="mt-0\.5 text-\[15px\] leading-\[22px\] text-ink-2">VOICEHint<\/p>/);
  });

  it("shows a missing face the same way, with a face glyph", () => {
    const html = show({ kind: "act", reason: "NO_FACE" });
    expect(html).toContain('data-proctor-notice="NO_FACE"');
    expect(html).toContain("lucide-user-round");
    expect(html).toContain(">NO_FACEHint<");
  });

  it("sits inside the live region, ahead of the bar's row, and never takes a click", () => {
    const html = show({ kind: "act", reason: "VOICE" });
    const region = html.indexOf('aria-live="polite"');
    expect(region).toBeGreaterThan(-1);
    expect(region).toBeLessThan(html.indexOf('data-proctor-notice="VOICE"'));
    expect(html.indexOf('data-proctor-notice="VOICE"')).toBeLessThan(html.indexOf('<div class="relative mx-auto flex h-14'));
    expect(html).toContain("pointer-events-none absolute inset-x-0 top-full");
    // One region carries the notice (the clock keeps its own for the time callout), and its text is on the page once.
    expect(html.match(/aria-atomic="true"/g)).toHaveLength(1);
    expect(html.match(/>VOICE</g)).toHaveLength(1);
  });

  it("is never red, and its attention animation only runs when motion is allowed", () => {
    const html = show({ kind: "act", reason: "VOICE" });
    const card = html.match(/<div data-proctor-notice="VOICE" class="([^"]*)"/)?.[1] ?? "";
    expect(card).toContain("motion-safe:animate-[pop-in_");
    expect(card).not.toMatch(/danger|red|error/);
    expect(html).not.toMatch(/(?<!motion-safe:)animate-/);
  });

  it("renders the same markup when the engine re-sends the same banner (nothing new to announce)", () => {
    expect(show({ kind: "act", reason: "VOICE" })).toBe(show({ kind: "act", reason: "VOICE" }));
  });

  it("leaves the quieter notices as the thin line, and a recover banner to the recover panel", () => {
    const info = show({ kind: "info", reason: "RECORDED" });
    expect(info).not.toContain("data-proctor-notice");
    expect(info).toMatch(/<div role="status" class="border-t border-hairline bg-canvas"><p class="[^"]*text-\[13px\][^"]*">RECORDED<\/p><\/div>/);
    const recover = show({ kind: "recover", reason: "FULLSCREEN" });
    expect(recover).not.toContain("data-proctor-notice");
    expect(recover).not.toContain("FULLSCREEN");
  });

  it("has real second lines in all five languages", () => {
    for (const locale of CANDIDATE_LOCALES) {
      const p = messagesFor(locale).proctor;
      for (const text of [p.VOICEHint, p.NO_FACEHint]) {
        expect(text.length, locale).toBeGreaterThan(20);
        expect(text, locale).not.toContain("\u2014");
      }
    }
  });
});
