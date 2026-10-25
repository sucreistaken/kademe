import { describe, expect, it } from "vitest";
import { initialSpeakingPhase, litBars, SPEAKING_STEPS, speakingStep, speakingStepState, timeLeftFraction, type SpeakingPhase } from "./speaking-flow";

const PHASES: SpeakingPhase[] = ["THINKING", "RECORDING", "UPLOADING", "DONE", "FAILED"];

describe("speakingStep", () => {
  it("walks prepare, speak, saved in order", () => {
    expect(SPEAKING_STEPS).toEqual(["prepare", "speak", "saved"]);
    expect(speakingStep("THINKING")).toBe(0);
    expect(speakingStep("RECORDING")).toBe(1);
    expect(speakingStep("UPLOADING")).toBe(2);
    expect(speakingStep("DONE")).toBe(3);
  });

  it("keeps a failed recording on the speak step", () => {
    expect(speakingStep("FAILED")).toBe(1);
  });

  it("never goes backwards through the phases a recording passes", () => {
    const order = ["THINKING", "RECORDING", "UPLOADING", "DONE"] as const;
    const steps = order.map(speakingStep);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });
});

describe("speakingStepState", () => {
  it("marks the steps behind as done, the current one active and the rest todo", () => {
    const states = (phase: SpeakingPhase) => SPEAKING_STEPS.map((_, i) => speakingStepState(phase, i));
    expect(states("THINKING")).toEqual(["active", "todo", "todo"]);
    expect(states("RECORDING")).toEqual(["done", "active", "todo"]);
    expect(states("UPLOADING")).toEqual(["done", "done", "active"]);
    expect(states("DONE")).toEqual(["done", "done", "done"]);
  });

  it("has exactly one active step in every phase but the last", () => {
    for (const phase of PHASES.filter((p) => p !== "DONE")) {
      expect(SPEAKING_STEPS.filter((_, i) => speakingStepState(phase, i) === "active")).toHaveLength(1);
    }
  });
});

describe("initialSpeakingPhase", () => {
  it("starts at prepare, or at saved when a take already exists (after a reload)", () => {
    expect(initialSpeakingPhase(undefined)).toBe("THINKING");
    expect(initialSpeakingPhase(null)).toBe("THINKING");
    expect(initialSpeakingPhase(0)).toBe("THINKING");
    expect(initialSpeakingPhase(1)).toBe("DONE");
  });
});

describe("timeLeftFraction", () => {
  it("is the part of the time still left", () => {
    expect(timeLeftFraction(30_000, 30_000)).toBe(1);
    expect(timeLeftFraction(15_000, 30_000)).toBe(0.5);
    expect(timeLeftFraction(0, 30_000)).toBe(0);
  });

  it("stays inside 0 to 1 and reads a missing total as empty", () => {
    expect(timeLeftFraction(40_000, 30_000)).toBe(1);
    expect(timeLeftFraction(-200, 30_000)).toBe(0);
    expect(timeLeftFraction(1000, 0)).toBe(0);
    expect(timeLeftFraction(Number.NaN, 30_000)).toBe(0);
  });
});

describe("litBars", () => {
  it("lights nothing in silence and every bar from a moderate voice", () => {
    expect(litBars(0, 12)).toBe(0);
    expect(litBars(-1, 12)).toBe(0);
    expect(litBars(0.25, 12)).toBe(12);
    expect(litBars(1, 12)).toBe(12);
  });

  it("rises with the level", () => {
    const lit = [0.02, 0.06, 0.12, 0.2].map((l) => litBars(l, 12));
    expect([...lit].sort((a, b) => a - b)).toEqual(lit);
    expect(lit[0]).toBeLessThan(lit[3]);
  });

  it("reads a broken level as silence", () => {
    expect(litBars(Number.NaN, 12)).toBe(0);
  });
});
