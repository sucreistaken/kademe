import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({
  useT: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}(${Object.values(values).join(",")})` : key),
}));

import { SPEAKING_VIDEO, SpeakingPanel } from "./SpeakingPanel";
import type { SpeakingPhase } from "./speaking-flow";

const video = createElement("video", { className: SPEAKING_VIDEO });

function panel(phase: SpeakingPhase, extra: Partial<Parameters<typeof SpeakingPanel>[0]> = {}) {
  return renderToStaticMarkup(createElement(SpeakingPanel, { phase, leftMs: 26_000, totalMs: 30_000, video, ...extra }));
}

const buttons = (html: string) => [...html.matchAll(/<button[^>]*>[^]*?<\/button>/g)].map((m) => m[0]);
const stepState = (html: string, id: string) => html.match(new RegExp(`data-step="${id}" data-state="(\\w+)"`))?.[1];

describe("the speaking recorder panel", () => {
  it("shows three steps, in order, with the current one marked", () => {
    const html = panel("THINKING");
    const at = (k: string) => html.indexOf(k);
    expect(at("speakingStepPrepare")).toBeGreaterThan(-1);
    expect(at("speakingStepPrepare")).toBeLessThan(at("speakingStepSpeak"));
    expect(at("speakingStepSpeak")).toBeLessThan(at("speakingStepSaved"));
    expect(html).toContain("<ol");
    expect(html).toContain('aria-label="speakingSteps"');
    expect(stepState(html, "prepare")).toBe("active");
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(stepState(panel("RECORDING"), "prepare")).toBe("done");
    expect(stepState(panel("RECORDING"), "speak")).toBe("active");
    expect(stepState(panel("DONE"), "saved")).toBe("done");
  });

  describe("while preparing", () => {
    const html = panel("THINKING");

    it("says what the time is for, shows the camera and the big countdown", () => {
      expect(html).toContain("speakingPrepareLabel");
      expect(html).not.toContain("speakingSpeakLabel");
      expect(html).toContain("<video");
      expect(html).toContain('role="timer"');
      expect(html).toContain(">0:26<");
      expect(html).toContain("speakingPrepareHint");
    });

    it("has one large primary button that starts speaking", () => {
      const all = buttons(html);
      expect(all).toHaveLength(1);
      expect(all[0]).toContain("speakingStart");
      expect(all[0]).toContain("h-14 w-full");
      expect(all[0]).toContain("bg-brand");
      expect(all[0]).not.toContain("text-white");
    });

    it("draws the ring as full when the time is full and empty when it is gone", () => {
      const dash = (h: string) => Number(h.match(/stroke-dashoffset="([\d.]+)"/)?.[1]);
      const full = dash(panel("THINKING", { leftMs: 30_000 }));
      const half = dash(panel("THINKING", { leftMs: 15_000 }));
      const gone = dash(panel("THINKING", { leftMs: 0 }));
      expect(full).toBe(0);
      expect(half).toBeGreaterThan(0);
      expect(gone).toBeGreaterThan(half);
      expect(panel("THINKING", { leftMs: 0 })).toContain(">0:00<");
    });
  });

  describe("while recording", () => {
    it("shows the red dot with the recording words, the speaking time and one big stop button", () => {
      const html = panel("RECORDING", { leftMs: 57_000, totalMs: 60_000 });
      expect(html).toContain("bg-danger");
      expect(html).toContain("speakingRecording");
      expect(html).toContain("speakingSpeakLabel");
      expect(html).not.toContain("speakingPrepareLabel");
      expect(html).toContain(">0:57<");
      const all = buttons(html);
      expect(all).toHaveLength(1);
      expect(all[0]).toContain("stopRecording");
      expect(all[0]).toContain("h-14 w-full");
      expect(html).not.toContain("speakingStart");
    });

    it("shows a microphone meter only when a level can be read", () => {
      const withLevel = panel("RECORDING", { micLevel: 0.1 });
      expect(withLevel).toContain('role="meter"');
      expect(withLevel).toContain('aria-label="speakingMic"');
      expect(panel("RECORDING", { micLevel: null })).not.toContain('role="meter"');
      expect(panel("RECORDING")).not.toContain('role="meter"');
    });

    it("lights more of the meter for a louder voice", () => {
      const lit = (level: number) => (panel("RECORDING", { micLevel: level }).match(/class="w-\[5px\] rounded-\[2px\] bg-accent"/g) ?? []).length;
      expect(lit(0)).toBe(0);
      expect(lit(0.05)).toBeGreaterThan(0);
      expect(lit(0.2)).toBeGreaterThan(lit(0.05));
    });

    it("keeps red to the recording dot only", () => {
      expect(panel("RECORDING", { micLevel: 0.1 }).match(/bg-danger/g)).toHaveLength(1);
      for (const phase of ["THINKING", "UPLOADING", "DONE", "FAILED"] as const) expect(panel(phase), phase).not.toContain("danger");
    });
  });

  describe("after recording", () => {
    it("shows a calm saved state and no primary button", () => {
      const html = panel("DONE");
      expect(html).toContain("speakingSavedTitle");
      expect(html).toContain("speakingSavedHint");
      expect(buttons(html)).toHaveLength(0);
      expect(html).not.toContain('role="timer"');
    });

    it("offers a retake only while retakes are left", () => {
      expect(buttons(panel("DONE", { retakesLeft: 1 }))).toHaveLength(1);
      expect(panel("DONE", { retakesLeft: 1 })).toContain("retake(1)");
      expect(buttons(panel("DONE", { retakesLeft: 0 }))).toHaveLength(0);
      expect(buttons(panel("THINKING", { retakesLeft: 2 }))).toHaveLength(1);
    });

    it("says it is saving while the take uploads", () => {
      const html = panel("UPLOADING");
      expect(html).toContain(">saving<");
      expect(buttons(html)).toHaveLength(0);
      expect(stepState(html, "saved")).toBe("active");
    });
  });

  describe("when the recording fails", () => {
    it("says so, shows the reason and what to do instead, with no recorder button", () => {
      const html = panel("FAILED", {
        notice: createElement("p", { role: "alert" }, "no microphone"),
        fallback: createElement("button", { type: "button" }, "type it instead"),
      });
      expect(html).toContain("speakingFailed");
      expect(html).toContain("no microphone");
      expect(html).toContain("type it instead");
      expect(html).not.toContain("speakingStart");
      expect(html).not.toContain("stopRecording");
    });
  });

  it("marks the one button as the tutorial's press point only when asked", () => {
    expect(panel("THINKING", { press: true })).toContain("data-demo-press");
    expect(panel("RECORDING", { press: true })).toContain("data-demo-press");
    expect(panel("THINKING")).not.toContain("data-demo-press");
  });

  it("never mentions a right answer, a score or a level", () => {
    for (const phase of ["THINKING", "RECORDING", "UPLOADING", "DONE", "FAILED"] as const) {
      expect(panel(phase, { micLevel: 0.1, retakesLeft: 1 }).toLowerCase(), phase).not.toMatch(/correct|wrong|score|level\b/);
    }
  });
});
