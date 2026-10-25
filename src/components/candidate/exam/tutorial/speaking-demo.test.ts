import { createElement, type FC, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { candidateMessages } from "@/i18n/candidate";
import { DemoStage } from "./DemoStage";
import { demoSpeakingPhase } from "./demo-media";
import { TUTORIAL_SCRIPTS } from "./scripts";
import { buildTimeline, stateAtTimeline } from "./timeline";

const Provider = NextIntlClientProvider as unknown as FC<{ locale: string; messages: Record<string, unknown>; timeZone: string; children?: ReactNode }>;

const script = TUTORIAL_SCRIPTS.SPEAKING;
const timeline = buildTimeline(script);
const stepStart = (id: string) => timeline.steps.find((s) => s.id === id)!;

/** The demo stage at the start, the middle or the end of a step. */
function stageAt(time: number): string {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale: "en", messages: candidateMessages.en as unknown as Record<string, unknown>, timeZone: "Europe/Istanbul" },
      createElement(DemoStage, { script, state: stateAtTimeline(script, timeline, time), jump: 0, reducedMotion: true }),
    ),
  );
}

const exam = candidateMessages.en.exam;

describe("demoSpeakingPhase", () => {
  it("prepares before the first press, records after it, is saved after the second", () => {
    expect(demoSpeakingPhase([])).toBe("THINKING");
    expect(demoSpeakingPhase([1000])).toBe("RECORDING");
    expect(demoSpeakingPhase([1000, 9000])).toBe("DONE");
  });
});

describe("the speaking tutorial's stage follows the exam's recorder", () => {
  it("opens on the prepare step: one big start button, and a bar that waits without a skip", () => {
    const html = stageAt(stepStart("think").start + 100);
    expect(html).toContain('data-speaking-phase="THINKING"');
    expect(html).toContain(exam.speakingPrepareLabel);
    expect(html).toContain(exam.speakingStart);
    expect(html).toContain(exam.speakingWaitPrepare);
    expect(html).not.toContain(exam.skip);
    expect(html).not.toContain(exam.answerFirst);
    expect(html).not.toContain(exam.saveNext);
  });

  it("records after the press: the red dot, the speaking time, the stop button, a bar that waits", () => {
    const html = stageAt(stepStart("talk").start + 100);
    expect(html).toContain('data-speaking-phase="RECORDING"');
    expect(html).toContain(exam.speakingRecording);
    expect(html).toContain(exam.speakingSpeakLabel);
    expect(html).toContain(exam.stopRecording);
    expect(html).toContain('role="meter"');
    expect(html).toContain(exam.speakingWaitRecording);
    expect(html).not.toContain(exam.skip);
  });

  it("ends saved: the calm saved state and a bar that offers the next task", () => {
    const html = stageAt(stepStart("next").start + 100);
    expect(html).toContain('data-speaking-phase="DONE"');
    expect(html).toContain(exam.speakingSavedTitle);
    expect(html).toContain(exam.speakingNext);
    expect(html).not.toContain(exam.speakingWaitRecording);
    expect(html).not.toContain(exam.skip);
  });

  it("keeps the bar's button where the cursor presses it, with the id the script targets", () => {
    for (const id of ["think", "talk", "next"]) expect(stageAt(stepStart(id).start + 100), id).toContain('id="tutorial-next"');
  });

  it("draws the camera as a drawing, never a live video", () => {
    expect(stageAt(stepStart("think").start + 100)).not.toContain("<video");
  });
});
